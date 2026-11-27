import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  type ColumnDef,
  type PaginationState,
  useTable,
} from "@tanstack/react-table"
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
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
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
import { Badge } from "@workspace/ui/components/reui/badge"
import {
  DataGrid,
  dataGridFeatures,
  type DataGridFeatures,
} from "@workspace/ui/components/reui/data-grid/data-grid"
import { DataGridColumnHeader } from "@workspace/ui/components/reui/data-grid/data-grid-column-header"
import { DataGridPagination } from "@workspace/ui/components/reui/data-grid/data-grid-pagination"
import { DataGridScrollArea } from "@workspace/ui/components/reui/data-grid/data-grid-scroll-area"
import { DataGridTable } from "@workspace/ui/components/reui/data-grid/data-grid-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  CheckIcon,
  CircleAlertIcon,
  EllipsisIcon,
  ShieldOffIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { initials } from "@/components/app-header"
import { StatusBadge } from "@/features/session/status-badge"
import {
  ROLE_LABELS,
  type AccountStatus,
  type Role,
} from "@/features/session/types"
import { errorMessage } from "@/lib/api"

import {
  accountsQuery,
  approveAccount,
  changeAccountRole,
  revokeAccount,
  type AccountRow,
} from "./api"

type StatusFilter = AccountStatus | "all"

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All statuses",
  pending: "Pending",
  active: "Active",
  revoked: "Revoked",
}

const joinedFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" })

