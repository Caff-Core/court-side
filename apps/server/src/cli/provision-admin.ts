import { parseArgs } from "node:util"

import {
  GOOGLE_ISSUER,
  provisionFirstAdmin,
} from "../accounts/admin-provision.js"
import { loadLocalEnv } from "../config/load-env.js"
import { createPrismaClient } from "../prisma/prisma-client.js"

/**
 * One-time setup: names the Google identity that becomes the first Admin on
 * its first verified sign-in. Refuses to run once a first Admin exists.
 *
 *   bun run admin:provision -- --subject <google-sub> [--issuer <url>]
 */
loadLocalEnv()

const { values } = parseArgs({
  options: {
    subject: { type: "string" },
    issuer: { type: "string", default: GOOGLE_ISSUER },
  },
})

if (!values.subject) {
  console.error(
    "Usage: bun run admin:provision -- --subject <google-sub> [--issuer <url>]"
  )
  process.exit(2)
}

const prisma = createPrismaClient(process.env.DATABASE_URL ?? "")
try {
  await provisionFirstAdmin(prisma, {
    issuer: values.issuer!,
    subject: values.subject,
  })
  console.log(
    `First Admin provisioned for ${values.issuer} subject ${values.subject}.`
  )
  console.log("That account becomes Admin on its next verified sign-in.")
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
