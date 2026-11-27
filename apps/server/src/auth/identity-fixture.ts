import type { BetterAuthPlugin } from "better-auth"
import { APIError, createAuthEndpoint } from "better-auth/api"
import { setSessionCookie } from "better-auth/cookies"
import { handleOAuthUserInfo } from "better-auth/oauth2"
import { z } from "zod"

/**
 * Local identity fixture for automated tests and the offline demo. It hands a
 * fictional Google subject to the same Better Auth OAuth user path the Google
 * callback uses, so account creation, linking and session hooks all run.
 * Never enabled in production (see env validation). Requests must come from
 * the app's own origin so another site cannot sign a browser in.
 */
export function identityFixture(options: { appOrigin: string }) {
  const appOrigin = new URL(options.appOrigin).origin
  return {
    id: "identity-fixture",
    endpoints: {
      identityFixtureSignIn: createAuthEndpoint(
        "/identity-fixture/sign-in",
        {
          method: "POST",
          body: z.object({
            subject: z.string().min(1).max(255),
            email: z.email(),
            name: z.string().min(1).max(200),
          }),
        },
        async (ctx) => {
          if (ctx.request?.headers.get("origin") !== appOrigin) {
            throw new APIError("FORBIDDEN", {
              message: "Fixture sign-in is only allowed from the app origin",
            })
          }
          const { subject, email, name } = ctx.body
          const result = await handleOAuthUserInfo(ctx, {
            userInfo: {
              id: subject,
              email,
              name,
              emailVerified: true,
              image: null,
            },
            account: { providerId: "google", accountId: subject },
            source: {
              method: "oauth",
              oauth: { providerId: "google", profile: {} },
            },
          })
          if (result.error || !result.data) {
            throw new APIError("FORBIDDEN", {
              message: "Sign-in was not allowed for this account",
            })
          }
          await setSessionCookie(ctx, result.data)
          return ctx.json({ userId: result.data.user.id })
        }
      ),
    },
  } satisfies BetterAuthPlugin
}
