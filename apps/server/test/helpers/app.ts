import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import request from "supertest"

import { AppModule } from "../../src/app.module.js"
import { CLOCK, type Clock } from "../../src/common/clock.js"
import { configureApp } from "../../src/configure-app.js"
import { PrismaService } from "../../src/prisma/prisma.service.js"

export const ORIGIN = "http://localhost:5173"

/** Boots the real app. Pass a clock to control "now" in time-based checks. */
export async function createTestApp(options: { clock?: Clock } = {}) {
  let builder = Test.createTestingModule({ imports: [AppModule] })
  if (options.clock) {
    builder = builder.overrideProvider(CLOCK).useValue(options.clock)
  }
  const moduleRef = await builder.compile()
  const app = configureApp(moduleRef.createNestApplication())
  await app.init()
  return app
}

export function prismaOf(app: INestApplication) {
  return app.get(PrismaService)
}

/** Clears identity, access and audit data. Facilities stay seeded. */
export async function resetAccounts(app: INestApplication) {
  await prismaOf(app).$executeRawUnsafe(
    'TRUNCATE "audit_log", "admin_provision", "session", "account", "verification", "user" CASCADE'
  )
}

/** Clears schedule entries. Facilities and opening hours stay seeded. */
export async function resetSchedule(app: INestApplication) {
  await prismaOf(app).$executeRawUnsafe('TRUNCATE "schedule_entry"')
}

export type FixtureIdentity = {
  subject: string
  email: string
  name: string
}

/**
 * Signs in through the identity fixture, which runs the same Better Auth
 * OAuth account path as the Google callback, and returns an agent that keeps
 * the session cookie.
 */
export async function signIn(app: INestApplication, identity: FixtureIdentity) {
  const agent = request.agent(app.getHttpServer())
  const response = await agent
    .post("/api/auth/identity-fixture/sign-in")
    .set("Origin", ORIGIN)
    .send(identity)
  return { agent, response }
}

export async function signInOk(
  app: INestApplication,
  identity: FixtureIdentity
) {
  const { agent, response } = await signIn(app, identity)
  if (response.status !== 200) {
    throw new Error(
      `Fixture sign-in failed with ${response.status}: ${JSON.stringify(response.body)}`
    )
  }
  return agent
}

export const identities = {
  admin: {
    subject: "fixture-admin",
    email: "avery.admin@example.test",
    name: "Avery Admin",
  },
  resident: {
    subject: "fixture-resident",
    email: "riley.resident@example.test",
    name: "Riley Resident",
  },
  staff: {
    subject: "fixture-staff",
    email: "sam.staff@example.test",
    name: "Sam Staff",
  },
  pending: {
    subject: "fixture-pending",
    email: "jordan.pending@example.test",
    name: "Jordan Pending",
  },
} satisfies Record<string, FixtureIdentity>
