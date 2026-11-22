import { QueryClientProvider } from "@tanstack/react-query"
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { createAppRouter, createQueryClient } from "@/router.tsx"

describe("app shell", () => {
  it("renders the home route", async () => {
    const queryClient = createQueryClient()
    const router = createAppRouter(
      queryClient,
      createMemoryHistory({ initialEntries: ["/"] })
    )

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )

    expect(
      await screen.findByRole("heading", { name: "Court Side" })
    ).toBeInTheDocument()
  })
})
