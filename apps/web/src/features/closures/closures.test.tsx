import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { renderApp } from "@/test/render-app"

const staff = {
  id: "s1",
  name: "Sam Staff",
  email: "sam.staff@example.test",
  image: null,
  status: "active",
  role: "staff",
}
const resident = {
  ...staff,
  id: "r1",
  name: "Riley Resident",
  role: "resident",
}

const facility = {
  slug: "maple-tennis-1",
  name: "Maple Grove Tennis Court 1",
  sport: "Tennis",
  requiresApproval: false,
  timeZone: "America/Toronto",
}

const closure = {
  id: "c1",
  facility: {
    slug: facility.slug,
    name: facility.name,
    timeZone: facility.timeZone,
  },
  startsAt: "2026-11-28T14:00:00.000Z",
  endsAt: "2026-11-28T17:00:00.000Z",
  reason: "Net replacement",
  cancelledBookings: 2,
  endedAt: null,
  createdAt: "2026-11-27T19:10:00.000Z",
  createdBy: { name: "Sam Staff" },
}

describe("Staff closures", () => {
  it("saves a closure in the facility's local time with an Idempotency-Key", async () => {
    const user = userEvent.setup()
    const sent: { body: unknown; key: string | null }[] = []
    renderApp("/staff/closures", {
      "GET /api/me": () => ({ body: staff }),
      "GET /api/closures": () => ({ body: [] }),
      "GET /api/facilities": () => ({ body: [facility] }),
      "POST /api/closures": (init) => {
        sent.push({
          body: JSON.parse(String(init?.body)),
          key: new Headers(init?.headers).get("Idempotency-Key"),
        })
        return { status: 201, body: closure }
      },
    })

    expect(await screen.findByText("No closures scheduled")).toBeInTheDocument()
    await user.click(screen.getAllByRole("button", { name: "New closure" })[0]!)
    const dialog = await screen.findByRole("dialog")

    await user.click(
      within(dialog).getByRole("button", { name: "Save closure" })
    )
    expect(within(dialog).getByText("Choose a facility.")).toBeInTheDocument()
    expect(sent).toHaveLength(0)

    await user.click(within(dialog).getByRole("combobox", { name: "Facility" }))
    await user.click(await screen.findByRole("option", { name: facility.name }))
    await user.type(within(dialog).getByLabelText("Starts"), "2026-11-28T09:00")
    await user.type(within(dialog).getByLabelText("Ends"), "2026-11-28T12:00")
    await user.type(within(dialog).getByLabelText("Reason"), "Net replacement")
    await user.click(
      within(dialog).getByRole("button", { name: "Save closure" })
    )

    expect(await screen.findByText("Closure saved")).toBeInTheDocument()
    expect(sent).toHaveLength(1)
    expect(sent[0]!.body).toEqual({
      facility: "maple-tennis-1",
      startsLocal: "2026-11-28T09:00",
      endsLocal: "2026-11-28T12:00",
      reason: "Net replacement",
    })
    expect(sent[0]!.key).toMatch(/^[0-9a-f-]{36}$/)
  })

  it("ends a closure after confirmation", async () => {
    const user = userEvent.setup()
    const { calls } = renderApp("/staff/closures", {
      "GET /api/me": () => ({ body: staff }),
      "GET /api/closures": () => ({ body: [closure] }),
      "POST /api/closures/c1/end": () => ({
        body: { ...closure, endedAt: "2026-11-27T19:20:00.000Z" },
      }),
    })

    expect(
      await screen.findByText("2 bookings cancelled", { exact: false })
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", { name: /^End closure of Maple/ })
    )
    const dialog = await screen.findByRole("alertdialog")
    await user.click(
      within(dialog).getByRole("button", { name: "End closure" })
    )

    await waitFor(() => expect(calls).toContain("POST /api/closures/c1/end"))
    expect(await screen.findByText("Closure ended")).toBeInTheDocument()
  })

  it("keeps Residents out", async () => {
    const { router } = renderApp("/staff/closures", {
      "GET /api/me": () => ({ body: resident }),
    })

    await waitFor(() => expect(router.state.location.pathname).toBe("/account"))
  })
})

describe("cancelled by a closure", () => {
  it("shows the resident why their booking was cancelled", async () => {
    renderApp("/bookings", {
      "GET /api/me": () => ({ body: resident }),
      "GET /api/bookings/mine": () => ({
        body: [
          {
            id: "b1",
            facility: closure.facility,
            startsAt: "2026-11-28T15:00:00.000Z",
            endsAt: "2026-11-28T16:00:00.000Z",
            status: "cancelled",
            expiresAt: null,
            reason: "Closed: Net replacement",
            blocked: false,
            cancellableUntil: null,
            createdAt: "2026-11-27T19:10:00.000Z",
          },
        ],
      }),
    })

    expect(
      await screen.findByText("Closed: Net replacement")
    ).toBeInTheDocument()
    expect(screen.getByText("Cancelled")).toBeInTheDocument()
  })
})
