import { createFileRoute } from "@tanstack/react-router"

import { notificationsQuery } from "@/features/notifications/api"
import { Inbox } from "@/features/notifications/inbox"
import { requireAccount } from "@/features/session/guards"

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications | Court Side" }] }),
  beforeLoad: ({ context, location }) =>
    requireAccount(context.queryClient, location.href),
  loader: ({ context }) =>
    context.queryClient.prefetchQuery(notificationsQuery),
  component: NotificationsPage,
})

function NotificationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-lg font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Updates about your bookings. Only you can see these.
        </p>
      </div>
      <Inbox />
    </div>
  )
}
