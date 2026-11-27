import { queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api"

export type Facility = {
  slug: string
  name: string
  sport: string
  requiresApproval: boolean
  timeZone: string
}

export type SlotStatus =
  "available" | "pending" | "booked" | "event" | "blocked" | "closed" | "past"

export type Slot = { startsAt: string; endsAt: string; status: SlotStatus }

/** One local day of public availability. Dates are ISO calendar dates. */
export type DayAvailability = {
  facility: Facility
  date: string
  dayStartsAt: string
  today: string
  firstDate: string
  lastDate: string
  previousDate: string | null
  nextDate: string | null
  open: boolean
  opensAt: string | null
  closesAt: string | null
  slots: Slot[]
}

/**
 * Shared by the route loader (prefetch) and the screen (render), so both
 * read the same cache entry.
 */
export const facilitiesQuery = queryOptions({
  queryKey: ["facilities"],
  queryFn: () => api<Facility[]>("/api/facilities"),
  staleTime: 5 * 60_000,
})

export const availabilityQuery = (slug: string, date: string | undefined) =>
  queryOptions({
    // "today" resolves on the server in the facility's time zone.
    queryKey: ["availability", slug, date ?? "today"],
    queryFn: () => {
      const query = date ? `?${new URLSearchParams({ date })}` : ""
      return api<DayAvailability>(
        `/api/facilities/${encodeURIComponent(slug)}/availability${query}`
      )
    },
  })
