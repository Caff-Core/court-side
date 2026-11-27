/**
 * Calendar dates and wall-clock times in a facility's IANA time zone.
 *
 * Node 24 ships Temporal only behind a flag, so this module uses Intl to
 * read zone offsets. It is the only place that does zone arithmetic; swap it
 * for Temporal.ZonedDateTime once the runtime provides it.
 */

/** An ISO calendar date such as "2026-11-27", with no time zone attached. */
export type LocalDate = string

type DateParts = { year: number; month: number; day: number }

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 86_400_000

/** Returns the fields of a real ISO calendar date, or null. */
export function parseLocalDate(value: string): DateParts | null {
  const match = ISO_DATE.exec(value)
  if (!match) return null
  const [year, month, day] = [match[1], match[2], match[3]].map(Number) as [
    number,
    number,
    number,
  ]
  const probe = new Date(Date.UTC(year, month - 1, day))
  const real =
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  return real ? { year, month, day } : null
}

function requireDate(value: LocalDate): DateParts {
  const parts = parseLocalDate(value)
  if (!parts) throw new RangeError(`Not an ISO calendar date: ${value}`)
  return parts
}

/** Calendar arithmetic on the date alone, so no offset can shift the day. */
export function addDays(date: LocalDate, days: number): LocalDate {
  const { year, month, day } = requireDate(date)
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10)
}

/** ISO weekday of a calendar date: 1 is Monday, 7 is Sunday. */
export function isoWeekday(date: LocalDate): number {
  const { year, month, day } = requireDate(date)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() || 7
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string) {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    formatters.set(timeZone, formatter)
  }
  return formatter
}

function wallClockParts(instantMs: number, timeZone: string) {
  const values: Record<string, number> = {}
  for (const part of formatterFor(timeZone).formatToParts(instantMs)) {
    if (part.type !== "literal") values[part.type] = Number(part.value)
  }
  return values as Record<
    "year" | "month" | "day" | "hour" | "minute" | "second",
    number
  >
}

/** Local wall-clock time minus UTC at an instant, in milliseconds. */
function offsetAt(instantMs: number, timeZone: string) {
  const whole = Math.floor(instantMs / 1000) * 1000
  const p = wallClockParts(whole, timeZone)
  return (
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - whole
  )
}

/** The community's calendar date at an instant. */
export function localDateOf(instant: Date, timeZone: string): LocalDate {
  const p = wallClockParts(instant.getTime(), timeZone)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${String(p.year).padStart(4, "0")}-${pad(p.month)}-${pad(p.day)}`
}

/**
 * The instant at a local date plus minutes from local midnight. Matches
 * Temporal's "compatible" disambiguation: a repeated time resolves to the
 * earlier instant and a skipped time moves forward by the gap.
 */
export function zonedInstant(
  date: LocalDate,
  minutes: number,
  timeZone: string
): Date {
  const { year, month, day } = requireDate(date)
  const wall = Date.UTC(year, month - 1, day) + minutes * 60_000
  // Offsets a day either side bracket any transition near this time.
  const before = offsetAt(wall - DAY_MS, timeZone)
  const after = offsetAt(wall + DAY_MS, timeZone)
  const valid = [...new Set([before, after])]
    .map((offset) => wall - offset)
    .filter((instant) => offsetAt(instant, timeZone) === wall - instant)
    .sort((a, b) => a - b)
  return new Date(valid[0] ?? wall - before)
}
