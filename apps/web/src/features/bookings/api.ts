import { queryOptions, type QueryClient } from "@tanstack/react-query"

import { api, ApiError } from "@/lib/api"

export type BookingStatus =
  "pending" | "confirmed" | "expired" | "cancelled" | "no_show" | "blocked"

export type Booking = {
  id: string
  facility: { slug: string; name: string; timeZone: string }
  startsAt: string
  endsAt: string
  status: BookingStatus
  /** Approval deadline while pending. */
  expiresAt: string | null
  /** Admin's block reason, shown only to the booker and Admins. */
  reason: string | null
  /** Whether a block still holds the time. */
  blocked: boolean
  /** Last moment to cancel without it counting as a no-show. */
  cancellableUntil: string | null
  createdAt: string
}

export type AdminBooking = Booking & {
  account: { id: string; name: string; email: string }
}

export type AdminBookingFilter = "pending" | "upcoming" | "blocked"

export type Interval = { startsAt: string; endsAt: string }

/** A booking request's answer: a booking, or why it was refused. */
export type RequestOutcome =
  | { kind: "created"; booking: Pick<Booking, "id" | "status" | "expiresAt"> }
  | { kind: "unavailable"; message: string; alternatives: Interval[] }
  | { kind: "limit"; message: string }

export const myBookingsQuery = queryOptions({
  queryKey: ["bookings", "mine"],
  queryFn: () => api<Booking[]>("/api/bookings/mine"),
})

export const adminBookingsQuery = (status: AdminBookingFilter) =>
  queryOptions({
    queryKey: ["bookings", "admin", status],
    queryFn: () => api<AdminBooking[]>(`/api/admin/bookings?status=${status}`),
  })

/**
 * Sends one booking submission. The caller keeps the same key for retries of
 * the same request, so a lost response never books twice.
 */
export async function requestBooking(
  input: { facility: string } & Interval,
  key: string
): Promise<RequestOutcome> {
  try {
    const booking = await api<Booking>("/api/bookings", {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(input),
    })
    return { kind: "created", booking }
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      const body = error.body as {
        code?: string
        alternatives?: Interval[]
      }
      if (body.code === "booking_limit") {
        return { kind: "limit", message: error.message }
      }
      return {
        kind: "unavailable",
        message: error.message,
        alternatives: body.alternatives ?? [],
      }
    }
    throw error
  }
}

export const cancelBooking = (id: string) =>
  api<Booking>(`/api/bookings/${id}/cancel`, { method: "POST" })

export const approveBooking = (id: string) =>
  api<Booking>(`/api/admin/bookings/${id}/approve`, { method: "POST" })

export const blockBooking = (id: string, reason: string) =>
  api<Booking>(`/api/admin/bookings/${id}/block`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })

export const unblockBooking = (id: string) =>
  api<Booking>(`/api/admin/bookings/${id}/unblock`, { method: "POST" })

/** After any booking write, the schedule and every booking list may differ. */
export function invalidateBookingData(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["availability"] }),
    queryClient.invalidateQueries({ queryKey: ["bookings"] }),
  ])
}
