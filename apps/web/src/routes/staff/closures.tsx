import { createFileRoute } from "@tanstack/react-router"

import { closuresQuery } from "@/features/closures/api"
import {
  ClosuresList,
  NewClosureButton,
} from "@/features/closures/closures-manager"
import { requireRole } from "@/features/session/guards"

export const Route = createFileRoute("/staff/closures")({
  head: () => ({ meta: [{ title: "Closures | Court Side" }] }),
  beforeLoad: ({ context, location }) =>
    requireRole(context.queryClient, location.href, ["staff", "admin"]),
  loader: ({ context }) => context.queryClient.prefetchQuery(closuresQuery),
  component: ClosuresPage,
})

function ClosuresPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-lg font-semibold tracking-tight">Closures</h1>
          <p className="text-sm text-muted-foreground">
            Close a facility for maintenance. The public schedule shows it as
            closed, without your reason.
          </p>
        </div>
        <NewClosureButton />
      </div>
      <ClosuresList />
    </div>
  )
}
