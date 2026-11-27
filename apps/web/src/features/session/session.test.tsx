import { screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderApp, signedOut } from "@/test/render-app"

const pendingMe = {
  id: "u1",
  name: "Jordan Pending",
  email: "jordan.pending@example.test",
  image: null,
  status: "pending",
  role: null,
}

describe("sign-in and account access", () => {
  it("offers fixture personas and explains a missing Google client", async () => {
    renderApp("/sign-in", {
      ...signedOut,
      "GET /api/auth-options": () => ({
        body: {
          google: false,
          identityFixture: {
            personas: [
              {
                subject: "fixture-admin",
                email: "avery.admin@example.test",
                name: "Avery Admin",
                description: "First Admin once provisioned",
              },
            ],
          },
        },
      }),
    })

    expect(
      await screen.findByRole("button", { name: /Avery Admin/ })
    ).toBeEnabled()
    expect(
      screen.getByRole("button", { name: "Continue with Google" })
    ).toBeDisabled()
    expect(
      screen.getByText("Google sign-in is not configured")
    ).toBeInTheDocument()
  })

  it("shows a pending user their review status", async () => {
    renderApp("/account", { "GET /api/me": () => ({ body: pendingMe }) })

    expect(await screen.findByText("Waiting for approval")).toBeInTheDocument()
    expect(screen.getByText("Pending approval")).toBeInTheDocument()
  })

  it("sends signed-out visitors from a protected page to sign-in", async () => {
    const { router } = renderApp("/admin/accounts", {
      ...signedOut,
      "GET /api/auth-options": () => ({
        body: { google: true, identityFixture: null },
      }),
    })

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Sign in to Court Side",
      })
    ).toBeInTheDocument()
    await waitFor(() => expect(document.title).toBe("Sign in | Court Side"))
    expect(router.state.location.pathname).toBe("/sign-in")
    expect(router.state.location.search).toEqual({
      redirect: "/admin/accounts",
    })
  })

  it("keeps pending users out of the Admin accounts page", async () => {
    const { router } = renderApp("/admin/accounts", {
      "GET /api/me": () => ({ body: pendingMe }),
    })

    expect(
      await screen.findByRole("heading", { level: 1, name: "Your account" })
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(document.title).toBe("Your account | Court Side")
    )
    expect(router.state.location.pathname).toBe("/account")
    expect(
      screen.queryByRole("link", { name: "Accounts" })
    ).not.toBeInTheDocument()
  })
})
