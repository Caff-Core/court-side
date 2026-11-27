import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/reui/alert"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { CircleAlertIcon, ClockIcon } from "lucide-react"

import { requireAccount } from "@/features/session/guards"
import { meQuery } from "@/features/session/session"
import { StatusBadge } from "@/features/session/status-badge"
import { ROLE_LABELS } from "@/features/session/types"
import { errorMessage } from "@/lib/api"

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Your account | Court Side" }] }),
  beforeLoad: ({ context, location }) =>
    requireAccount(context.queryClient, location.href),
  component: AccountPage,
})

function AccountPage() {
  const me = useQuery(meQuery)

  return (
    <div className="flex flex-1 items-start justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <h1>Your account</h1>
          </CardTitle>
          <CardDescription>Your access to Court Side.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {me.isPending && (
            <div
              role="status"
              className="flex flex-col gap-2"
              aria-busy="true"
              aria-label="Loading account"
            >
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          )}
          {me.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Account details did not load</AlertTitle>
              <AlertDescription>{errorMessage(me.error)}</AlertDescription>
              <AlertAction>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => me.refetch()}
                >
                  Retry
                </Button>
              </AlertAction>
            </Alert>
          )}
          {me.data && (
            <>
              <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">{me.data.name}</dd>
                <dt className="text-muted-foreground">Email</dt>
                <dd>{me.data.email}</dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge status={me.data.status} />
                </dd>
                <dt className="text-muted-foreground">Role</dt>
                <dd>{me.data.role ? ROLE_LABELS[me.data.role] : "None yet"}</dd>
              </dl>
              {me.data.status === "pending" && (
                <Alert variant="warning">
                  <ClockIcon />
                  <AlertTitle>Waiting for approval</AlertTitle>
                  <AlertDescription>
                    An Admin reviews new accounts. You can browse the schedule
                    meanwhile; booking opens once you are approved.
                  </AlertDescription>
                </Alert>
              )}
              <Button
                variant="outline"
                className="self-start"
                render={<Link to="/" />}
                nativeButton={false}
              >
                Browse the schedule
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
