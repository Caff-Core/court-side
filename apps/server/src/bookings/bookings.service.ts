import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"

import { CLOCK, type Clock } from "../common/clock.js"
import type { Prisma } from "../generated/prisma/client.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { occupiesAt } from "../schedule/availability.js"
import {
  inFacilityTransaction,
  type Tx,
} from "../schedule/facility-transaction.js"
import {
  checkBookable,
  localRangeOf,
  type LocalRange,
} from "../schedule/slot-rules.js"
import { isoWeekday, zonedInstant } from "../schedule/zoned-time.js"
import {
  BOOKING_CAP,
  holdDeadline,
  nearbyAlternatives,
} from "./booking-rules.js"

export type BookingRequest = {
  facility: string
  startsAt: string
  endsAt: string
}

/** The HTTP status and body of a booking decision, as stored for replay. */
export type Outcome = {
  statusCode: number
  body: Record<string, unknown>
  bookingId?: string
}

type FacilityRef = {
  id: string
  slug: string
  timeZone: string
  requiresApproval: boolean
}

const UNAVAILABLE = "That time is no longer available."

@Injectable()
export class BookingsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock
  ) {}

  /**
   * Decides a booking request once per Idempotency-Key. Every decision for a
   * facility runs inside its facility transaction, so two overlapping
   * requests, or a request racing the account's cap, are decided one after
   * the other on committed data.
   */
  async request(
    accountId: string,
    key: string,
    input: BookingRequest
  ): Promise<Outcome> {
    const facility = await this.prisma.facility.findUnique({
      where: { slug: input.facility },
      select: { id: true, slug: true, timeZone: true, requiresApproval: true },
    })
    if (!facility) throw new NotFoundException("Facility not found")

    const startsAt = new Date(input.startsAt)
    const endsAt = new Date(input.endsAt)
    const local = localRangeOf(startsAt, endsAt, facility.timeZone)
    if (!local.ok) throw new BadRequestException(local.message)
    const fingerprint = { facilityId: facility.id, startsAt, endsAt }

    try {
      return await inFacilityTransaction(
        this.prisma,
        this.clock,
        facility.id,
        async (tx, now) => {
          const previous = await tx.bookingAttempt.findUnique({
            where: { accountId_key: { accountId, key } },
          })
          if (previous) return replay(previous, fingerprint)

          const outcome = await this.decide(tx, now, {
            accountId,
            facility,
            range: local.value,
            startsAt,
            endsAt,
          })
          await tx.bookingAttempt.create({
            data: {
              accountId,
              key,
              ...fingerprint,
              statusCode: outcome.statusCode,
              response: outcome.body as Prisma.InputJsonObject,
              bookingId: outcome.bookingId ?? null,
            },
          })
          return outcome
        }
      )
    } catch (error) {
      // The same key used at the same moment for a different facility: the
      // other facility's transaction recorded the attempt first.
      if (hasCode(error, "P2002")) {
        const previous = await this.prisma.bookingAttempt.findUnique({
          where: { accountId_key: { accountId, key } },
        })
        if (previous) return replay(previous, fingerprint)
      }
      // The exclusion constraint is a backstop behind the facility lock.
      if (hasCode(error, "23P01")) {
        return {
          statusCode: 409,
          body: {
            code: "slot_unavailable",
            message: UNAVAILABLE,
            alternatives: [],
          },
        }
      }
      throw error
    }
  }

  private async decide(
    tx: Tx,
    now: Date,
    input: {
      accountId: string
      facility: FacilityRef
      range: LocalRange
      startsAt: Date
      endsAt: Date
    }
  ): Promise<Outcome> {
    const { accountId, facility, range, startsAt, endsAt } = input
    const hours = await tx.openingHours.findUnique({
      where: {
        facilityId_weekday: {
          facilityId: facility.id,
          weekday: isoWeekday(range.date),
        },
      },
    })
    const check = checkBookable({
      range,
      startsAt,
      hours,
      timeZone: facility.timeZone,
      now,
    })
    if (!check.ok || !hours) {
      throw new BadRequestException(check.ok ? "Closed" : check.message)
    }

    const active = await tx.booking.count({
      where: {
        accountId,
        facilityId: facility.id,
        endsAt: { gt: now },
        OR: [
          { status: "confirmed" },
          { status: "pending", expiresAt: { gt: now } },
        ],
      },
    })
    if (active >= BOOKING_CAP) {
      return {
        statusCode: 409,
        body: {
          code: "booking_limit",
          message: `You already have ${BOOKING_CAP} upcoming bookings at this facility.`,
        },
      }
    }

    const dayOpens = zonedInstant(
      range.date,
      hours.opensAtMin,
      facility.timeZone
    )
    const dayCloses = zonedInstant(
      range.date,
      hours.closesAtMin,
      facility.timeZone
    )
    const entries = await tx.scheduleEntry.findMany({
      where: {
        facilityId: facility.id,
        startsAt: { lt: dayCloses },
        endsAt: { gt: dayOpens },
      },
      select: { kind: true, startsAt: true, endsAt: true, expiresAt: true },
    })
    const taken = entries.some(
      (entry) =>
        occupiesAt(entry, now) &&
        entry.startsAt < endsAt &&
        entry.endsAt > startsAt
    )
    if (taken) {
      return {
        statusCode: 409,
        body: {
          code: "slot_unavailable",
          message: UNAVAILABLE,
          alternatives: nearbyAlternatives({
            date: range.date,
            timeZone: facility.timeZone,
            opensAtMin: hours.opensAtMin,
            closesAtMin: hours.closesAtMin,
            entries,
            now,
            startsAt,
            endsAt,
          }),
        },
      }
    }

    const pending = facility.requiresApproval
    const expiresAt = pending ? holdDeadline(now, startsAt) : null
    const booking = await tx.booking.create({
      data: {
        facilityId: facility.id,
        accountId,
        startsAt,
        endsAt,
        status: pending ? "pending" : "confirmed",
        expiresAt,
        scheduleEntry: {
          create: {
            facilityId: facility.id,
            accountId,
            kind: pending ? "hold" : "booking",
            startsAt,
            endsAt,
            expiresAt,
          },
        },
      },
    })
    return {
      statusCode: 201,
      bookingId: booking.id,
      body: {
        id: booking.id,
        facility: facility.slug,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        status: booking.status,
        expiresAt: booking.expiresAt?.toISOString() ?? null,
      },
    }
  }
}

function replay(
  previous: {
    facilityId: string
    startsAt: Date
    endsAt: Date
    statusCode: number
    response: Prisma.JsonValue
  },
  request: { facilityId: string; startsAt: Date; endsAt: Date }
): Outcome {
  const same =
    previous.facilityId === request.facilityId &&
    previous.startsAt.getTime() === request.startsAt.getTime() &&
    previous.endsAt.getTime() === request.endsAt.getTime()
  if (!same) {
    throw new UnprocessableEntityException({
      code: "idempotency_key_reused",
      message: "This Idempotency-Key was already used for a different request.",
    })
  }
  return {
    statusCode: previous.statusCode,
    body: previous.response as Record<string, unknown>,
  }
}

/** Finds a Prisma or PostgreSQL error code anywhere in a driver error. */
function hasCode(error: unknown, code: string): boolean {
  const seen = new Set<unknown>()
  const visit = (value: unknown): boolean => {
    if (!value || typeof value !== "object" || seen.has(value)) return false
    seen.add(value)
    const record = value as Record<string, unknown>
    if (record.code === code || record.originalCode === code) return true
    return ["cause", "meta", "driverAdapterError"].some((k) => visit(record[k]))
  }
  return visit(error)
}
