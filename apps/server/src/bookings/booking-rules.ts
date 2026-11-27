import {
  daySlots,
  SLOT_MINUTES,
  type OccupyingEntry,
} from "../schedule/availability.js"
import type { LocalDate } from "../schedule/zoned-time.js"

/** Active future bookings one account may hold at one facility. */
export const BOOKING_CAP = 2

/** How long an approval-only request may wait, at most. */
export const HOLD_HOURS = 24

/** A pending request expires at the earlier of 24 hours and its start. */
export function holdDeadline(submittedAt: Date, startsAt: Date): Date {
  return new Date(
    Math.min(submittedAt.getTime() + HOLD_HOURS * 3_600_000, startsAt.getTime())
  )
}

export type Interval = { startsAt: string; endsAt: string }

/**
 * Free ranges of the requested length on the same day, nearest to the
 * requested start first. Built from the same slot projection the public
 * schedule shows, so an alternative is never something the schedule hides.
 */
export function nearbyAlternatives(input: {
  date: LocalDate
  timeZone: string
  opensAtMin: number
  closesAtMin: number
  entries: readonly OccupyingEntry[]
  now: Date
  startsAt: Date
  endsAt: Date
  limit?: number
}): Interval[] {
  const slots = daySlots(input)
  const length =
    (input.endsAt.getTime() - input.startsAt.getTime()) /
    (SLOT_MINUTES * 60_000)
  const candidates: Interval[] = []
  for (let first = 0; first + length <= slots.length; first++) {
    const run = slots.slice(first, first + length)
    const free = run.every((slot) => slot.status === "available")
    const contiguous = run.every(
      (slot, index) => index === 0 || run[index - 1]!.endsAt === slot.startsAt
    )
    if (free && contiguous) {
      candidates.push({
        startsAt: run[0]!.startsAt,
        endsAt: run[run.length - 1]!.endsAt,
      })
    }
  }
  const requested = input.startsAt.getTime()
  const distance = (range: Interval) =>
    Math.abs(Date.parse(range.startsAt) - requested)
  return candidates
    .sort(
      (a, b) =>
        distance(a) - distance(b) ||
        Date.parse(a.startsAt) - Date.parse(b.startsAt)
    )
    .slice(0, input.limit ?? 3)
}
