import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { renderApp } from "@/test/render-app"

const resident = {
  id: "r1",
  name: "Riley Resident",
  email: "riley.resident@example.test",
  image: null,
  status: "active",
  role: "resident",
}

const unread = {
  id: "n1",
  type: "booking_cancelled_closure",
  bookingId: "b1",
  message:
    "Your booking at Maple Grove Tennis Court 1 on Sat, Nov 28, 10:00 AM was cancelled because the facility is closed. Reason: Net replacement",
  createdAt: "2026-11-27T19:10:00.000Z",
  readAt: null,
}
const read = {
  ...unread,
  id: "n2",
  type: "booking_blocked",
  message: "An Admin blocked your booking.",
  readAt: "2026-11-27T19:12:00.000Z",
}

describe("notifications", () => {
  it("shows the unread count in the header and lists the inbox", async () => {
    renderApp("/notifications", {
      "GET /api/me": () => ({ body: resident }),
      "GET /api/notifications": () => ({ body: [unread, read] }),
      "GET /api/notifications/unread-count": () => ({ body: { count: 1 } }),
    })

    expect(
      await screen.findByRole("link", { name: "Notifications, 1 unread" })
    ).toBeInTheDocument()
    const list = within(
      await screen.findByRole("list", { name: "Notifications" })
    )
    const items = list.getAllByRole("listitem")
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent("Cancelled by a closure")
    expect(items[0]).toHaveTextContent("Reason: Net replacement")
    expect(items[1]).toHaveTextContent("Read")
  })

  it("marks one notification read and refreshes the count", async () => {
    const user = userEvent.setup()
    let count = 1
    const { calls } = renderApp("/notifications", {
      "GET /api/me": () => ({ body: resident }),
      "GET /api/notifications": () => ({
        body: [
          count ? unread : { ...unread, readAt: "2026-11-27T19:20:00.000Z" },
        ],
      }),
      "GET /api/notifications/unread-count": () => ({ body: { count } }),
      "POST /api/notifications/n1/read": () => {
        count = 0
        return { body: { ...unread, readAt: "2026-11-27T19:20:00.000Z" } }
      },
    })

    await user.click(
      await screen.findByRole("button", { name: /^Mark as read: Cancelled/ })
    )

    await waitFor(() =>
      expect(calls).toContain("POST /api/notifications/n1/read")
    )
    expect(
      await screen.findByRole("link", { name: "Notifications" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Mark all as read" })
    ).toBeDisabled()
  })

  it("marks everything read at once", async () => {
    const user = userEvent.setup()
    const { calls } = renderApp("/notifications", {
      "GET /api/me": () => ({ body: resident }),
      "GET /api/notifications": () => ({ body: [unread] }),
      "GET /api/notifications/unread-count": () => ({ body: { count: 1 } }),
      "POST /api/notifications/read-all": () => ({ body: { updated: 1 } }),
    })

    await user.click(
      await screen.findByRole("button", { name: "Mark all as read" })
    )

    await waitFor(() =>
      expect(calls).toContain("POST /api/notifications/read-all")
    )
    expect(
      await screen.findByText("All notifications marked as read")
    ).toBeInTheDocument()
  })

  it("shows an empty inbox with a way to the bookings", async () => {
    renderApp("/notifications", {
      "GET /api/me": () => ({ body: resident }),
      "GET /api/notifications": () => ({ body: [] }),
      "GET /api/notifications/unread-count": () => ({ body: { count: 0 } }),
    })

    expect(await screen.findByText("You're all caught up")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Your bookings" })
    ).toBeInTheDocument()
  })
})
