import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
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
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/reui/alert"
import { Badge } from "@workspace/ui/components/reui/badge"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { CircleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import { DotBadge } from "@/components/dot-badge"
import { errorMessage } from "@/lib/api"

import {
  invalidateNotifications,
  markAllRead,
  markRead,
  notificationsQuery,
  type AppNotification,
} from "./api"

const TYPE_LABEL: Record<AppNotification["type"], string> = {
  booking_blocked: "Booking blocked",
  booking_cancelled_closure: "Cancelled by a closure",
}

const receivedFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
})

export function Inbox() {
  const queryClient = useQueryClient()
  const notifications = useQuery(notificationsQuery)
  const unread = notifications.data?.filter((n) => !n.readAt).length ?? 0

  const readOne = useMutation({
    mutationFn: (notification: AppNotification) => markRead(notification.id),
    onSuccess: () => invalidateNotifications(queryClient),
    onError: (error) =>
      toast.error("Could not mark as read", {
        description: errorMessage(error),
      }),
  })
  const readAll = useMutation({
    mutationFn: markAllRead,
    onSuccess: async () => {
      toast.success("All notifications marked as read")
      await invalidateNotifications(queryClient)
    },
    onError: (error) =>
      toast.error("Could not mark all as read", {
        description: errorMessage(error),
      }),
  })

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          <h2 className="flex items-center gap-2">
            Inbox
            {notifications.isSuccess && (
              <Badge variant="secondary" size="sm" className="tabular-nums">
                {unread} unread
              </Badge>
            )}
          </h2>
        </CardTitle>
        <CardAction>
          <Button
            size="sm"
            variant="outline"
            disabled={unread === 0 || readAll.isPending}
            onClick={() => readAll.mutate()}
          >
            Mark all as read
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {notifications.isPending && (
          <div
            role="status"
            aria-label="Loading notifications"
            className="flex flex-col gap-3"
          >
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        )}
        {notifications.isError && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>Notifications did not load</AlertTitle>
            <AlertDescription>
              {errorMessage(notifications.error)}
            </AlertDescription>
            <AlertAction>
              <Button
                size="sm"
                variant="outline"
                onClick={() => notifications.refetch()}
              >
                Retry
              </Button>
            </AlertAction>
          </Alert>
        )}
        {notifications.data?.length === 0 && (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>You're all caught up</EmptyTitle>
              <EmptyDescription>
                Changes to your bookings, such as blocks and closures, appear
                here.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link to="/bookings" className={buttonVariants({ size: "sm" })}>
                Your bookings
              </Link>
            </EmptyContent>
          </Empty>
        )}
        {notifications.data && notifications.data.length > 0 && (
          <ul
            role="list"
            aria-label="Notifications"
            className="flex flex-col gap-2"
          >
            {notifications.data.map((notification) => (
              <li
                key={notification.id}
                className={cn(
                  "flex flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm",
                  notification.readAt && "text-muted-foreground"
                )}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {notification.readAt ? (
                      <span className="text-xs">Read</span>
                    ) : (
                      <DotBadge variant="info-light">New</DotBadge>
                    )}
                    <span className="font-medium text-foreground">
                      {TYPE_LABEL[notification.type]}
                    </span>
                    <time
                      dateTime={notification.createdAt}
                      className="text-xs text-muted-foreground"
                    >
                      {receivedFormat.format(new Date(notification.createdAt))}
                    </time>
                  </div>
                  <p>{notification.message}</p>
                </div>
                {!notification.readAt && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Mark as read: ${TYPE_LABEL[notification.type]}, ${receivedFormat.format(new Date(notification.createdAt))}`}
                    disabled={readOne.isPending}
                    onClick={() => readOne.mutate(notification)}
                  >
                    Mark as read
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
