import { queryOptions, type QueryClient } from "@tanstack/react-query"

import { api, ApiError } from "@/lib/api"

import type { AuthOptions, FixturePersona, Me } from "./types"

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async (): Promise<Me | null> => {
    try {
      return await api<Me>("/api/me")
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null
      throw error
    }
  },
})

export const authOptionsQuery = queryOptions({
  queryKey: ["auth-options"],
  queryFn: () => api<AuthOptions>("/api/auth-options"),
  staleTime: Infinity,
})

/** Starts the Google OpenID Connect redirect through Better Auth. */
export async function signInWithGoogle() {
  const { url } = await api<{ url: string }>("/api/auth/sign-in/social", {
    method: "POST",
    body: JSON.stringify({
      provider: "google",
      callbackURL: "/account",
      errorCallbackURL: "/sign-in?error=google",
    }),
  })
  window.location.assign(url)
}

/** Local identity fixture; the server only exposes it outside production. */
export async function signInWithFixture(persona: FixturePersona) {
  await api("/api/auth/identity-fixture/sign-in", {
    method: "POST",
    body: JSON.stringify({
      subject: persona.subject,
      email: persona.email,
      name: persona.name,
    }),
  })
}

export async function signOut(queryClient: QueryClient) {
  await api("/api/auth/sign-out", { method: "POST", body: "{}" })
  queryClient.clear()
}
