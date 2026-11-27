import { useQuery } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import {
  Frame,
  FramePanel,
  FrameDescription,
  FrameHeader,
  FrameTitle,
} from "@workspace/ui/components/reui/frame"
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
import { EventCalendar } from "@workspace/ui/components/reui/event-calendar/event-calendar"
import { EventCalendarContent } from "@workspace/ui/components/reui/event-calendar/event-calendar-content"
import type { CalendarEvent } from "@workspace/ui/components/reui/event-calendar/event-calendar-types"
import { Badge } from "@workspace/ui/components/reui/badge"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
} from "lucide-react"

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
  /** Present for accounts that may book: opens a request for a slot. */
  onRequest?: (day: DayAvailability, slotIndex: number) => void
}) {
  const day = useQuery(availabilityQuery(props.slug, props.date))
  const data = day.data

  return (
    <Frame className="min-w-0">
      <FrameHeader>
        <FrameTitle>
          <h2>{props.facility?.name ?? data?.facility.name ?? "Schedule"}</h2>
        </FrameTitle>
        {props.facility && (
          <FrameDescription>
            {props.facility.sport} ·{" "}
            {props.facility.requiresApproval
              ? "Requests wait for Admin approval"
              : "Requests confirm instantly"}
          </FrameDescription>
        )}
      </FrameHeader>
      <FramePanel className="flex flex-col gap-4">
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
              <DaySummary day={data} canBook={Boolean(props.onRequest)} />
              <DayStepper day={data} onDateChange={props.onDateChange} />
            </div>
            <DayBody
              day={data}
              onDateChange={props.onDateChange}
              onRequest={props.onRequest}
            />
          </>
        )}
      </FramePanel>
    </Frame>
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
  onRequest?: (day: DayAvailability, slotIndex: number) => void
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

  const events: CalendarEvent<{ index: number; status: SlotStatus }>[] =
    day.slots.map((slot, index) => ({
      id: slot.startsAt,
      title: `${slot.status === "available" && props.onRequest ? "Request " : ""}${formatTimeRange(slot.startsAt, slot.endsAt, timeZone)} · ${SLOT_STATUS[slot.status].label}`,
      start: new Date(slot.startsAt),
      end: new Date(slot.endsAt),
      readOnly: true,
      color: "var(--color-muted-foreground)",
      data: { index, status: slot.status },
    }))
  const hour = (instant: string) =>
    Number(
      new Intl.DateTimeFormat("en", {
        timeZone,
        hour: "numeric",
        hourCycle: "h23",
      }).format(new Date(instant))
    )

  return (
    <EventCalendar
      key={`${day.facility.slug}:${day.date}`}
      className="h-[640px] min-w-0"
      events={events}
      date={new Date(day.dayStartsAt)}
      view="day"
      views={["day"]}
      timeZone={timeZone}
      dayStartHour={day.opensAt ? hour(day.opensAt) : 0}
      dayEndHour={day.closesAt ? hour(day.closesAt) || 24 : 24}
      interval={30}
      scrollToHour={day.opensAt ? hour(day.opensAt) : 0}
      interactions={{ drag: false, resize: false, selectSlot: false }}
      enableShortcuts={false}
      nowIndicator={false}
      onEventClick={(occurrence) => {
        const slot = occurrence.event.data
        if (slot?.status === "available") props.onRequest?.(day, slot.index)
      }}
      renderEvent={({ occurrence }) => {
        const slot = occurrence.event.data!
        return (
          <span className="flex items-center gap-2 text-sm">
            <span className="text-xs whitespace-nowrap tabular-nums sm:text-sm">
              {formatTimeRange(
                occurrence.start.toISOString(),
                occurrence.end.toISOString(),
                timeZone
              )}
            </span>
            <Badge variant={SLOT_STATUS[slot.status].variant}>
              {SLOT_STATUS[slot.status].label}
            </Badge>
          </span>
        )
      }}
    >
      <EventCalendarContent />
    </EventCalendar>
  )
}

function DaySummary({
  day,
  canBook,
}: {
  day: DayAvailability
  canBook: boolean
}) {
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
            {canBook && open > 0 && " · choose one to book it"}
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
