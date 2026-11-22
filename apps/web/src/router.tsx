import { QueryClient } from "@tanstack/react-query"
import { createRouter, type RouterHistory } from "@tanstack/react-router"

import { routeTree } from "./routeTree.gen"

export function createAppRouter(
  queryClient: QueryClient,
  history?: RouterHistory
) {
  return createRouter({
    routeTree,
    history,
    context: { queryClient },
    defaultPreload: "intent",
    // Route loaders read through TanStack Query, so the router cache stays off.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  })
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000 },
    },
  })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
