import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { buttonVariants } from "@workspace/ui/components/button"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/reui/alert"
import { ClockIcon } from "lucide-react"

import { myBookingsQuery } from "@/features/bookings/api"
import { MyBookings } from "@/features/bookings/my-bookings"
import { requireAccount } from "@/features/session/guards"
import { meQuery } from "@/features/session/session"

export const Route = createFileRoute("/bookings")({
  head: () => ({ meta: [{ title: "Your bookings | Court Side" }] }),
  beforeLoad: ({ context, location }) =>
    requireAccount(context.queryClient, location.href),
  loader: ({ context }) => context.queryClient.prefetchQuery(myBookingsQuery),
  component: BookingsPage,
})

function BookingsPage() {
  const me = useQuery(meQuery)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-lg font-semibold tracking-tight">Your bookings</h1>
        <p className="text-sm text-muted-foreground">
          Requests and bookings you have made. Cancel at least two hours before
          the start to avoid a no-show.
        </p>
      </div>
      {me.data?.status === "pending" && (
        <Alert variant="warning">
          <ClockIcon />
          <AlertTitle>Waiting for approval</AlertTitle>
          <AlertDescription>
            Booking opens once an Admin approves your account.
          </AlertDescription>
          <AlertAction>
            <Link
              to="/account"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              Your account
            </Link>
          </AlertAction>
        </Alert>
      )}
      <MyBookings />
    </div>
  )
}
