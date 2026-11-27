import { Badge } from "@workspace/ui/components/reui/badge"

import type { AccountStatus } from "./types"

const STATUS = {
  pending: { label: "Pending approval", variant: "warning-light" },
  active: { label: "Active", variant: "success-light" },
  revoked: { label: "Revoked", variant: "destructive-light" },
} as const

export function StatusBadge({ status }: { status: AccountStatus }) {
  const { label, variant } = STATUS[status]
  return (
    <Badge variant={variant}>
      {/* Dot takes the variant's text color; the label carries the meaning. */}
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  )
}
