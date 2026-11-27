import { SLOT_MINUTES, WINDOW_DAYS } from "./availability.js"
import {
  addDays,
  localDateOf,
  localMinutesOf,
  zonedInstant,
  type LocalDate,
} from "./zoned-time.js"

/**
 * Interval rules shared by availability and booking: the browsing and
 * booking window, slot alignment, and opening hours. All in the facility's
 * local time.
 */

export type DayWindow = { firstDate: LocalDate; lastDate: LocalDate }

/** Today plus the next 13 days in the facility's time zone. */
export function bookingWindow(now: Date, timeZone: string): DayWindow {
  const today = localDateOf(now, timeZone)
  return { firstDate: today, lastDate: addDays(today, WINDOW_DAYS - 1) }
}

export type LocalRange = { date: LocalDate; startMin: number; endMin: number }

export type RangeResult<T> =
  { ok: true; value: T } | { ok: false; message: string }

/**
 * Places an instant range on one local day as minutes from local midnight.
 * A range ending at the next local midnight ends at minute 1440.
 */
export function localRangeOf(
  startsAt: Date,
  endsAt: Date,
  timeZone: string
): RangeResult<LocalRange> {
  if (endsAt <= startsAt) {
    return { ok: false, message: "The end must be after the start" }
  }
  const date = localDateOf(startsAt, timeZone)
  const startMin = localMinutesOf(startsAt, timeZone)
  let endMin = localMinutesOf(endsAt, timeZone)
  if (startMin === null || endMin === null) {
    return { ok: false, message: "Times must fall on whole minutes" }
  }
  if (endMin === 0 && localDateOf(endsAt, timeZone) === addDays(date, 1)) {
    endMin = 24 * 60
  }
  const sameDay = endMin === 24 * 60 || localDateOf(endsAt, timeZone) === date
  // The round trip rejects ranges that cross a day or a DST fold oddly.
  const exact =
    zonedInstant(date, startMin, timeZone).getTime() === startsAt.getTime() &&
    zonedInstant(date, endMin, timeZone).getTime() === endsAt.getTime()
  if (!sameDay || !exact || endMin <= startMin) {
    return { ok: false, message: "A booking must start and end on one day" }
  }
  if (startMin % SLOT_MINUTES !== 0 || endMin % SLOT_MINUTES !== 0) {
    return {
      ok: false,
      message: `Bookings use whole ${SLOT_MINUTES}-minute slots`,
    }
  }
  return { ok: true, value: { date, startMin, endMin } }
}

/** Checks a local range against opening hours, the window and the clock. */
export function checkBookable(input: {
  range: LocalRange
  startsAt: Date
  hours: { opensAtMin: number; closesAtMin: number } | null
  timeZone: string
  now: Date
}): RangeResult<LocalRange> {
  const { range, hours } = input
  if (input.startsAt <= input.now) {
    return { ok: false, message: "Only future slots can be booked" }
  }
  const window = bookingWindow(input.now, input.timeZone)
  if (range.date < window.firstDate || range.date > window.lastDate) {
    return {
      ok: false,
      message: `Choose a date from ${window.firstDate} to ${window.lastDate}`,
    }
  }
  if (
    !hours ||
    range.startMin < hours.opensAtMin ||
    range.endMin > hours.closesAtMin
  ) {
    return {
      ok: false,
      message: "The facility is closed for part of that time",
    }
  }
  return { ok: true, value: range }
}
