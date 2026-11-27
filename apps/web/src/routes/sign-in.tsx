import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/reui/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { CircleAlertIcon, InfoIcon } from "lucide-react"
import { z } from "zod"

import { safeRedirect } from "@/features/session/guards"
import {
  authOptionsQuery,
  meQuery,
  signInWithFixture,
  signInWithGoogle,
} from "@/features/session/session"
import type { FixturePersona } from "@/features/session/types"
import { errorMessage } from "@/lib/api"

const searchSchema = z.object({
  redirect: z.string().optional(),
  error: z.string().optional(),
})

export const Route = createFileRoute("/sign-in")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in | Court Side" }] }),
  beforeLoad: async ({ context, search }) => {
    const me = await context.queryClient.ensureQueryData(meQuery)
    if (me) throw redirect({ to: safeRedirect(search.redirect) })
  },
  component: SignInPage,
})

function SignInPage() {
  const search = Route.useSearch()
  const options = useQuery(authOptionsQuery)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const google = useMutation({ mutationFn: signInWithGoogle })
  const fixture = useMutation({
    mutationFn: signInWithFixture,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] })
      await navigate({ to: safeRedirect(search.redirect) })
    },
  })
  const failure = google.error ?? fixture.error

  return (
    <div className="flex flex-1 items-start justify-center sm:items-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <h1>Sign in to Court Side</h1>
          </CardTitle>
          <CardDescription>
            Anyone can browse the schedule. Sign in to request a court.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {search.error && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Sign-in did not complete</AlertTitle>
              <AlertDescription>
                Try again. If your access was revoked, contact an Admin.
              </AlertDescription>
            </Alert>
          )}
          {failure && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Could not sign in</AlertTitle>
              <AlertDescription>{errorMessage(failure)}</AlertDescription>
            </Alert>
          )}

          {options.isPending && (
            <div
              role="status"
              className="flex flex-col gap-3"
              aria-busy="true"
              aria-label="Loading sign-in options"
            >
              <Skeleton className="h-9 w-full rounded-4xl" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}

          {options.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Sign-in options did not load</AlertTitle>
              <AlertDescription>{errorMessage(options.error)}</AlertDescription>
              <AlertAction>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => options.refetch()}
                >
                  Retry
                </Button>
              </AlertAction>
            </Alert>
          )}

          {options.data && (
            <>
              <Button
                onClick={() => google.mutate()}
                disabled={!options.data.google || google.isPending}
              >
                {google.isPending && <Spinner />}
                Continue with Google
              </Button>
              {!options.data.google && (
                <Alert variant="info">
                  <InfoIcon />
                  <AlertTitle>Google sign-in is not configured</AlertTitle>
                  <AlertDescription>
                    Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env to
                    enable it.
                  </AlertDescription>
                </Alert>
              )}
              {options.data.identityFixture && (
                <FixturePersonas
                  personas={options.data.identityFixture.personas}
                  pendingSubject={
                    fixture.isPending ? fixture.variables?.subject : undefined
                  }
                  onSelect={(persona) => fixture.mutate(persona)}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function FixturePersonas(props: {
  personas: FixturePersona[]
  pendingSubject: string | undefined
  onSelect: (persona: FixturePersona) => void
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <h2 className="text-xs text-muted-foreground">Local demo accounts</h2>
        <Separator className="flex-1" />
      </div>
      <p className="text-xs text-muted-foreground">
        Fictional people for local testing. These sign-ins skip Google and are
        disabled in production.
      </p>
      {/* Safari drops list semantics from a flex <ul>; role="list" restores them. */}
      <ul role="list" className="flex flex-col gap-2">
        {props.personas.map((persona) => (
          <li key={persona.subject}>
            <Button
              variant="outline"
              className="w-full justify-between"
              disabled={props.pendingSubject !== undefined}
              onClick={() => props.onSelect(persona)}
            >
              <span>{persona.name}</span>
              <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                {props.pendingSubject === persona.subject && <Spinner />}
                {persona.description}
              </span>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
