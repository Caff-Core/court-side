import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { BellIcon, LogOutIcon, UserIcon } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@workspace/ui/components/reui/badge"

import { unreadCountQuery } from "@/features/notifications/api"
import { meQuery, signOut } from "@/features/session/session"
import { ROLE_LABELS } from "@/features/session/types"
import { errorMessage } from "@/lib/api"

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("")
}

const navLinkClass =
  "text-muted-foreground hover:text-foreground data-[status=active]:text-foreground rounded-md text-sm font-medium transition-colors"

export function AppHeader() {
  const { data: me } = useQuery(meQuery)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  async function handleSignOut() {
    try {
      await signOut(queryClient)
      await navigate({ to: "/" })
    } catch (error) {
      toast.error("Could not sign out", { description: errorMessage(error) })
    }
  }

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
        <Link to="/" className="text-sm font-semibold tracking-tight">
          Court Side
        </Link>
        <nav aria-label="Main" className="flex items-center gap-4">
          <Link to="/" className={navLinkClass} activeOptions={{ exact: true }}>
            Schedule
          </Link>
          {me?.status === "active" && (
            <Link to="/bookings" className={navLinkClass}>
              My bookings
            </Link>
          )}
          {me?.status === "active" &&
            (me.role === "staff" || me.role === "admin") && (
              <Link to="/staff/closures" className={navLinkClass}>
                Closures
              </Link>
            )}
          {me?.status === "active" && me.role === "admin" && (
            <>
              <Link to="/admin/bookings" className={navLinkClass}>
                Requests
              </Link>
              <Link to="/admin/accounts" className={navLinkClass}>
                Accounts
              </Link>
            </>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {me && <NotificationsLink />}
          {me ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="sm" aria-label="Account menu" />
                }
              >
                <Avatar className="size-6">
                  {me.image && <AvatarImage src={me.image} alt="" />}
                  <AvatarFallback className="text-xs">
                    {initials(me.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline">{me.name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">
                      {me.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {me.role ? ROLE_LABELS[me.role] : "Pending approval"}
                    </span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link to="/account" />}>
                  <UserIcon />
                  Your account
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOutIcon />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/sign-in" className={buttonVariants({ size: "sm" })}>
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

/** Bell link to the inbox with the unread count, refreshed in the background. */
function NotificationsLink() {
  const { data } = useQuery(unreadCountQuery)
  const count = data?.count ?? 0
  return (
    <Link
      to="/notifications"
      aria-label={
        count > 0 ? `Notifications, ${count} unread` : "Notifications"
      }
      className={buttonVariants({ variant: "ghost", size: "sm" })}
    >
      <BellIcon aria-hidden="true" />
      {count > 0 && (
        <Badge variant="info" size="sm" className="tabular-nums">
          {count}
        </Badge>
      )}
    </Link>
  )
}
