import type { QueryClient } from "@tanstack/react-query"
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
} from "@tanstack/react-router"
import { Toaster } from "@workspace/ui/components/sonner"

import { AppHeader } from "@/components/app-header"
import { useTheme } from "@/components/theme-provider"

export type RouterContext = {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({ meta: [{ title: "Court Side" }] }),
  component: RootLayout,
})

function RootLayout() {
  const { theme } = useTheme()

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <HeadContent />
      <AppHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
        <Outlet />
      </main>
      <Toaster theme={theme} />
    </div>
  )
}
