import type { BadgeProps } from "@workspace/ui/components/reui/badge"

import { DotBadge } from "@/components/dot-badge"

import type { BookingStatus } from "./api"

const STATUS: Record<
  BookingStatus,
  { label: string; variant: BadgeProps["variant"] }
> = {
  pending: { label: "Pending approval", variant: "warning-light" },
  confirmed: { label: "Confirmed", variant: "success-light" },
  expired: { label: "Expired", variant: "secondary" },
  cancelled: { label: "Cancelled", variant: "secondary" },
  no_show: { label: "No-show", variant: "destructive-light" },
  blocked: { label: "Blocked", variant: "invert-light" },
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const { label, variant } = STATUS[status]
  return <DotBadge variant={variant}>{label}</DotBadge>
}
