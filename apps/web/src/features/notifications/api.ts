import { queryOptions, type QueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"

export type NotificationType = "booking_blocked" | "booking_cancelled_closure"

export type AppNotification = {
  id: string
  type: NotificationType
  bookingId: string | null
  message: string
  createdAt: string
  readAt: string | null
}

export const notificationsQuery = queryOptions({
  queryKey: ["notifications", "list"],
  queryFn: () => api<AppNotification[]>("/api/notifications"),
})

/**
 * Other people's actions (an Admin block, a Staff closure) create these, so
 * the count also refreshes on an interval and when the window regains focus.
 */
export const unreadCountQuery = queryOptions({
  queryKey: ["notifications", "unread"],
  queryFn: () => api<{ count: number }>("/api/notifications/unread-count"),
  refetchInterval: 60_000,
})

export const markRead = (id: string) =>
  api<AppNotification>(`/api/notifications/${id}/read`, { method: "POST" })

export const markAllRead = () =>
  api<{ updated: number }>("/api/notifications/read-all", { method: "POST" })

export function invalidateNotifications(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ["notifications"] })
}
