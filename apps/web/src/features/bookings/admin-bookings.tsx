import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "sonner"

import { formatWhen } from "@/features/schedule/format"
import { errorMessage } from "@/lib/api"

import {
  adminBookingsQuery,
  approveBooking,
  blockBooking,
  invalidateBookingData,
  unblockBooking,
  type AdminBooking,
  type AdminBookingFilter,
} from "./api"
import { RecordsGrid, type RecordColumns } from "@/components/records-grid"
import { bookingColumns } from "./columns"

const TABS: Record<AdminBookingFilter, { label: string; empty: string }> = {
  pending: {
    label: "Pending",
    empty: "Requests for approval-only facilities appear here.",
  },
  upcoming: {
    label: "Upcoming",
    empty: "Confirmed and pending bookings that have not ended appear here.",
  },
  blocked: {
    label: "Blocked",
    empty: "Bookings you block appear here until you remove the block.",
  },
}

const describe = (booking: AdminBooking) =>
  `${booking.account.name}, ${booking.facility.name}, ${formatWhen(booking.startsAt, booking.endsAt, booking.facility.timeZone)}`

export function AdminBookings() {
  const [tab, setTab] = useState<AdminBookingFilter>("pending")
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as AdminBookingFilter)}
      className="gap-4"
    >
      <TabsList>
        {(Object.keys(TABS) as AdminBookingFilter[]).map((key) => (
          <TabsTrigger key={key} value={key}>
            {TABS[key].label}
          </TabsTrigger>
        ))}
      </TabsList>
      {(Object.keys(TABS) as AdminBookingFilter[]).map((key) => (
        <TabsContent key={key} value={key}>
          {tab === key && <AdminBookingList filter={key} />}
        </TabsContent>
      ))}
    </Tabs>
  )
}

function AdminBookingList({ filter }: { filter: AdminBookingFilter }) {
  const queryClient = useQueryClient()
  const bookings = useQuery(adminBookingsQuery(filter))
  const [blockTarget, setBlockTarget] = useState<AdminBooking | null>(null)

  const done =
    (message: string) => async (booking: { facility: { name: string } }) => {
      toast.success(message, { description: booking.facility.name })
      await invalidateBookingData(queryClient)
    }
  const failed = (title: string) => (error: unknown) =>
    toast.error(title, { description: errorMessage(error) })

  const approve = useMutation({
    mutationFn: (booking: AdminBooking) => approveBooking(booking.id),
    onSuccess: done("Request approved"),
    onError: failed("Could not approve"),
  })
  const unblock = useMutation({
    mutationFn: (booking: AdminBooking) => unblockBooking(booking.id),
    onSuccess: done("Block removed; the time is open again"),
    onError: failed("Could not remove the block"),
  })

  const columns = useMemo<RecordColumns<AdminBooking>>(
    () => [
      {
        id: "requester",
        header: () => "Requester",
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-foreground">
              {row.original.account.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {row.original.account.email}
            </span>
          </div>
        ),
        minSize: 200,
        meta: {
          autoSize: true,
          skeleton: (
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-36" />
            </div>
          ),
        },
      },
      ...bookingColumns<AdminBooking>(),
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const booking = row.original
          const label = describe(booking)
          return (
            <div className="flex items-center justify-end gap-2">
              {booking.status === "pending" && (
                <Button
                  size="sm"
                  aria-label={`Approve ${label}`}
                  disabled={approve.isPending}
                  onClick={() => approve.mutate(booking)}
                >
                  Approve
                </Button>
              )}
              {(booking.status === "pending" ||
                booking.status === "confirmed") && (
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Block ${label}`}
                  onClick={() => setBlockTarget(booking)}
                >
                  Block
                </Button>
              )}
              {booking.status === "blocked" && booking.blocked && (
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Remove block on ${label}`}
                  disabled={unblock.isPending}
                  onClick={() => unblock.mutate(booking)}
                >
                  Remove block
                </Button>
              )}
            </div>
          )
        },
        size: 200,
        meta: { skeleton: <Skeleton className="h-8 w-28 rounded-4xl" /> },
      },
    ],
    [approve, unblock]
  )

  return (
    <>
      <RecordsGrid
        title={`${TABS[filter].label} bookings`}
        query={bookings}
        columns={columns}
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyTitle>
                Nothing {TABS[filter].label.toLowerCase()}
              </EmptyTitle>
              <EmptyDescription>{TABS[filter].empty}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                size="sm"
                variant="outline"
                onClick={() => bookings.refetch()}
              >
                Refresh
              </Button>
            </EmptyContent>
          </Empty>
        }
      />
      {blockTarget && (
        <BlockDialog
          booking={blockTarget}
          onClose={() => setBlockTarget(null)}
        />
      )}
    </>
  )
}

/** A block needs a reason; the booker sees it in their notification. */
function BlockDialog(props: { booking: AdminBooking; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState("")
  const [touched, setTouched] = useState(false)
  const block = useMutation({
    mutationFn: () => blockBooking(props.booking.id, reason.trim()),
    onSuccess: async () => {
      toast.success("Booking blocked", {
        description: `${props.booking.account.name} has been notified.`,
      })
      await invalidateBookingData(queryClient)
      props.onClose()
    },
  })
  const missing = reason.trim() === ""

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !block.isPending) props.onClose()
      }}
    >
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            setTouched(true)
            if (!missing) block.mutate()
          }}
        >
          <DialogHeader>
            <DialogTitle>Block this booking?</DialogTitle>
            <DialogDescription>
              {describe(props.booking)}. The time stays unavailable until the
              booking would have ended or you remove the block.
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={touched && missing ? true : undefined}>
            <FieldLabel htmlFor="block-reason">Reason</FieldLabel>
            <FieldDescription id="block-reason-hint">
              Sent to {props.booking.account.name}. Never shown on the public
              schedule.
            </FieldDescription>
            <Textarea
              id="block-reason"
              name="reason"
              required
              maxLength={500}
              value={reason}
              aria-describedby="block-reason-hint"
              aria-invalid={touched && missing ? true : undefined}
              onChange={(event) => setReason(event.target.value)}
              onBlur={() => setTouched(true)}
            />
            {touched && missing && (
              <FieldError>Give a reason for the block.</FieldError>
            )}
          </Field>
          {block.isError && (
            <FieldError>{errorMessage(block.error)}</FieldError>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={block.isPending}
              onClick={props.onClose}
            >
              Keep booking
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={block.isPending}
            >
              {block.isPending && <Spinner />}
              Block booking
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
