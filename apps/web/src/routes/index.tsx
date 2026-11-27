import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { RequestBookingDialog } from "@/features/bookings/request-booking-dialog"
import { AccessNotice } from "@/features/schedule/access-notice"
import {
  availabilityQuery,
  facilitiesQuery,
  type DayAvailability,
} from "@/features/schedule/api"
import { DaySchedule } from "@/features/schedule/day-schedule"
import { FacilityPicker } from "@/features/schedule/facility-picker"
import { meQuery } from "@/features/session/session"

const searchSchema = z.object({
  facility: z.string().min(1).optional().catch(undefined),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Schedule | Court Side" }] }),
  loaderDeps: ({ search }) => ({
    facility: search.facility,
    date: search.date,
  }),
  // Prefetch only: the screen reads the same queries and owns their loading
  // and error states, so a failed load never blanks the page.
  loader: async ({ context: { queryClient }, deps }) => {
    const facilities = await queryClient
      .ensureQueryData(facilitiesQuery)
      .catch(() => [])
    const slug = deps.facility ?? facilities[0]?.slug
    if (slug)
      await queryClient.prefetchQuery(availabilityQuery(slug, deps.date))
  },
  component: SchedulePage,
})

function SchedulePage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const facilities = useQuery(facilitiesQuery)
  const slug = search.facility ?? facilities.data?.[0]?.slug
  const facility = facilities.data?.find((item) => item.slug === slug)
  const me = useQuery(meQuery)
  const canBook = me.data?.status === "active"
  const [request, setRequest] = useState<{
    day: DayAvailability
    index: number
  } | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-lg font-semibold tracking-tight">Schedule</h1>
        <p className="text-sm text-muted-foreground">
          Open slots, bookings and closures for the next 14 days, in each
          facility's local time.
        </p>
      </div>
      <AccessNotice />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <FacilityPicker
          selected={slug}
          onSelect={(next) =>
            navigate({ search: (prev) => ({ ...prev, facility: next }) })
          }
        />
        {slug && (
          <DaySchedule
            facility={facility}
            slug={slug}
            date={search.date}
            onDateChange={(date) =>
              navigate({ search: (prev) => ({ ...prev, date }) })
            }
            onRequest={
              canBook ? (day, index) => setRequest({ day, index }) : undefined
            }
          />
        )}
        {request && (
          <RequestBookingDialog
            key={`${request.day.facility.slug}:${request.day.slots[request.index]?.startsAt}`}
            day={request.day}
            startIndex={request.index}
            onClose={() => setRequest(null)}
          />
        )}
      </div>
    </div>
  )
}
