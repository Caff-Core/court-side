import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { renderApp, signedOut } from "@/test/render-app"

const facilities = [
  {
    slug: "cedar-basketball",
    name: "Cedar Park Basketball Court",
    sport: "Basketball",
    requiresApproval: true,
    timeZone: "America/Toronto",
  },
  {
    slug: "maple-tennis-1",
    name: "Maple Grove Tennis Court 1",
    sport: "Tennis",
    requiresApproval: false,
    timeZone: "America/Toronto",
  },
]

function day(overrides: Record<string, unknown> = {}) {
  return {
    facility: facilities[0],
    date: "2026-11-28",
    dayStartsAt: "2026-11-28T05:00:00.000Z",
    today: "2026-11-27",
    firstDate: "2026-11-27",
    lastDate: "2026-12-10",
    previousDate: "2026-11-27",
    nextDate: "2026-11-29",
    open: true,
    opensAt: "2026-11-28T14:00:00.000Z",
    closesAt: "2026-11-28T16:00:00.000Z",
    slots: [
      {
        startsAt: "2026-11-28T14:00:00.000Z",
        endsAt: "2026-11-28T14:30:00.000Z",
        status: "booked",
      },
      {
        startsAt: "2026-11-28T14:30:00.000Z",
        endsAt: "2026-11-28T15:00:00.000Z",
        status: "available",
      },
      {
        startsAt: "2026-11-28T15:00:00.000Z",
        endsAt: "2026-11-28T15:30:00.000Z",
        status: "closed",
      },
      {
        startsAt: "2026-11-28T15:30:00.000Z",
        endsAt: "2026-11-28T16:00:00.000Z",
        status: "available",
      },
    ],
    ...overrides,
  }
}

const pendingMe = {
  id: "u1",
  name: "Jordan Pending",
  email: "jordan.pending@example.test",
  image: null,
  status: "pending",
  role: null,
}

const publicApi = {
  "GET /api/facilities": () => ({ body: facilities }),
}

describe("public schedule", () => {
  it("shows a visitor the day's slots with statuses and a sign-in prompt", async () => {
    renderApp("/?date=2026-11-28", {
      ...signedOut,
      ...publicApi,
      "GET /api/facilities/cedar-basketball/availability": () => ({
        body: day(),
      }),
    })

    expect(
      await screen.findByRole("heading", { level: 1, name: "Schedule" })
    ).toBeInTheDocument()
    await waitFor(() => expect(document.title).toBe("Schedule | Court Side"))

    expect(
      screen.getByRole("button", { name: /9:00.*Booked/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /9:30.*Available/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /10:00.*Closed/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Cedar Park Basketball Court",
      })
    ).toBeInTheDocument()
    expect(screen.getByText(/2 open slots/)).toBeInTheDocument()
    expect(
      await screen.findByRole("link", { name: "Sign in to request a court" })
    ).toBeInTheDocument()
  })

  it("lets a keyboard user switch facilities with the radio group", async () => {
    const user = userEvent.setup()
    const { router, calls } = renderApp("/", {
      ...signedOut,
      ...publicApi,
      "GET /api/facilities/cedar-basketball/availability": () => ({
        body: day(),
      }),
      "GET /api/facilities/maple-tennis-1/availability": () => ({
        body: day({ facility: facilities[1] }),
      }),
    })

    const group = await screen.findByRole("radiogroup", { name: "Facility" })
    const first = within(group).getByRole("radio", {
      name: /Cedar Park Basketball Court/,
    })
    expect(first).toBeChecked()
    first.focus()
    await user.keyboard("{ArrowDown}")

    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        facility: "maple-tennis-1",
      })
    )
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Maple Grove Tennis Court 1",
      })
    ).toBeInTheDocument()
    expect(calls).toContain("GET /api/facilities/maple-tennis-1/availability")
  })

  it("filters facilities by sport and clears an empty search", async () => {
    const user = userEvent.setup()
    renderApp("/", {
      ...signedOut,
      ...publicApi,
      "GET /api/facilities/cedar-basketball/availability": () => ({
        body: day(),
      }),
    })
    const search = await screen.findByRole("searchbox", {
      name: "Search facilities",
    })
    await user.type(search, "tennis")
    expect(screen.getAllByRole("radio")).toHaveLength(1)
    expect(screen.getByRole("radio", { name: /Maple/ })).toBeInTheDocument()
    await user.clear(search)
    await user.type(search, "unknown")
    expect(screen.getByText("No matching facilities")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Clear search" }))
    expect(screen.getAllByRole("radio")).toHaveLength(2)
  })

  it("steps between days and stops at the end of the window", async () => {
    const user = userEvent.setup()
    const { router } = renderApp("/?date=2026-12-10", {
      ...signedOut,
      ...publicApi,
      "GET /api/facilities/cedar-basketball/availability": () => ({
        body: day({ date: "2026-12-10", nextDate: null }),
      }),
    })

    expect(
      await screen.findByRole("button", { name: "Next day" })
    ).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Previous day" }))

    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        date: "2026-11-27",
      })
    )
  })

  it("tells a pending user that booking opens after approval", async () => {
    renderApp("/", {
      "GET /api/me": () => ({ body: pendingMe }),
      ...publicApi,
      "GET /api/facilities/cedar-basketball/availability": () => ({
        body: day(),
      }),
    })

    expect(await screen.findByText("Waiting for approval")).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Sign in to request a court" })
    ).not.toBeInTheDocument()
  })

  it("offers the next day when the facility is closed", async () => {
    const user = userEvent.setup()
    const { router } = renderApp("/", {
      ...signedOut,
      ...publicApi,
      "GET /api/facilities/cedar-basketball/availability": () => ({
        body: day({ open: false, opensAt: null, closesAt: null, slots: [] }),
      }),
    })

    expect(await screen.findByText("Closed on this day")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Show next day" }))
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        date: "2026-11-29",
      })
    )
  })

  it("shows an inline error with Retry when the day fails to load", async () => {
    renderApp("/", {
      ...signedOut,
      ...publicApi,
      "GET /api/facilities/cedar-basketball/availability": () => ({
        status: 500,
        body: { message: "Database unavailable" },
      }),
    })

    expect(
      await screen.findByText("The schedule did not load")
    ).toBeInTheDocument()
    expect(screen.getByText("Database unavailable")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
  })
})
