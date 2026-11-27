import { useMemo } from "react"
import type { UseQueryResult } from "@tanstack/react-query"
import { type ColumnDef, useTable } from "@tanstack/react-table"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/reui/alert"
import { Badge } from "@workspace/ui/components/reui/badge"
import {
  DataGrid,
  dataGridFeatures,
  type DataGridFeatures,
} from "@workspace/ui/components/reui/data-grid/data-grid"
import { DataGridScrollArea } from "@workspace/ui/components/reui/data-grid/data-grid-scroll-area"
import { DataGridTable } from "@workspace/ui/components/reui/data-grid/data-grid-table"
import { CircleAlertIcon } from "lucide-react"

import { errorMessage } from "@/lib/api"

export type RecordColumns<T extends { id: string }> = ColumnDef<
  DataGridFeatures,
  T
>[]

/**
 * A record list as a ReUI data grid: loading skeletons from each column's
 * meta, an empty state with an action, and an inline error with Retry.
 */
export function RecordsGrid<T extends { id: string }>(props: {
  title: string
  query: UseQueryResult<T[]>
  columns: RecordColumns<T>
  empty: React.ReactNode
}) {
  const rows = props.query.data ?? []
  // Lists stay short (the API caps them), so one page shows them all.
  const pagination = useMemo(() => ({ pageIndex: 0, pageSize: 200 }), [])
  const table = useTable({
    features: dataGridFeatures,
    columns: props.columns,
    data: rows,
    getRowId: (row: T) => row.id,
    state: { pagination },
    enableSorting: false,
  })

  return (
    <DataGrid
      table={table}
      recordCount={rows.length}
      isLoading={props.query.isPending}
      emptyMessage={props.empty}
    >
      <Card className="w-full gap-3 py-3.5">
        <CardHeader className="items-center px-3.5">
          <CardTitle>
            <h2 className="flex items-center gap-2">
              {props.title}
              {props.query.isSuccess && (
                <Badge variant="secondary" size="sm" className="tabular-nums">
                  {rows.length}
                </Badge>
              )}
            </h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="border-t p-0">
          {props.query.isError ? (
            <div className="p-3.5">
              <Alert variant="destructive">
                <CircleAlertIcon />
                <AlertTitle>{props.title} did not load</AlertTitle>
                <AlertDescription>
                  {errorMessage(props.query.error)}
                </AlertDescription>
                <AlertAction>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => props.query.refetch()}
                  >
                    Retry
                  </Button>
                </AlertAction>
              </Alert>
            </div>
          ) : (
            <DataGridScrollArea>
              <DataGridTable />
            </DataGridScrollArea>
          )}
        </CardContent>
      </Card>
    </DataGrid>
  )
}
