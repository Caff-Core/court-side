import { DotBadge } from "@/components/dot-badge"

import type { AccountStatus } from "./types"

const STATUS = {
  pending: { label: "Pending approval", variant: "warning-light" },
  active: { label: "Active", variant: "success-light" },
  revoked: { label: "Revoked", variant: "destructive-light" },
} as const

export function StatusBadge({ status }: { status: AccountStatus }) {
  const { label, variant } = STATUS[status]
  return <DotBadge variant={variant}>{label}</DotBadge>
}
