import { createFileRoute } from "@tanstack/react-router"

import { AdminBookings } from "@/features/bookings/admin-bookings"
import { adminBookingsQuery } from "@/features/bookings/api"
import { requireRole } from "@/features/session/guards"

export const Route = createFileRoute("/admin/bookings")({
  head: () => ({ meta: [{ title: "Requests | Court Side" }] }),
  beforeLoad: ({ context, location }) =>
    requireRole(context.queryClient, location.href, ["admin"]),
  loader: ({ context }) =>
    context.queryClient.prefetchQuery(adminBookingsQuery("pending")),
  component: AdminBookingsPage,
})

function AdminBookingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-lg font-semibold tracking-tight">Requests</h1>
        <p className="text-sm text-muted-foreground">
          Approve requests before their deadline, and block bookings with a
          reason the booker will see.
        </p>
      </div>
      <AdminBookings />
    </div>
  )
}
