import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { RecordsGrid, type RecordColumns } from "@/components/records-grid"
import { facilitiesQuery } from "@/features/schedule/api"
import { formatWhen, zoneName } from "@/features/schedule/format"
import { errorMessage } from "@/lib/api"

import {
  closuresQuery,
  createClosure,
  endClosure,
  invalidateClosureData,
  type Closure,
} from "./api"

export function NewClosureButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden="true" />
        New closure
      </Button>
      {open && <NewClosureDialog onClose={() => setOpen(false)} />}
    </>
  )
}

export function ClosuresList() {
  const queryClient = useQueryClient()
  const closures = useQuery(closuresQuery)
  const [target, setTarget] = useState<Closure | null>(null)
  const end = useMutation({
    mutationFn: (closure: Closure) => endClosure(closure.id),
    onSuccess: async (closure) => {
      setTarget(null)
      toast.success("Closure ended", { description: closure.facility.name })
      await invalidateClosureData(queryClient)
    },
    onError: (error) =>
      toast.error("Could not end the closure", {
        description: errorMessage(error),
      }),
  })

  const columns = useMemo<RecordColumns<Closure>>(
    () => [
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
          <time dateTime={row.original.startsAt} className="tabular-nums">
            {formatWhen(
              row.original.startsAt,
              row.original.endsAt,
              row.original.facility.timeZone
            )}
          </time>
        ),
        size: 260,
        meta: { skeleton: <Skeleton className="h-4 w-48" /> },
      },
      {
        id: "reason",
        header: () => "Reason",
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="text-foreground">{row.original.reason}</span>
            <span className="text-xs text-muted-foreground">
              By {row.original.createdBy.name} ·{" "}
              {row.original.cancelledBookings === 1
                ? "1 booking cancelled"
                : `${row.original.cancelledBookings} bookings cancelled`}
            </span>
          </div>
        ),
        minSize: 220,
        meta: { autoSize: true, skeleton: <Skeleton className="h-4 w-40" /> },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="outline"
            aria-label={`End closure of ${row.original.facility.name}, ${formatWhen(row.original.startsAt, row.original.endsAt, row.original.facility.timeZone)}`}
            onClick={() => setTarget(row.original)}
          >
            End
          </Button>
        ),
        size: 100,
        meta: { skeleton: <Skeleton className="h-8 w-16 rounded-4xl" /> },
      },
    ],
    []
  )

  return (
    <>
      <RecordsGrid
        title="Current and upcoming closures"
        query={closures}
        columns={columns}
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No closures scheduled</EmptyTitle>
              <EmptyDescription>
                Close a facility for repairs or maintenance. Overlapping
                bookings are cancelled and their bookers notified.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <NewClosureButton />
            </EmptyContent>
          </Empty>
        }
      />
      <AlertDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !end.isPending) setTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this closure?</AlertDialogTitle>
            <AlertDialogDescription>
              {target &&
                `${target.facility.name}, ${formatWhen(target.startsAt, target.endsAt, target.facility.timeZone)}. `}
              The time reopens for booking unless another closure or block
              covers it. Bookings it cancelled stay cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={end.isPending}>
              Keep closed
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={end.isPending}
              onClick={() => target && end.mutate(target)}
            >
              End closure
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function NewClosureDialog(props: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const facilities = useQuery(facilitiesQuery)
  const [facility, setFacility] = useState("")
  const [startsLocal, setStartsLocal] = useState("")
  const [endsLocal, setEndsLocal] = useState("")
  const [reason, setReason] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const selected = facilities.data?.find((f) => f.slug === facility)

  // The same form contents keep their key, so Retry never closes twice.
  const key = useMemo(
    () => crypto.randomUUID(),
    // Changed contents are a new submission and need a new key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [facility, startsLocal, endsLocal, reason]
  )
  const problems = {
    facility: facility === "" ? "Choose a facility." : null,
    startsLocal: startsLocal === "" ? "Choose when the closure starts." : null,
    endsLocal:
      endsLocal === ""
        ? "Choose when the closure ends."
        : startsLocal !== "" && endsLocal <= startsLocal
          ? "The end must be after the start."
          : null,
    reason: reason.trim() === "" ? "Give a reason for the closure." : null,
  }
  const valid = Object.values(problems).every((problem) => problem === null)

  const save = useMutation({
    mutationFn: () =>
      createClosure(
        { facility, startsLocal, endsLocal, reason: reason.trim() },
        key
      ),
    onSuccess: async (closure) => {
      toast.success("Closure saved", {
        description:
          closure.cancelledBookings === 0
            ? `${closure.facility.name}: no bookings were affected.`
            : `${closure.facility.name}: ${closure.cancelledBookings} booking${closure.cancelledBookings === 1 ? "" : "s"} cancelled and notified.`,
      })
      await invalidateClosureData(queryClient)
      props.onClose()
    },
  })
  const show = (field: keyof typeof problems) =>
    submitted ? problems[field] : null

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) props.onClose()
      }}
    >
      <DialogContent>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            setSubmitted(true)
            if (valid) save.mutate()
          }}
        >
          <DialogHeader>
            <DialogTitle>New closure</DialogTitle>
            <DialogDescription>
              Overlapping pending and confirmed bookings that have not ended are
              cancelled, and each booker gets a notification with your reason.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field data-invalid={show("facility") ? true : undefined}>
              <FieldLabel htmlFor="closure-facility">Facility</FieldLabel>
              <Select
                value={facility || null}
                onValueChange={(value) => setFacility(String(value ?? ""))}
              >
                <SelectTrigger
                  id="closure-facility"
                  aria-invalid={show("facility") ? true : undefined}
                >
                  <SelectValue placeholder="Choose a facility">
                    {selected?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {facilities.data?.map((item) => (
                    <SelectItem key={item.slug} value={item.slug}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {show("facility") && <FieldError>{show("facility")}</FieldError>}
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field data-invalid={show("startsLocal") ? true : undefined}>
                <FieldLabel htmlFor="closure-start">Starts</FieldLabel>
                <Input
                  id="closure-start"
                  name="startsLocal"
                  type="datetime-local"
                  required
                  value={startsLocal}
                  aria-invalid={show("startsLocal") ? true : undefined}
                  onChange={(event) => setStartsLocal(event.target.value)}
                />
                {show("startsLocal") && (
                  <FieldError>{show("startsLocal")}</FieldError>
                )}
              </Field>
              <Field data-invalid={show("endsLocal") ? true : undefined}>
                <FieldLabel htmlFor="closure-end">Ends</FieldLabel>
                <Input
                  id="closure-end"
                  name="endsLocal"
                  type="datetime-local"
                  required
                  value={endsLocal}
                  aria-invalid={show("endsLocal") ? true : undefined}
                  onChange={(event) => setEndsLocal(event.target.value)}
                />
                {show("endsLocal") && (
                  <FieldError>{show("endsLocal")}</FieldError>
                )}
              </Field>
            </div>
            <FieldDescription>
              {selected
                ? `Times are in ${selected.name}'s local time (${zoneName(selected.timeZone, new Date(0).toISOString())}).`
                : "Times are in the facility's local time."}
            </FieldDescription>
            <Field data-invalid={show("reason") ? true : undefined}>
              <FieldLabel htmlFor="closure-reason">Reason</FieldLabel>
              <Textarea
                id="closure-reason"
                name="reason"
                required
                maxLength={500}
                value={reason}
                aria-invalid={show("reason") ? true : undefined}
                onChange={(event) => setReason(event.target.value)}
              />
              {show("reason") && <FieldError>{show("reason")}</FieldError>}
            </Field>
          </FieldGroup>
          {save.isError && (
            <FieldError>
              {errorMessage(save.error)}. Check the details and save again.
            </FieldError>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={save.isPending}
              onClick={props.onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Spinner />}
              Save closure
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
