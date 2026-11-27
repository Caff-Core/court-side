import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Badge } from "@workspace/ui/components/reui/badge"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { BellIcon } from "lucide-react"
import { toast } from "sonner"
import { errorMessage } from "@/lib/api"
import {
  invalidateNotifications,
  markAllRead,
  notificationsQuery,
  unreadCountQuery,
} from "./api"

/** ReUI c-dropdown-menu-11, connected to the resident's notification feed. */
export function NotificationsMenu() {
  const [open, setOpen] = useState(false)
  const client = useQueryClient()
  const unread = useQuery(unreadCountQuery)
  const feed = useQuery({ ...notificationsQuery, enabled: open })
  const count = unread.data?.count ?? 0
  const readAll = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => invalidateNotifications(client),
    onError: (error) =>
      toast.error("Could not mark all as read", {
        description: errorMessage(error),
      }),
  })
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            className="relative"
            aria-label={
              count ? `Notifications, ${count} unread` : "Notifications"
            }
          />
        }
      >
        <BellIcon aria-hidden="true" />
        {count > 0 && (
          <Badge
            variant="info-light"
            className="absolute -top-2 -right-2 rounded-full"
            aria-hidden="true"
          >
            {count}
          </Badge>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-80 max-w-[calc(100vw-2rem)]"
        align="end"
        sideOffset={8}
      >
        <DropdownMenuGroup>
          <div className="flex items-center justify-between gap-2">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <Button
              size="sm"
              variant="ghost"
              disabled={!count || readAll.isPending}
              onClick={() => readAll.mutate()}
            >
              Mark all as read
            </Button>
          </div>
          <DropdownMenuSeparator />
          {feed.isPending && (
            <div
              role="status"
              aria-label="Loading notifications"
              className="flex flex-col gap-2 p-2"
            >
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}
          {feed.isError && (
            <div role="alert" className="flex flex-col gap-2 p-2">
              <p className="text-sm">
                Notifications did not load: {errorMessage(feed.error)}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => feed.refetch()}
              >
                Retry
              </Button>
            </div>
          )}
          {feed.data?.length === 0 && (
            <div className="flex flex-col gap-2 p-2">
              <p className="text-sm">No notifications yet.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => feed.refetch()}
              >
                Refresh
              </Button>
            </div>
          )}
          <DropdownMenuGroup>
            {feed.data?.slice(0, 5).map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                render={<Link to="/notifications" />}
                className="flex items-start gap-2"
              >
                <Avatar size="sm">
                  <AvatarFallback>
                    <BellIcon className="size-3" aria-hidden="true" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-sm leading-snug">{notification.message}</p>
                  <span className="text-xs text-muted-foreground">
                    {new Date(notification.createdAt).toLocaleString()}
                  </span>
                </div>
                {!notification.readAt && (
                  <Badge variant="info-light">Unread</Badge>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            render={<Link to="/notifications" />}
            className="justify-center"
          >
            View all notifications
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
