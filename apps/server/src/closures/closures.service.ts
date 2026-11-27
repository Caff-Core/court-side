import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"

import { CLOCK, type Clock } from "../common/clock.js"
import type { Prisma } from "../generated/prisma/client.js"
import { NotificationWriter } from "../notifications/notification-writer.js"
import { PrismaService } from "../prisma/prisma.service.js"
import {
  inFacilityTransaction,
  type Tx,
} from "../schedule/facility-transaction.js"
import { parseLocalDateTime, zonedInstant } from "../schedule/zoned-time.js"

export type ClosureRequest = {
  facility: string
  startsLocal: string
  endsLocal: string
  reason: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const closureView = {
  id: true,
  startsAt: true,
  endsAt: true,
  reason: true,
  cancelledBookings: true,
  endedAt: true,
  createdAt: true,
  facilityId: true,
  facility: { select: { slug: true, name: true, timeZone: true } },
  createdBy: { select: { name: true } },
} as const satisfies Prisma.ClosureSelect

type ClosureRow = Prisma.ClosureGetPayload<{ select: typeof closureView }>

@Injectable()
export class ClosuresService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(NotificationWriter)
    private readonly notifications: NotificationWriter
  ) {}

  /** Open closures that have not ended yet, soonest first. */
  async listCurrent() {
    const rows = await this.prisma.closure.findMany({
      where: { endedAt: null, endsAt: { gt: this.clock.now() } },
      select: closureView,
      orderBy: { startsAt: "asc" },
      take: 200,
    })
    return rows.map(toView)
  }

  /**
   * Closes a facility for a wall-clock range in its own time zone. In one
   * facility transaction: the closure and its schedule entry, cancellation
   * of every overlapping pending or confirmed booking that has not ended,
   * one notification per cancelled booking, and the audit entries. A retry
   * with the same Idempotency-Key returns the recorded closure.
   */
  async create(actorId: string, key: string, input: ClosureRequest) {
    const facility = await this.prisma.facility.findUnique({
      where: { slug: input.facility },
      select: { id: true, name: true, timeZone: true },
    })
    if (!facility) throw new NotFoundException("Facility not found")
    const start = parseLocalDateTime(input.startsLocal)
    const end = parseLocalDateTime(input.endsLocal)
    if (!start || !end) {
      throw new BadRequestException("Use local times such as 2026-11-28T09:00")
    }
    const startsAt = zonedInstant(start.date, start.minutes, facility.timeZone)
    const endsAt = zonedInstant(end.date, end.minutes, facility.timeZone)
    if (endsAt <= startsAt) {
      throw new BadRequestException("The end must be after the start")
    }
    const request = {
      facilityId: facility.id,
      startsAt,
      endsAt,
      reason: input.reason,
    }

    const previous = await this.findByKey(actorId, key)
    if (previous) return replay(previous, request)

    try {
      return await inFacilityTransaction(
        this.prisma,
        this.clock,
        facility.id,
        async (tx, now) => {
          const raced = await tx.closure.findUnique({
            where: { createdById_key: { createdById: actorId, key } },
            select: closureView,
          })
          if (raced) return replay(raced, request)
          if (endsAt <= now) {
            throw new BadRequestException("That period has already ended")
          }
          return this.apply(tx, now, { actorId, key, facility, ...request })
        }
      )
    } catch (error) {
      // The same key used at the same moment for another facility.
      const previous = await this.findByKey(actorId, key)
      if (previous) return replay(previous, request)
      throw error
    }
  }

  /** Ends a closure now, releasing only its own restriction. */
  async end(actorId: string, id: string) {
    if (!UUID.test(id)) throw new NotFoundException("Closure not found")
    const found = await this.prisma.closure.findUnique({
      where: { id },
      select: { facilityId: true },
    })
    if (!found) throw new NotFoundException("Closure not found")
    return inFacilityTransaction(
      this.prisma,
      this.clock,
      found.facilityId,
      async (tx, now) => {
        const closure = await tx.closure.findUniqueOrThrow({ where: { id } })
        if (closure.endedAt) {
          throw new ConflictException({
            code: "closure_ended",
            message: "This closure has already ended.",
          })
        }
        await tx.scheduleEntry.deleteMany({ where: { closureId: id } })
        await audit(tx, actorId, "closure_ended", "closure", id, {})
        const row = await tx.closure.update({
          where: { id },
          data: { endedAt: now, endedById: actorId },
          select: closureView,
        })
        return toView(row)
      }
    )
  }

  private findByKey(actorId: string, key: string) {
    return this.prisma.closure.findUnique({
      where: { createdById_key: { createdById: actorId, key } },
      select: closureView,
    })
  }

  private async apply(
    tx: Tx,
    now: Date,
    input: {
      actorId: string
      key: string
      facility: { id: string; name: string; timeZone: string }
      startsAt: Date
      endsAt: Date
      reason: string
    }
  ) {
    const { actorId, facility, startsAt, endsAt, reason } = input
    const closure = await tx.closure.create({
      data: {
        facilityId: facility.id,
        startsAt,
        endsAt,
        reason,
        key: input.key,
        createdById: actorId,
        scheduleEntry: {
          create: {
            facilityId: facility.id,
            kind: "closure",
            startsAt,
            endsAt,
            reason,
          },
        },
      },
    })

    const affected = await tx.booking.findMany({
      where: {
        facilityId: facility.id,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        AND: [
          { endsAt: { gt: now } },
          {
            OR: [
              { status: "confirmed" },
              { status: "pending", expiresAt: { gt: now } },
            ],
          },
        ],
      },
      select: { id: true, accountId: true, startsAt: true },
    })
    for (const booking of affected) {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: "cancelled",
          statusReason: `Closed: ${reason}`,
          statusChangedAt: now,
        },
      })
      await tx.scheduleEntry.deleteMany({ where: { bookingId: booking.id } })
      await this.notifications.notify(tx, {
        recipientId: booking.accountId,
        type: "booking_cancelled_closure",
        bookingId: booking.id,
        dedupeKey: `closure:${closure.id}:booking:${booking.id}`,
        message: `Your booking at ${facility.name} on ${describeTime(booking.startsAt, facility.timeZone)} was cancelled because the facility is closed. Reason: ${reason}`,
      })
      await audit(tx, actorId, "booking_cancelled", "booking", booking.id, {
        closureId: closure.id,
        reason,
      })
    }

    await audit(tx, actorId, "closure_created", "closure", closure.id, {
      reason,
      cancelledBookings: affected.length,
    })
    const row = await tx.closure.update({
      where: { id: closure.id },
      data: { cancelledBookings: affected.length },
      select: closureView,
    })
    return toView(row)
  }
}

function replay(
  previous: ClosureRow,
  request: { facilityId: string; startsAt: Date; endsAt: Date; reason: string }
) {
  const same =
    previous.facilityId === request.facilityId &&
    previous.startsAt.getTime() === request.startsAt.getTime() &&
    previous.endsAt.getTime() === request.endsAt.getTime() &&
    previous.reason === request.reason
  if (!same) {
    throw new UnprocessableEntityException({
      code: "idempotency_key_reused",
      message: "This Idempotency-Key was already used for a different closure.",
    })
  }
  return toView(previous)
}

function toView(row: ClosureRow) {
  return {
    id: row.id,
    facility: row.facility,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    reason: row.reason,
    cancelledBookings: row.cancelledBookings,
    endedAt: row.endedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
  }
}

function audit(
  tx: Tx,
  actorId: string,
  action: "closure_created" | "closure_ended" | "booking_cancelled",
  entityType: "closure" | "booking",
  entityId: string,
  details: Prisma.InputJsonObject
) {
  return tx.auditLog.create({
    data: { actorId, action, entityType, entityId, details },
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
