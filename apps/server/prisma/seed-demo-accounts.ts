import { randomUUID } from "node:crypto"

import {
  provisionFirstAdmin,
  claimFirstAdmin,
  GOOGLE_ISSUER,
} from "../src/accounts/admin-provision.js"
import { FIXTURE_PERSONAS } from "../src/auth/fixture-personas.js"
import { loadLocalEnv } from "../src/config/load-env.js"
import { createPrismaClient } from "../src/prisma/prisma-client.js"
import type { Role } from "../src/generated/prisma/enums.js"

/**
 * Optional local demo: creates the fictional fixture personas with their
 * roles so every screen can be explored without Google credentials. Sign in
 * as them through the identity fixture (AUTH_IDENTITY_FIXTURE=true).
 */
loadLocalEnv()
if (process.env.NODE_ENV === "production") {
  console.error("Demo accounts are for local development only.")
  process.exit(1)
}

const prisma = createPrismaClient(process.env.DATABASE_URL ?? "")
const roles: Record<string, Role | null> = {
  "fixture-admin": "admin",
  "fixture-staff": "staff",
  "fixture-resident": "resident",
  "fixture-pending": null,
}

async function ensurePersona(persona: (typeof FIXTURE_PERSONAS)[number]) {
  const existing = await prisma.account.findUnique({
    where: {
      providerId_accountId: {
        providerId: "google",
        accountId: persona.subject,
      },
    },
  })
  if (existing) return existing.userId
  const userId = randomUUID()
  await prisma.user.create({
    data: {
      id: userId,
      name: persona.name,
      email: persona.email,
      emailVerified: true,
      accounts: {
        create: {
          id: randomUUID(),
          providerId: "google",
          accountId: persona.subject,
        },
      },
    },
  })
  return userId
}

const provision = await prisma.adminProvision.findUnique({ where: { id: 1 } })
if (!provision) {
  await provisionFirstAdmin(prisma, {
    issuer: GOOGLE_ISSUER,
    subject: "fixture-admin",
  })
}

for (const persona of FIXTURE_PERSONAS) {
  const userId = await ensurePersona(persona)
  const role = roles[persona.subject]
  if (role === "admin") {
    await claimFirstAdmin(prisma, userId)
  } else if (role) {
    await prisma.user.updateMany({
      where: { id: userId, status: "pending" },
      data: { status: "active", role },
    })
  }
}

console.log(
  `Demo accounts ready: ${FIXTURE_PERSONAS.map((p) => p.name).join(", ")}.`
)
await prisma.$disconnect()
