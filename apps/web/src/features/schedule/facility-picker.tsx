import { useQuery } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@workspace/ui/components/field"
import {
  RadioGroup,
  RadioGroupItem,
} from "@workspace/ui/components/radio-group"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/reui/alert"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { CircleAlertIcon } from "lucide-react"

import { errorMessage } from "@/lib/api"

import { facilitiesQuery } from "./api"

/**
 * Facilities as a radio group (adapted from ReUI c-radio-group-7): a handful
 * of exclusive options stay visible, and arrow keys move between them.
 */
export function FacilityPicker(props: {
  selected: string | undefined
  onSelect: (slug: string) => void
}) {
  const facilities = useQuery(facilitiesQuery)

  return (
    <FieldSet className="min-w-0">
      <FieldLegend id="facility-legend" variant="label">
        Facility
      </FieldLegend>

      {facilities.isPending && (
        <div
          role="status"
          aria-label="Loading facilities"
          className="flex flex-col gap-3"
        >
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-18 w-full rounded-xl" />
          ))}
        </div>
      )}

      {facilities.isError && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Facilities did not load</AlertTitle>
          <AlertDescription>{errorMessage(facilities.error)}</AlertDescription>
          <AlertAction>
            <Button
              size="sm"
              variant="outline"
              onClick={() => facilities.refetch()}
            >
              Retry
            </Button>
          </AlertAction>
        </Alert>
      )}

      {facilities.data?.length === 0 && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No facilities yet</EmptyTitle>
            <EmptyDescription>
              Facilities appear here once they are added.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              size="sm"
              variant="outline"
              onClick={() => facilities.refetch()}
            >
              Refresh
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {facilities.data && facilities.data.length > 0 && (
        <RadioGroup
          aria-labelledby="facility-legend"
          value={props.selected ?? null}
          onValueChange={(value) => props.onSelect(String(value))}
        >
          {facilities.data.map((facility) => (
            <FieldLabel
              key={facility.slug}
              htmlFor={`facility-${facility.slug}`}
            >
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>{facility.name}</FieldTitle>
                  <FieldDescription>
                    {facility.sport} ·{" "}
                    {facility.requiresApproval
                      ? "Admin approval"
                      : "Instant confirmation"}
                  </FieldDescription>
                </FieldContent>
                <RadioGroupItem
                  value={facility.slug}
                  id={`facility-${facility.slug}`}
                />
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>
      )}
    </FieldSet>
  )
}
