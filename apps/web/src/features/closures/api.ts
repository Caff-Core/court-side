import { queryOptions, type QueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"

export type Closure = {
  id: string
  facility: { slug: string; name: string; timeZone: string }
  startsAt: string
  endsAt: string
  reason: string
  cancelledBookings: number
  endedAt: string | null
  createdAt: string
  createdBy: { name: string }
}

/** Wall-clock times in the facility's zone, as datetime-local inputs give. */
export type NewClosure = {
  facility: string
  startsLocal: string
  endsLocal: string
  reason: string
}

export const closuresQuery = queryOptions({
  queryKey: ["closures"],
  queryFn: () => api<Closure[]>("/api/closures"),
})

/** One key per form submission; a retry of the same form reuses it. */
export const createClosure = (input: NewClosure, key: string) =>
  api<Closure>("/api/closures", {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify(input),
  })

export const endClosure = (id: string) =>
  api<Closure>(`/api/closures/${id}/end`, { method: "POST" })

/** A closure changes the schedule, cancels bookings and the closure list. */
export function invalidateClosureData(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["closures"] }),
    queryClient.invalidateQueries({ queryKey: ["availability"] }),
    queryClient.invalidateQueries({ queryKey: ["bookings"] }),
    queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  ])
}
