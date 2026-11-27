import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common"

import { CLOCK, type Clock } from "../common/clock.js"
import type { Prisma } from "../generated/prisma/client.js"
import type { AuditAction, BookingStatus } from "../generated/prisma/enums.js"
import { NotificationWriter } from "../notifications/notification-writer.js"
import { PrismaService } from "../prisma/prisma.service.js"
import {
  inFacilityTransaction,
  type Tx,
} from "../schedule/facility-transaction.js"
import {
  cancellableUntil,
  decideApproval,
  decideBlock,
  decideUserCancellation,
  effectiveStatus,
  type Refusal,
} from "./booking-transitions.js"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const bookingView = {
  id: true,
  startsAt: true,
  endsAt: true,
  status: true,
  expiresAt: true,
  statusReason: true,
  createdAt: true,
  facility: { select: { slug: true, name: true, timeZone: true } },
  scheduleEntry: { select: { kind: true } },
} as const satisfies Prisma.BookingSelect

type BookingRow = Prisma.BookingGetPayload<{ select: typeof bookingView }>

const adminView = {
  ...bookingView,
  account: { select: { id: true, name: true, email: true } },
} as const satisfies Prisma.BookingSelect

type AdminRow = Prisma.BookingGetPayload<{ select: typeof adminView }>

export type AdminFilter = "pending" | "upcoming" | "blocked"

/** A write either applies or returns why it was refused, after commit. */
type Applied<T> = { ok: true; value: T } | { ok: false; refusal: Refusal }

