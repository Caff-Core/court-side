import { useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/reui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import { CircleAlertIcon, TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import type { DayAvailability } from "@/features/schedule/api"
import { formatTimeRange, formatWhen } from "@/features/schedule/format"
import { errorMessage } from "@/lib/api"

import {
  invalidateBookingData,
  requestBooking,
  type RequestOutcome,
} from "./api"

/** Longest single request the dialog offers, in 30-minute slots. */
const MAX_SLOTS = 8

function durationLabel(slots: number) {
  const minutes = slots * 30
  if (minutes < 60) return `${minutes} minutes`
  const hours = minutes / 60
  return `${hours} ${hours === 1 ? "hour" : "hours"}`
}

/**
 * Requests a range starting at a chosen open slot. One Idempotency-Key per
 * range: retrying after a failed response resends the same key, so a
 * request that did reach the server is never booked twice.
 */
export function RequestBookingDialog(props: {
  day: DayAvailability
  startIndex: number | null
  onClose: () => void
}) {
  const { day } = props
  const queryClient = useQueryClient()
  const [start, setStart] = useState(props.startIndex ?? 0)
  const [length, setLength] = useState(1)
  const [outcome, setOutcome] = useState<RequestOutcome | null>(null)

  // Consecutive open slots from the chosen start bound the duration.
  const maxLength = useMemo(() => {
    let count = 0
    for (let i = start; i < day.slots.length && count < MAX_SLOTS; i++) {
      if (day.slots[i]!.status !== "available") break
      count++
    }
    return Math.max(count, 1)
  }, [day.slots, start])
  const slots = Math.min(length, maxLength)
  const range = {
    startsAt: day.slots[start]?.startsAt ?? "",
    endsAt: day.slots[start + slots - 1]?.endsAt ?? "",
  }
  const key = useMemo(
    () => crypto.randomUUID(),
    // A new range is a new submission; the same range keeps its key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [range.startsAt, range.endsAt]
  )

  const submit = useMutation({
    mutationFn: () =>
      requestBooking({ facility: day.facility.slug, ...range }, key),
    onSuccess: async (result) => {
      setOutcome(result)
      await invalidateBookingData(queryClient)
      if (result.kind === "created") {
        toast.success(
          result.booking.status === "pending"
            ? "Request sent for approval"
            : "Booking confirmed",
          {
            description: `${day.facility.name}, ${formatWhen(range.startsAt, range.endsAt, day.facility.timeZone)}`,
          }
        )
        props.onClose()
      }
    },
  })

  const chooseAlternative = (startsAt: string, endsAt: string) => {
    const index = day.slots.findIndex((slot) => slot.startsAt === startsAt)
    const last = day.slots.findIndex((slot) => slot.endsAt === endsAt)
    if (index < 0 || last < index) return
    setStart(index)
    setLength(last - index + 1)
    setOutcome(null)
    submit.reset()
  }

  const { timeZone } = day.facility
  return (
    <Dialog
      open={props.startIndex !== null}
      onOpenChange={(open) => {
        if (!open && !submit.isPending) props.onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request {day.facility.name}</DialogTitle>
          <DialogDescription>
            {day.facility.requiresApproval
              ? "An Admin reviews this request. It holds the time until it is approved or its deadline passes."
              : "This facility confirms requests straight away."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted-foreground">When</dt>
            <dd className="font-medium">
              {formatWhen(range.startsAt, range.endsAt, timeZone)}
            </dd>
            <dt className="text-muted-foreground">
              <label htmlFor="booking-duration">Duration</label>
            </dt>
            <dd>
              <Select
                value={String(slots)}
                onValueChange={(value) => {
                  setLength(Number(value))
                  setOutcome(null)
                }}
              >
                <SelectTrigger id="booking-duration" className="w-40">
                  <SelectValue>{durationLabel(slots)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: maxLength }, (_, i) => i + 1).map(
                    (count) => (
                      <SelectItem key={count} value={String(count)}>
                        {durationLabel(count)}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </dd>
          </dl>

          {outcome?.kind === "unavailable" && (
            <Alert variant="warning">
              <TriangleAlertIcon />
              <AlertTitle>That time was just taken</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                {outcome.alternatives.length > 0 ? (
                  <>
                    <span>These times of the same length are still open:</span>
                    <span className="flex flex-wrap gap-2">
                      {outcome.alternatives.map((alt) => (
                        <Button
                          key={alt.startsAt}
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            chooseAlternative(alt.startsAt, alt.endsAt)
                          }
                        >
                          {formatTimeRange(alt.startsAt, alt.endsAt, timeZone)}
                        </Button>
                      ))}
                    </span>
                  </>
                ) : (
                  <span>No other time of that length is open that day.</span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {outcome?.kind === "limit" && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Booking limit reached</AlertTitle>
              <AlertDescription>{outcome.message}</AlertDescription>
              <AlertAction>
                <Link
                  to="/bookings"
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  My bookings
                </Link>
              </AlertAction>
            </Alert>
          )}

          {submit.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>The request did not go through</AlertTitle>
              <AlertDescription>{errorMessage(submit.error)}</AlertDescription>
              <AlertAction>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => submit.mutate()}
                >
                  Retry
                </Button>
              </AlertAction>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={submit.isPending}
            onClick={props.onClose}
          >
            Cancel
          </Button>
          <Button
            disabled={submit.isPending || outcome?.kind === "unavailable"}
            onClick={() => submit.mutate()}
          >
            {submit.isPending && <Spinner />}
            {day.facility.requiresApproval ? "Send request" : "Book"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
