import type { BookingStatus } from "../generated/prisma/enums.js"

/**
 * Booking state transitions, decided from a booking's stored state and the
 * transaction's "now". Callers apply them inside the facility transaction.
 *
 * | From      | To                                     | Trigger                               |
 * | --------- | -------------------------------------- | ------------------------------------- |
 * | pending   | confirmed, expired, cancelled, blocked | approval, deadline, withdrawal, block |
 * | confirmed | cancelled, no_show, blocked            | timely or late cancellation, block    |
 */

/** A confirmed booking cancelled this close to its start is a no-show. */
export const CANCEL_CUTOFF_HOURS = 2

export type BookingState = {
  status: BookingStatus
  startsAt: Date
  endsAt: Date
  expiresAt: Date | null
}

export type Refusal = { code: string; message: string }
export type Decision<T> =
  { ok: true; value: T } | { ok: false; refusal: Refusal }

const refuse = (code: string, message: string) =>
  ({ ok: false, refusal: { code, message } }) as const

/** A pending request past its deadline is expired, cleaned up or not. */
export function effectiveStatus(
  booking: BookingState,
  now: Date
): BookingStatus {
  return booking.status === "pending" &&
    booking.expiresAt !== null &&
    booking.expiresAt <= now
    ? "expired"
    : booking.status
}

/** Only an unexpired pending request can be approved. */
export function decideApproval(
  booking: BookingState,
  now: Date
): Decision<"confirmed"> {
  const status = effectiveStatus(booking, now)
  if (status === "expired") {
    return refuse(
      "booking_expired",
      "This request passed its approval deadline."
    )
  }
  if (status !== "pending") {
    return refuse("not_pending", "Only pending requests can be approved.")
  }
  return { ok: true, value: "confirmed" }
}

/** The last moment the requester can withdraw or cancel without penalty. */
export function cancellableUntil(booking: BookingState): Date | null {
  if (booking.status === "pending") return booking.expiresAt
  if (booking.status === "confirmed") {
    return new Date(
      booking.startsAt.getTime() - CANCEL_CUTOFF_HOURS * 3_600_000
    )
  }
  return null
}

/**
 * The requester withdraws a pending request before its deadline, or cancels
 * a confirmed booking: in time at or before two hours ahead, otherwise a
 * no-show, and never once it has started.
 */
export function decideUserCancellation(
  booking: BookingState,
  now: Date
): Decision<"cancelled" | "no_show"> {
  const status = effectiveStatus(booking, now)
  if (status === "pending") return { ok: true, value: "cancelled" }
  if (status !== "confirmed") {
    return refuse("not_active", "This booking is no longer active.")
  }
  if (now >= booking.startsAt) {
    return refuse("already_started", "This booking has already started.")
  }
  const deadline = cancellableUntil(booking)!
  return { ok: true, value: now <= deadline ? "cancelled" : "no_show" }
}

/** An Admin can block a pending or confirmed booking that has not ended. */
export function decideBlock(
  booking: BookingState,
  now: Date
): Decision<"blocked"> {
  const status = effectiveStatus(booking, now)
  if (status !== "pending" && status !== "confirmed") {
    return refuse(
      "not_active",
      "Only pending or confirmed bookings can be blocked."
    )
  }
  if (booking.endsAt <= now) {
    return refuse("already_ended", "This booking has already ended.")
  }
  return { ok: true, value: "blocked" }
}