@Injectable()
export class BookingLifecycleService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(NotificationWriter)
    private readonly notifications: NotificationWriter
  ) {}

  async listMine(accountId: string) {
    const now = this.clock.now()
    const rows = await this.prisma.booking.findMany({
      where: { accountId },
      select: bookingView,
      orderBy: { startsAt: "desc" },
      take: 50,
    })
    return rows.map((row) => toView(row, now))
  }

  async listForAdmin(filter: AdminFilter) {
    const now = this.clock.now()
    const where: Prisma.BookingWhereInput =
      filter === "pending"
        ? { status: "pending", expiresAt: { gt: now } }
        : filter === "blocked"
          ? { status: "blocked", scheduleEntry: { kind: "block" } }
          : {
              endsAt: { gt: now },
              OR: [
                { status: "confirmed" },
                { status: "pending", expiresAt: { gt: now } },
              ],
            }
    const rows = await this.prisma.booking.findMany({
      where,
      select: adminView,
      orderBy:
        filter === "pending" ? { expiresAt: "asc" } : { startsAt: "asc" },
      take: 200,
    })
    return rows.map((row) => toAdminView(row, now))
  }

  approve(actorId: string, id: string) {
    return this.transition(id, null, async (tx, booking, now) => {
      const decision = decideApproval(booking, now)
      if (!decision.ok) return decision
      await tx.booking.update({
        where: { id },
        data: { status: "confirmed", expiresAt: null, statusChangedAt: now },
      })
      await tx.scheduleEntry.update({
        where: { bookingId: id },
        data: { kind: "booking", expiresAt: null },
      })
      await audit(tx, actorId, "booking_approved", id)
      return { ok: true, value: null }
    })
  }

  /** Requester-only: other accounts get a 404, as if it did not exist. */
  cancelOwn(accountId: string, id: string) {
    return this.transition(id, accountId, async (tx, booking, now) => {
      const decision = decideUserCancellation(booking, now)
      if (!decision.ok) return decision
      await tx.booking.update({
        where: { id },
        data: { status: decision.value, statusChangedAt: now },
      })
      await tx.scheduleEntry.deleteMany({ where: { bookingId: id } })
      await audit(
        tx,
        accountId,
        decision.value === "no_show" ? "booking_no_show" : "booking_cancelled",
        id
      )
      return { ok: true, value: null }
    })
  }

  /**
   * Replaces the booking's hold or reservation with a block that keeps the
   * time until it ends or an Admin removes it. The status change, block,
   * notification and audit entry commit together.
   */
  block(actorId: string, id: string, reason: string) {
    return this.transition(id, null, async (tx, booking, now) => {
      const decision = decideBlock(booking, now)
      if (!decision.ok) return decision
      await tx.booking.update({
        where: { id },
        data: { status: "blocked", statusReason: reason, statusChangedAt: now },
      })
      await tx.scheduleEntry.update({
        where: { bookingId: id },
        data: { kind: "block", expiresAt: null, reason },
      })
      await this.notifications.notify(tx, {
        recipientId: booking.accountId,
        type: "booking_blocked",
        bookingId: id,
        dedupeKey: `booking_blocked:${id}`,
        message: `An Admin blocked your booking at ${booking.facility.name} on ${describeTime(booking.startsAt, booking.facility.timeZone)}. Reason: ${reason}`,
      })
      await audit(tx, actorId, "booking_blocked", id, { reason })
      return { ok: true, value: null }
    })
  }

  /** Removes an active block so the time can be booked again. */
  unblock(actorId: string, id: string) {
    return this.transition(id, null, async (tx, booking) => {
      if (booking.status !== "blocked" || booking.blockEntryId === null) {
        return {
          ok: false,
          refusal: {
            code: "not_blocked",
            message: "No active block to remove.",
          },
        }
      }
      await tx.scheduleEntry.delete({ where: { id: booking.blockEntryId } })
      await audit(tx, actorId, "booking_unblocked", id)
      return { ok: true, value: null }
    })
  }

  /**
   * Loads the booking, then re-reads it under its facility's lock and applies
   * the change. A refusal still commits the transaction, so expiry recorded
   * by the facility transaction stays recorded.
   */
  private async transition(
    id: string,
    ownerId: string | null,
    apply: (tx: Tx, booking: LockedBooking, now: Date) => Promise<Applied<null>>
  ) {
    if (!UUID.test(id)) throw new NotFoundException("Booking not found")
    const found = await this.prisma.booking.findUnique({
      where: { id },
      select: { facilityId: true, accountId: true },
    })
    if (!found || (ownerId !== null && found.accountId !== ownerId)) {
      throw new NotFoundException("Booking not found")
    }

    const result = await inFacilityTransaction(
      this.prisma,
      this.clock,
      found.facilityId,
      async (tx, now) => {
        const booking = await tx.booking.findUniqueOrThrow({
          where: { id },
          select: {
            accountId: true,
            status: true,
            startsAt: true,
            endsAt: true,
            expiresAt: true,
            facility: { select: { name: true, timeZone: true } },
            scheduleEntry: { select: { id: true, kind: true } },
          },
        })
        const applied = await apply(
          tx,
          {
            ...booking,
            blockEntryId:
              booking.scheduleEntry?.kind === "block"
                ? booking.scheduleEntry.id
                : null,
          },
          now
        )
        const row = await tx.booking.findUniqueOrThrow({
          where: { id },
          select: bookingView,
        })
        return { applied, view: toView(row, now) }
      }
    )
    if (!result.applied.ok) {
      throw new ConflictException(result.applied.refusal)
    }
    return result.view
  }
}

type LockedBooking = {
  accountId: string
  status: BookingStatus
  startsAt: Date
  endsAt: Date
  expiresAt: Date | null
  facility: { name: string; timeZone: string }
  blockEntryId: string | null
}

function toView(row: BookingRow, now: Date) {
  const status = effectiveStatus(row, now)
  return {
    id: row.id,
    facility: row.facility,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    status,
    expiresAt: status === "pending" ? row.expiresAt!.toISOString() : null,
    reason: row.statusReason,
    blocked: row.scheduleEntry?.kind === "block",
    cancellableUntil:
      status === "pending" || status === "confirmed"
        ? (cancellableUntil({ ...row, status })?.toISOString() ?? null)
        : null,
    createdAt: row.createdAt.toISOString(),
  }
}

function toAdminView(row: AdminRow, now: Date) {
  return { ...toView(row, now), account: row.account }
}

function audit(
  tx: Tx,
  actorId: string,
  action: AuditAction,
  bookingId: string,
  details: Prisma.InputJsonObject = {}
) {
  return tx.auditLog.create({
    data: {
      actorId,
      action,
      entityType: "booking",
      entityId: bookingId,
      details,
    },
  })
}

/** "Sat, Nov 28, 10:00 AM" in the facility's own time zone. */
function describeTime(instant: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(instant)
}
