import { screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderApp } from "@/test/render-app"

const adminMe = {
  id: "admin-1",
  name: "Avery Admin",
  email: "avery.admin@example.test",
  image: null,
  status: "active",
  role: "admin",
}

const account = (overrides: Record<string, unknown>) => ({
  image: null,
  createdAt: "2026-11-20T10:00:00.000Z",
  ...overrides,
})

describe("Admin accounts page", () => {
  it("lists accounts with status and role", async () => {
    const { calls } = renderApp("/admin/accounts", {
      "GET /api/me": () => ({ body: adminMe }),
      "GET /api/admin/accounts": () => ({
        body: {
          total: 2,
          items: [
            account({ ...adminMe }),
            account({
              id: "u2",
              name: "Jordan Pending",
              email: "jordan.pending@example.test",
              status: "pending",
              role: null,
            }),
          ],
        },
      }),
    })

    const row = (await screen.findByText("Jordan Pending")).closest("tr")!
    expect(within(row).getByText("Pending approval")).toBeInTheDocument()
    expect(
      within(row).getByRole("button", { name: "Actions for Jordan Pending" })
    ).toBeInTheDocument()

    const self = screen.getByText("You").closest("tr")!
    expect(
      within(self).queryByRole("button", { name: /Actions for/ })
    ).not.toBeInTheDocument()
    expect(calls).toContain("GET /api/admin/accounts?page=1&pageSize=10")

    // jsdom's role map predates <search>; browsers expose it as a search landmark.
    const search = document.querySelector("search") as HTMLElement
    expect(
      within(search).getByRole("searchbox", { name: "Search accounts" })
    ).toBeInTheDocument()
    expect(within(search).getByRole("status")).toHaveTextContent("2 accounts")
  })

  it("shows an inline error with Retry when accounts fail to load", async () => {
    renderApp("/admin/accounts", {
      "GET /api/me": () => ({ body: adminMe }),
      "GET /api/admin/accounts": () => ({
        status: 500,
        body: { message: "Database unavailable" },
      }),
    })

    expect(await screen.findByText("Accounts did not load")).toBeInTheDocument()
    expect(screen.getByText("Database unavailable")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
  })

  it("shows the empty state", async () => {
    renderApp("/admin/accounts", {
      "GET /api/me": () => ({ body: adminMe }),
      "GET /api/admin/accounts": () => ({ body: { total: 0, items: [] } }),
    })

    expect(await screen.findByText("No accounts match")).toBeInTheDocument()
  })
})
