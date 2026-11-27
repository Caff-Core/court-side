import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { buttonVariants } from "@workspace/ui/components/button"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/reui/alert"
import { ClockIcon, InfoIcon } from "lucide-react"

import { meQuery } from "@/features/session/session"

/**
 * Explains what a visitor or pending user can do next. Booking comes later.
 * Navigation stays a real link styled with buttonVariants: a Base UI Button
 * rendering a link would announce it as a button.
 */
export function AccessNotice() {
  const me = useQuery(meQuery)
  if (me.isPending || me.isError) return null

  if (!me.data) {
    return (
      <Alert variant="info">
        <InfoIcon />
        <AlertTitle>Anyone can browse the schedule</AlertTitle>
        <AlertDescription>
          Booker names and private reasons stay hidden. Sign in with Google to
          request a court.
        </AlertDescription>
        <AlertAction>
          <Link
            to="/sign-in"
            search={{ redirect: "/" }}
            className={buttonVariants({ size: "sm" })}
          >
            Sign in to request a court
          </Link>
        </AlertAction>
      </Alert>
    )
  }

  if (me.data.status === "pending") {
    return (
      <Alert variant="warning">
        <ClockIcon />
        <AlertTitle>Waiting for approval</AlertTitle>
        <AlertDescription>
          You can browse the schedule now. Booking opens once an Admin approves
          your account.
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
    )
  }

  return null
}
