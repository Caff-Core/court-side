import type { ScheduleEntryKind } from "../generated/prisma/enums.js"
import { zonedInstant, type LocalDate } from "./zoned-time.js"

export const SLOT_MINUTES = 30
/** Today plus the next 13 days, matching the booking window. */
export const WINDOW_DAYS = 14

/** What anyone may see about a slot. Never who booked it or why it is shut. */
export type SlotStatus =
  "available" | "pending" | "booked" | "event" | "blocked" | "closed" | "past"

export type PublicSlot = {
  startsAt: string
  endsAt: string
  status: SlotStatus
}

/** The only entry fields the public projection reads. */
export type OccupyingEntry = {
  kind: ScheduleEntryKind
  startsAt: Date
  endsAt: Date
  expiresAt: Date | null
}

/** Strongest first: a closure wins over a block it overlaps, and so on. */
const PRECEDENCE: readonly ScheduleEntryKind[] = [
  "closure",
  "block",
  "event",
  "booking",
  "hold",
]

const STATUS_OF: Record<ScheduleEntryKind, SlotStatus> = {
  closure: "closed",
  block: "blocked",
  event: "event",
  booking: "booked",
  hold: "pending",
}

/** An expired hold stops occupying time even before cleanup removes it. */
export function occupiesAt(entry: OccupyingEntry, now: Date) {
  return entry.kind !== "hold" || (entry.expiresAt ?? now) > now
}

/**
 * Splits one local day's opening window into 30-minute slots and labels
 * each with the strongest entry overlapping it. Ranges are start-inclusive
 * and end-exclusive, so an entry ending at a slot's start leaves it free.
 */
export function daySlots(input: {
  date: LocalDate
  timeZone: string
  opensAtMin: number
  closesAtMin: number
  entries: readonly OccupyingEntry[]
  now: Date
}): PublicSlot[] {
  const active = input.entries.filter((entry) => occupiesAt(entry, input.now))
  const slots: PublicSlot[] = []
  for (
    let minute = input.opensAtMin;
    minute + SLOT_MINUTES <= input.closesAtMin;
    minute += SLOT_MINUTES
  ) {
    const startsAt = zonedInstant(input.date, minute, input.timeZone)
    const endsAt = zonedInstant(
      input.date,
      minute + SLOT_MINUTES,
      input.timeZone
    )
    // A spring-forward gap inside opening hours has no real time to book.
    if (endsAt <= startsAt) continue
    slots.push({
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      status: statusOf(startsAt, endsAt, active, input.now),
    })
  }
  return slots
}

function statusOf(
  startsAt: Date,
  endsAt: Date,
  entries: readonly OccupyingEntry[],
  now: Date
): SlotStatus {
  if (endsAt <= now) return "past"
  const kinds = new Set(
    entries
      .filter((entry) => entry.startsAt < endsAt && entry.endsAt > startsAt)
      .map((entry) => entry.kind)
  )
  const strongest = PRECEDENCE.find((kind) => kinds.has(kind))
  return strongest ? STATUS_OF[strongest] : "available"
}
