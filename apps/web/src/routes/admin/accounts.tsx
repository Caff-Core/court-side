import { createFileRoute } from "@tanstack/react-router"

import { AccountsGrid } from "@/features/accounts/accounts-grid"
import { requireRole } from "@/features/session/guards"

export const Route = createFileRoute("/admin/accounts")({
  head: () => ({ meta: [{ title: "Accounts | Court Side" }] }),
  beforeLoad: async ({ context, location }) => ({
    me: await requireRole(context.queryClient, location.href, ["admin"]),
  }),
  component: AccountsPage,
})

function AccountsPage() {
  const { me } = Route.useRouteContext()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-lg font-semibold tracking-tight">Accounts</h1>
        <p className="text-sm text-muted-foreground">
          Approve new sign-ins, assign roles and revoke access. Every change is
          audited.
        </p>
      </div>
      <AccountsGrid currentAccountId={me.id} />
    </div>
  )
}
