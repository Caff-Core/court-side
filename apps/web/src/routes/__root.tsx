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
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <HeadContent />
      <AppHeader />
      <main className="mx-auto flex min-h-0 w-full max-w-screen-2xl flex-1 flex-col gap-6 overflow-y-auto px-4 py-6">
        <Outlet />
      </main>
      <Toaster theme={theme} />
    </div>
  )
}
