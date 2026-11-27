import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { toast } from "sonner"

import { formatMoment, formatWhen } from "@/features/schedule/format"
import { errorMessage } from "@/lib/api"

import {
  cancelBooking,
  invalidateBookingData,
  myBookingsQuery,
  type Booking,
} from "./api"
import { RecordsGrid, type RecordColumns } from "@/components/records-grid"
import { bookingColumns } from "./columns"

/** Whether cancelling now is free, a no-show, or no longer possible. */
function cancellation(booking: Booking, now: number) {
  if (booking.status === "pending") return "withdraw" as const
  if (booking.status !== "confirmed") return null
  if (now >= Date.parse(booking.startsAt)) return null
  return booking.cancellableUntil && now <= Date.parse(booking.cancellableUntil)
    ? ("cancel" as const)
    : ("no_show" as const)
}

export function MyBookings() {
  const queryClient = useQueryClient()
  const bookings = useQuery(myBookingsQuery)
  const [target, setTarget] = useState<Booking | null>(null)
  // Read the clock when the dialog opens, not during render of every row.
  const [openedAt, setOpenedAt] = useState(0)

  const cancel = useMutation({
    mutationFn: (booking: Booking) => cancelBooking(booking.id),
    onSuccess: async (booking) => {
      setTarget(null)
      toast.success(
        booking.status === "no_show"
          ? "Cancelled and recorded as a no-show"
          : "Booking cancelled",
        { description: booking.facility.name }
      )
      await invalidateBookingData(queryClient)
    },
    onError: (error) =>
      toast.error("Could not cancel", { description: errorMessage(error) }),
  })

  const columns = useMemo<RecordColumns<Booking>>(
    () => [
      ...bookingColumns<Booking>(),
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const booking = row.original
          if (booking.status !== "pending" && booking.status !== "confirmed") {
            return null
          }
          return (
            <Button
              size="sm"
              variant="outline"
              aria-label={`${booking.status === "pending" ? "Withdraw" : "Cancel"} ${booking.facility.name}, ${formatWhen(booking.startsAt, booking.endsAt, booking.facility.timeZone)}`}
              onClick={() => {
                setOpenedAt(Date.now())
                setTarget(booking)
              }}
            >
              {booking.status === "pending" ? "Withdraw" : "Cancel"}
            </Button>
          )
        },
        size: 120,
        meta: { skeleton: <Skeleton className="h-8 w-20 rounded-4xl" /> },
      },
    ],
    []
  )

  const kind = target ? cancellation(target, openedAt) : null
  return (
    <>
      <RecordsGrid
        title="Your bookings"
        query={bookings}
        columns={columns}
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No bookings yet</EmptyTitle>
              <EmptyDescription>
                Pick an open slot on the schedule to request a court.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link to="/" className={buttonVariants({ size: "sm" })}>
                Browse the schedule
              </Link>
            </EmptyContent>
          </Empty>
        }
      />

      <AlertDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !cancel.isPending) setTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {kind === "withdraw"
                ? "Withdraw this request?"
                : "Cancel this booking?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {target &&
                `${target.facility.name}, ${formatWhen(target.startsAt, target.endsAt, target.facility.timeZone)}. `}
              {kind === "withdraw" &&
                "The time is released and the request will not be reviewed."}
              {kind === "cancel" &&
                target?.cancellableUntil &&
                `Cancelling before ${formatMoment(target.cancellableUntil, target.facility.timeZone)} releases the time with no penalty.`}
              {kind === "no_show" &&
                "It starts within two hours, so cancelling now releases the time but is recorded as a no-show."}
              {kind === null && "This booking can no longer be cancelled."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancel.isPending}>
              Keep it
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={cancel.isPending || kind === null}
              onClick={() => target && cancel.mutate(target)}
            >
              {kind === "withdraw" ? "Withdraw request" : "Cancel booking"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
