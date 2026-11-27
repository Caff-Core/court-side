import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { renderApp } from "@/test/render-app"

const facility = {
  slug: "maple-tennis-1",
  name: "Maple Grove Tennis Court 1",
  sport: "Tennis",
  requiresApproval: false,
  timeZone: "America/Toronto",
}

const resident = {
  id: "u1",
  name: "Riley Resident",
  email: "riley.resident@example.test",
  image: null,
  status: "active",
  role: "resident",
}
const admin = { ...resident, id: "a1", name: "Avery Admin", role: "admin" }

const slot = (start: string, end: string, status = "available") => ({
  startsAt: `2026-11-28T${start}:00.000Z`,
  endsAt: `2026-11-28T${end}:00.000Z`,
  status,
})

const day = {
  facility,
  date: "2026-11-28",
  dayStartsAt: "2026-11-28T05:00:00.000Z",
  today: "2026-11-27",
  firstDate: "2026-11-27",
  lastDate: "2026-12-10",
  previousDate: "2026-11-27",
  nextDate: "2026-11-29",
  open: true,
  opensAt: "2026-11-28T15:00:00.000Z",
  closesAt: "2026-11-28T17:00:00.000Z",
  slots: [
    slot("15:00", "15:30"),
    slot("15:30", "16:00"),
    slot("16:00", "16:30", "booked"),
    slot("16:30", "17:00"),
  ],
}

const scheduleApi = (me: object) => ({
  "GET /api/me": () => ({ body: me }),
  "GET /api/facilities": () => ({ body: [facility] }),
  "GET /api/facilities/maple-tennis-1/availability": () => ({ body: day }),
})

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: "b1",
    facility: {
      slug: facility.slug,
      name: facility.name,
      timeZone: facility.timeZone,
    },
    startsAt: "2026-11-28T15:00:00.000Z",
    endsAt: "2026-11-28T16:00:00.000Z",
    status: "confirmed",
    expiresAt: null,
    reason: null,
    blocked: false,
    cancellableUntil: "2026-11-28T13:00:00.000Z",
    createdAt: "2026-11-27T19:10:00.000Z",
    ...overrides,
  }
}

describe("requesting a slot", () => {
  it("books an open slot for an active account with an Idempotency-Key", async () => {
    const user = userEvent.setup()
    const keys: string[] = []
    renderApp("/?date=2026-11-28", {
      ...scheduleApi(resident),
      "POST /api/bookings": (init) => {
        keys.push(new Headers(init?.headers).get("Idempotency-Key") ?? "")
        expect(JSON.parse(String(init?.body))).toEqual({
          facility: "maple-tennis-1",
          startsAt: "2026-11-28T15:00:00.000Z",
          endsAt: "2026-11-28T15:30:00.000Z",
        })
        return {
          status: 201,
          body: booking({ endsAt: "2026-11-28T15:30:00.000Z" }),
        }
      },
    })

    await user.click(
      await screen.findByRole("button", { name: /^Request 10:00/ })
    )
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "Book" }))

    expect(await screen.findByText("Booking confirmed")).toBeInTheDocument()
    expect(keys).toHaveLength(1)
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/)
  })

  it("offers alternatives when the slot was just taken", async () => {
    const user = userEvent.setup()
    const bodies: unknown[] = []
    renderApp("/?date=2026-11-28", {
      ...scheduleApi(resident),
      "POST /api/bookings": (init) => {
        bodies.push(JSON.parse(String(init?.body)))
        return bodies.length === 1
          ? {
              status: 409,
              body: {
                code: "slot_unavailable",
                message: "That time is no longer available.",
                alternatives: [
                  {
                    startsAt: "2026-11-28T16:30:00.000Z",
                    endsAt: "2026-11-28T17:00:00.000Z",
                  },
                ],
              },
            }
          : { status: 201, body: booking() }
      },
    })

    await user.click(
      await screen.findByRole("button", { name: /^Request 10:00/ })
    )
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "Book" }))
    expect(
      await within(dialog).findByText("That time was just taken")
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: /11:30/ }))
    await user.click(within(dialog).getByRole("button", { name: "Book" }))

    await waitFor(() => expect(bodies).toHaveLength(2))
    expect(bodies[1]).toMatchObject({
      startsAt: "2026-11-28T16:30:00.000Z",
      endsAt: "2026-11-28T17:00:00.000Z",
    })
  })

  it("retries a failed submission with the same key", async () => {
    const user = userEvent.setup()
    const keys: string[] = []
    renderApp("/?date=2026-11-28", {
      ...scheduleApi(resident),
      "POST /api/bookings": (init) => {
        keys.push(new Headers(init?.headers).get("Idempotency-Key") ?? "")
        return keys.length === 1
          ? { status: 503, body: { message: "Service unavailable" } }
          : { status: 201, body: booking() }
      },
    })

    await user.click(
      await screen.findByRole("button", { name: /^Request 10:00/ })
    )
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "Book" }))
    await user.click(
      await within(dialog).findByRole("button", { name: "Retry" })
    )

    await waitFor(() => expect(keys).toHaveLength(2))
    expect(keys[1]).toBe(keys[0])
  })

  it("keeps slots read-only for visitors", async () => {
    renderApp("/?date=2026-11-28", {
      ...scheduleApi(resident),
      "GET /api/me": () => ({ status: 401, body: { message: "Sign in" } }),
    })

    await screen.findByRole("list", { name: /Slots for/ })
    expect(screen.queryByRole("button", { name: /^Request/ })).toBeNull()
  })
})

