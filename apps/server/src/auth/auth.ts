import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"

import { claimFirstAdmin } from "../accounts/admin-provision.js"
import { googleCredentials, type Env } from "../config/env.js"
import type { PrismaClient } from "../generated/prisma/client.js"
import { identityFixture } from "./identity-fixture.js"

export const AUTH_BASE_PATH = "/api/auth"

export function createAuth(prisma: PrismaClient, env: Env) {
  const google = googleCredentials(env)

  return betterAuth({
    appName: "Court Side",
    baseURL: env.APP_URL,
    basePath: AUTH_BASE_PATH,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL],
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    telemetry: { enabled: false },
    socialProviders: google ? { google } : {},
    user: {
      // The application owns status and role; sign-in input never sets them.
      additionalFields: {
        status: { type: "string", input: false, defaultValue: "pending" },
        role: { type: "string", input: false, required: false },
      },
    },
    session: {
      // Every request reads the session and account from the database, so a
      // revocation applies to the very next request.
      cookieCache: { enabled: false },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            await claimFirstAdmin(prisma, session.userId)
            const user = await prisma.user.findUnique({
              where: { id: session.userId },
              select: { status: true },
            })
            if (!user || user.status === "revoked") return false
          },
        },
      },
    },
    plugins: env.AUTH_IDENTITY_FIXTURE
      ? [identityFixture({ appOrigin: env.APP_URL })]
      : [],
  })
}

export type Auth = ReturnType<typeof createAuth>
