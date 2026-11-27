import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router"
import { render } from "@testing-library/react"
import { vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { createAppRouter } from "@/router"

type Handler = (init?: RequestInit) => { status?: number; body?: unknown }

/** Renders the real router at a path with fetch answered by route handlers. */
export function renderApp(path: string, handlers: Record<string, Handler>) {
  const calls: string[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost")
      const key = `${init?.method ?? "GET"} ${url.pathname}`
      calls.push(`${key}${url.search}`)
      const handler = handlers[key]
      const { status = 200, body } = handler
        ? handler(init)
        : { status: 404, body: { message: `No handler for ${key}` } }
      return new Response(body === undefined ? "" : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    })
  )

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createAppRouter(
    queryClient,
    createMemoryHistory({ initialEntries: [path] })
  )
  const view = render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  )
  return { ...view, router, calls }
}

export const signedOut = {
  "GET /api/me": () => ({ status: 401, body: { message: "Sign in" } }),
}