describe("your bookings", () => {
  it("warns that a late cancellation counts as a no-show", async () => {
    const user = userEvent.setup()
    const soon = new Date(Date.now() + 60 * 60_000)
    const late = booking({
      startsAt: soon.toISOString(),
      endsAt: new Date(soon.getTime() + 60 * 60_000).toISOString(),
      cancellableUntil: new Date(soon.getTime() - 2 * 3_600_000).toISOString(),
    })
    let cancelled = false
    renderApp("/bookings", {
      "GET /api/me": () => ({ body: resident }),
      "GET /api/bookings/mine": () => ({ body: [late] }),
      "POST /api/bookings/b1/cancel": () => {
        cancelled = true
        return { body: { ...late, status: "no_show" } }
      },
    })

    await user.click(
      await screen.findByRole("button", { name: /^Cancel Maple/ })
    )
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("recorded as a no-show")
    await user.click(
      within(dialog).getByRole("button", { name: "Cancel booking" })
    )

    expect(
      await screen.findByText("Cancelled and recorded as a no-show")
    ).toBeInTheDocument()
    expect(cancelled).toBe(true)
  })

  it("shows the empty state with a way to the schedule", async () => {
    renderApp("/bookings", {
      "GET /api/me": () => ({ body: resident }),
      "GET /api/bookings/mine": () => ({ body: [] }),
    })

    expect(await screen.findByText("No bookings yet")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Browse the schedule" })
    ).toBeInTheDocument()
  })
})

describe("Admin requests", () => {
  const pending = {
    ...booking({
      status: "pending",
      expiresAt: "2026-11-28T15:00:00.000Z",
      cancellableUntil: "2026-11-28T15:00:00.000Z",
    }),
    account: { id: "u1", name: "Riley Resident", email: resident.email },
  }

  it("approves a pending request", async () => {
    const user = userEvent.setup()
    const { calls } = renderApp("/admin/bookings", {
      "GET /api/me": () => ({ body: admin }),
      "GET /api/admin/bookings": () => ({ body: [pending] }),
      "POST /api/admin/bookings/b1/approve": () => ({
        body: { ...pending, status: "confirmed" },
      }),
    })

    await user.click(
      await screen.findByRole("button", { name: /^Approve Riley Resident/ })
    )

    expect(await screen.findByText("Request approved")).toBeInTheDocument()
    expect(calls).toContain("POST /api/admin/bookings/b1/approve")
  })

  it("requires a reason before blocking", async () => {
    const user = userEvent.setup()
    const reasons: string[] = []
    renderApp("/admin/bookings", {
      "GET /api/me": () => ({ body: admin }),
      "GET /api/admin/bookings": () => ({ body: [pending] }),
      "POST /api/admin/bookings/b1/block": (init) => {
        reasons.push(JSON.parse(String(init?.body)).reason)
        return { body: { ...pending, status: "blocked", blocked: true } }
      },
    })

    await user.click(
      await screen.findByRole("button", { name: /^Block Riley Resident/ })
    )
    const dialog = await screen.findByRole("dialog")
    await user.click(
      within(dialog).getByRole("button", { name: "Block booking" })
    )
    expect(
      within(dialog).getByText("Give a reason for the block.")
    ).toBeInTheDocument()
    expect(reasons).toHaveLength(0)

    await user.type(
      within(dialog).getByRole("textbox", { name: "Reason" }),
      "League finals"
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Block booking" })
    )

    expect(await screen.findByText("Booking blocked")).toBeInTheDocument()
    expect(reasons).toEqual(["League finals"])
  })
})
