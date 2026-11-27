import type { QueryClient } from "@tanstack/react-query"
import { redirect } from "@tanstack/react-router"

import { meQuery } from "./session"
import type { Role } from "./types"

/** Browser guards only guide navigation; the server checks every request. */
export async function requireAccount(queryClient: QueryClient, href: string) {
  const me = await queryClient.ensureQueryData(meQuery)
  if (!me) throw redirect({ to: "/sign-in", search: { redirect: href } })
  return me
}

export async function requireRole(
  queryClient: QueryClient,
  href: string,
  roles: Role[]
) {
  const me = await requireAccount(queryClient, href)
  if (me.status !== "active" || !me.role || !roles.includes(me.role)) {
    throw redirect({ to: "/account" })
  }
  return me
}

/** Only same-origin paths are followed after sign-in. */
export function safeRedirect(value: unknown) {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
    ? value
    : "/account"
}
