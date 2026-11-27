import { useQuery } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Input } from "@workspace/ui/components/input"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/reui/alert"
import type { BadgeProps } from "@workspace/ui/components/reui/badge"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
} from "lucide-react"

import { DotBadge } from "@/components/dot-badge"
import { ApiError, errorMessage } from "@/lib/api"

import {
  availabilityQuery,
  type DayAvailability,
  type Facility,
  type SlotStatus,
} from "./api"
import { formatDay, formatTimeRange, zoneName } from "./format"

const SLOT_STATUS: Record<
  SlotStatus,
  { label: string; variant: BadgeProps["variant"] }
> = {
  available: { label: "Available", variant: "success-light" },
  pending: { label: "Pending", variant: "warning-light" },
  booked: { label: "Booked", variant: "info-light" },
  event: { label: "Event", variant: "primary-light" },
  blocked: { label: "Blocked", variant: "invert-light" },
  closed: { label: "Closed", variant: "destructive-light" },
  past: { label: "Past", variant: "secondary" },
}

export function DaySchedule(props: {
  facility: Facility | undefined
  slug: string
  date: string | undefined
  onDateChange: (date: string | undefined) => void
}) {
  const day = useQuery(availabilityQuery(props.slug, props.date))
  const data = day.data

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>
          <h2>{props.facility?.name ?? data?.facility.name ?? "Schedule"}</h2>
        </CardTitle>
        {props.facility && (
          <CardDescription>
            {props.facility.sport} ·{" "}
            {props.facility.requiresApproval
              ? "Requests wait for Admin approval"
              : "Requests confirm instantly"}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {day.isPending && <DaySkeleton />}
        {day.isError && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>The schedule did not load</AlertTitle>
            <AlertDescription>{errorMessage(day.error)}</AlertDescription>
            <AlertAction className="flex gap-2">
              {day.error instanceof ApiError && day.error.status === 400 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => props.onDateChange(undefined)}
                >
                  Go to today
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => day.refetch()}>
                Retry
              </Button>
            </AlertAction>
          </Alert>
        )}
        {data && (
          <>
            {/* The stepper sits beside the day, not in the card header, so a
                narrow screen keeps the facility name on readable lines. */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <DaySummary day={data} />
              <DayStepper day={data} onDateChange={props.onDateChange} />
            </div>
            <DayBody day={data} onDateChange={props.onDateChange} />
          </>
        )}
      </CardContent>
    </Card>
  )
}

function DayStepper(props: {
  day: DayAvailability
  onDateChange: (date: string | undefined) => void
}) {
  const { day } = props
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous day"
        disabled={!day.previousDate}
        onClick={() => day.previousDate && props.onDateChange(day.previousDate)}
      >
        <ChevronLeftIcon aria-hidden="true" />
      </Button>
      <Input
        type="date"
        aria-label="Date"
        value={day.date}
        min={day.firstDate}
        max={day.lastDate}
        required
        onChange={(event) => {
          const value = event.target.value
          if (value && value >= day.firstDate && value <= day.lastDate) {
            props.onDateChange(value)
          }
        }}
        className="w-40"
      />
      <Button
        variant="outline"
        size="icon"
        aria-label="Next day"
        disabled={!day.nextDate}
        onClick={() => day.nextDate && props.onDateChange(day.nextDate)}
      >
        <ChevronRightIcon aria-hidden="true" />
      </Button>
    </div>
  )
}

function DayBody(props: {
  day: DayAvailability
  onDateChange: (date: string | undefined) => void
}) {
  const { day } = props
  const { timeZone } = day.facility
  const dayLabel = formatDay(day.dayStartsAt, timeZone)

  if (!day.open || day.slots.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Closed on this day</EmptyTitle>
          <EmptyDescription>
            {day.facility.name} has no opening hours on {dayLabel}.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {day.nextDate ? (
            <Button size="sm" onClick={() => props.onDateChange(day.nextDate!)}>
              Show next day
            </Button>
          ) : (
            <Button size="sm" onClick={() => props.onDateChange(undefined)}>
              Back to today
            </Button>
          )}
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <ul
      role="list"
      aria-label={`Slots for ${dayLabel}`}
      className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,16.5rem),1fr))] gap-2"
    >
      {day.slots.map((slot) => {
        const { label, variant } = SLOT_STATUS[slot.status]
        return (
          <li
            key={slot.startsAt}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm",
              slot.status === "past" && "text-muted-foreground"
            )}
          >
            <time
              dateTime={slot.startsAt}
              className="whitespace-nowrap tabular-nums"
            >
              {formatTimeRange(slot.startsAt, slot.endsAt, timeZone)}
            </time>
            <DotBadge variant={variant}>{label}</DotBadge>
          </li>
        )
      })}
    </ul>
  )
}

function DaySummary({ day }: { day: DayAvailability }) {
  const { timeZone } = day.facility
  const open = day.slots.filter((slot) => slot.status === "available").length
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-medium">
        {formatDay(day.dayStartsAt, timeZone)}
      </h3>
      {day.open && day.opensAt && day.closesAt && (
        <>
          <p className="text-xs text-muted-foreground">
            Open {formatTimeRange(day.opensAt, day.closesAt, timeZone)} ·{" "}
            {zoneName(timeZone, day.dayStartsAt)}
          </p>
          <p role="status" className="text-xs text-muted-foreground">
            {open} open {open === 1 ? "slot" : "slots"}
          </p>
        </>
      )}
    </div>
  )
}

function DaySkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the schedule"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}
