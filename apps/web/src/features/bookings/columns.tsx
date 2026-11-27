import { Skeleton } from "@workspace/ui/components/skeleton"

import { formatMoment, formatWhen } from "@/features/schedule/format"

import type { Booking } from "./api"
import type { BookingColumns } from "./bookings-grid"
import { BookingStatusBadge } from "./booking-status"

/** Facility, time and status columns shared by every booking list. */
export function bookingColumns<T extends Booking>(): BookingColumns<T> {
  return [
    {
      id: "facility",
      header: () => "Facility",
      cell: ({ row }) => (
        <span className="font-medium text-foreground">
          {row.original.facility.name}
        </span>
      ),
      minSize: 200,
      meta: { autoSize: true, skeleton: <Skeleton className="h-4 w-40" /> },
    },
    {
      id: "when",
      header: () => "When",
      cell: ({ row }) => (
        <time
          dateTime={row.original.startsAt}
          className="whitespace-nowrap tabular-nums"
        >
          {formatWhen(
            row.original.startsAt,
            row.original.endsAt,
            row.original.facility.timeZone
          )}
        </time>
      ),
      size: 230,
      meta: { skeleton: <Skeleton className="h-4 w-44" /> },
    },
    {
      id: "status",
      header: () => "Status",
      cell: ({ row }) => <StatusCell booking={row.original} />,
      minSize: 200,
      meta: { autoSize: true, skeleton: <Skeleton className="h-5 w-24" /> },
    },
  ]
}

function StatusCell({ booking }: { booking: Booking }) {
  const { timeZone } = booking.facility
  return (
    <div className="flex flex-col items-start gap-1">
      <BookingStatusBadge status={booking.status} />
      {booking.status === "pending" && booking.expiresAt && (
        <span className="text-xs text-muted-foreground">
          Approve by {formatMoment(booking.expiresAt, timeZone)}
        </span>
      )}
      {booking.status === "blocked" && booking.reason && (
        <span className="text-xs text-muted-foreground">
          {booking.blocked ? "" : "Block removed · "}
          {booking.reason}
        </span>
      )}
    </div>
  )
}