export function AccountsGrid({
  currentAccountId,
}: {
  currentAccountId: string
}) {
  const queryClient = useQueryClient()
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [revokeTarget, setRevokeTarget] = useState<AccountRow | null>(null)

  const hasActiveFilters = searchInput.trim() !== "" || status !== "all"
  const resetToFirstPage = () =>
    setPagination((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }
    )

  // Debounce typing into one server query and return to the first page.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(searchInput.trim())
      resetToFirstPage()
    }, 350)
    return () => window.clearTimeout(timeoutId)
  }, [searchInput])

  const accounts = useQuery(
    accountsQuery({
      search,
      status,
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
    })
  )
  const rows = accounts.data?.items ?? []
  const total = accounts.data?.total ?? 0

  const onChanged = (message: string) => async (account: AccountRow) => {
    toast.success(message, { description: account.name })
    await queryClient.invalidateQueries({ queryKey: ["accounts"] })
  }
  const onFailed = (title: string) => (error: unknown) =>
    toast.error(title, { description: errorMessage(error) })

  const approve = useMutation({
    mutationFn: (account: AccountRow) => approveAccount(account.id),
    onSuccess: onChanged("Approved as Resident"),
    onError: onFailed("Could not approve"),
  })
  const changeRole = useMutation({
    mutationFn: (input: { account: AccountRow; role: Role }) =>
      changeAccountRole(input.account.id, input.role),
    onSuccess: onChanged("Role updated"),
    onError: onFailed("Could not change role"),
  })
  const revoke = useMutation({
    mutationFn: (account: AccountRow) => revokeAccount(account.id),
    onSuccess: async (account) => {
      setRevokeTarget(null)
      await onChanged("Access revoked")(account)
    },
    onError: onFailed("Could not revoke access"),
  })

  const clearFilters = () => {
    setSearchInput("")
    setSearch("")
    setStatus("all")
    resetToFirstPage()
  }

  const columns = useMemo<ColumnDef<DataGridFeatures, AccountRow>[]>(
    () => [
      {
        accessorKey: "name",
        id: "name",
        header: ({ column }) => (
          <DataGridColumnHeader title="Account" column={column} />
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar className="size-7">
              {row.original.image && (
                <AvatarImage src={row.original.image} alt="" />
              )}
              <AvatarFallback>{initials(row.original.name)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2 font-medium text-foreground">
                {row.original.name}
                {row.original.id === currentAccountId && (
                  <Badge variant="secondary" size="sm">
                    You
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {row.original.email}
              </div>
            </div>
          </div>
        ),
        minSize: 240,
        meta: {
          autoSize: true,
          skeleton: (
            <div className="flex items-center gap-3">
              <Skeleton className="size-7 rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
          ),
        },
      },
      {
        accessorKey: "status",
        id: "status",
        header: ({ column }) => (
          <DataGridColumnHeader title="Status" column={column} />
        ),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
        size: 150,
        meta: { skeleton: <Skeleton className="h-5 w-20" /> },
      },
      {
        accessorKey: "role",
        id: "role",
        header: ({ column }) => (
          <DataGridColumnHeader title="Role" column={column} />
        ),
        cell: ({ row }) =>
          row.original.role ? (
            <span className="text-foreground">
              {ROLE_LABELS[row.original.role]}
            </span>
          ) : (
            <span className="text-muted-foreground">None</span>
          ),
        size: 140,
        meta: { skeleton: <Skeleton className="h-4 w-20" /> },
      },
      {
        accessorKey: "createdAt",
        id: "createdAt",
        header: ({ column }) => (
          <DataGridColumnHeader title="Joined" column={column} />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {joinedFormat.format(new Date(row.original.createdAt))}
          </span>
        ),
        size: 130,
        meta: { skeleton: <Skeleton className="h-4 w-24" /> },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <AccountActions
            account={row.original}
            isSelf={row.original.id === currentAccountId}
            onApprove={(account) => approve.mutate(account)}
            onChangeRole={(account, role) =>
              changeRole.mutate({ account, role })
            }
            onRevoke={setRevokeTarget}
          />
        ),
        size: 60,
        meta: { skeleton: <Skeleton className="size-7 rounded-full" /> },
      },
    ],
    [currentAccountId, approve, changeRole]
  )

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: rows,
    manualPagination: true,
    rowCount: total,
    getRowId: (row: AccountRow) => row.id,
    state: { pagination },
    onPaginationChange: setPagination,
    enableSorting: false,
  })

  return (
    <>
      <DataGrid
        table={table}
        recordCount={total}
        isLoading={accounts.isPending}
        emptyMessage={
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No accounts match</EmptyTitle>
              <EmptyDescription>
                {hasActiveFilters
                  ? "Try another name, email or status."
                  : "Accounts appear here after their first sign-in."}
              </EmptyDescription>
            </EmptyHeader>
            {hasActiveFilters && (
              <EmptyContent>
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              </EmptyContent>
            )}
          </Empty>
        }
      >
        <Card className="w-full gap-3 py-3.5">
          <CardHeader className="items-center px-3.5">
            <CardTitle>
              <h2 className="flex items-center gap-2">
                Accounts
                <Badge variant="secondary" size="sm" className="tabular-nums">
                  {total}
                </Badge>
              </h2>
            </CardTitle>
            <CardAction>
              <search className="flex flex-wrap items-center justify-end gap-2">
                <Input
                  type="search"
                  name="q"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  aria-label="Search accounts"
                  placeholder="Search name or email..."
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="w-56"
                />
                <Select
                  value={status}
                  onValueChange={(next) => {
                    setStatus((next ?? "all") as StatusFilter)
                    resetToFirstPage()
                  }}
                >
                  <SelectTrigger className="w-36" aria-label="Filter by status">
                    <SelectValue placeholder="Status">
                      {STATUS_FILTER_LABELS[status]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_FILTER_LABELS) as StatusFilter[]).map(
                      (value) => (
                        <SelectItem key={value} value={value}>
                          {STATUS_FILTER_LABELS[value]}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <XIcon className="size-4" aria-hidden="true" />
                    Clear
                  </Button>
                )}
                {/* Typing is debounced, so this announces once per settled query. */}
                <span role="status" className="sr-only">
                  {accounts.isSuccess &&
                    `${total} ${total === 1 ? "account" : "accounts"}`}
                </span>
              </search>
            </CardAction>
          </CardHeader>
          <CardContent className="border-t p-0">
            {accounts.isError ? (
              <div className="p-3.5">
                <Alert variant="destructive">
                  <CircleAlertIcon />
                  <AlertTitle>Accounts did not load</AlertTitle>
                  <AlertDescription>
                    {errorMessage(accounts.error)}
                  </AlertDescription>
                  <AlertAction>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => accounts.refetch()}
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
          <CardFooter className="border-none bg-transparent! px-3.5 py-0">
            <DataGridPagination />
          </CardFooter>
        </Card>
      </DataGrid>

      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open && !revoke.isPending) setRevokeTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Revoke access for {revokeTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Their sessions end immediately and signing in again will not
              restore access. This change is recorded in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoke.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={revoke.isPending}
              onClick={() => revokeTarget && revoke.mutate(revokeTarget)}
            >
              Revoke access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function AccountActions(props: {
  account: AccountRow
  isSelf: boolean
  onApprove: (account: AccountRow) => void
  onChangeRole: (account: AccountRow, role: Role) => void
  onRevoke: (account: AccountRow) => void
}) {
  const { account } = props
  if (props.isSelf || account.status === "revoked") return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${account.name}`}
          />
        }
      >
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {account.status === "pending" && (
          <DropdownMenuItem onClick={() => props.onApprove(account)}>
            <CheckIcon />
            Approve as Resident
          </DropdownMenuItem>
        )}
        {account.status === "active" && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Change role</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={account.role ?? undefined}
                onValueChange={(role) => {
                  if (role !== account.role)
                    props.onChangeRole(account, role as Role)
                }}
              >
                {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                  <DropdownMenuRadioItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => props.onRevoke(account)}
        >
          <ShieldOffIcon />
          Revoke access
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
