import { loadLocalEnv } from "../src/config/load-env.js"
import { createPrismaClient } from "../src/prisma/prisma-client.js"
import {
  COMMUNITY_TIME_ZONE,
  openingHoursFor,
  SEED_FACILITIES,
} from "./seed-data.js"

loadLocalEnv()

const prisma = createPrismaClient(process.env.DATABASE_URL ?? "")

// Idempotent: rerunning the seed restores the fictional facilities.
for (const { hours, ...facility } of SEED_FACILITIES) {
  const openingHours = openingHoursFor(hours)
  await prisma.facility.upsert({
    where: { slug: facility.slug },
    create: {
      ...facility,
      timeZone: COMMUNITY_TIME_ZONE,
      openingHours: { create: openingHours },
    },
    update: {
      ...facility,
      timeZone: COMMUNITY_TIME_ZONE,
      openingHours: { deleteMany: {}, create: openingHours },
    },
  })
}

console.log(`Seeded ${SEED_FACILITIES.length} fictional facilities.`)
await prisma.$disconnect()
