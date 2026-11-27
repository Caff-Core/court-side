import { loadLocalEnv } from "../src/config/load-env.js"
import type { ScheduleEntryKind } from "../src/generated/prisma/enums.js"
import { createPrismaClient } from "../src/prisma/prisma-client.js"
import {
  addDays,
  localDateOf,
  zonedInstant,
} from "../src/schedule/zoned-time.js"
import { COMMUNITY_TIME_ZONE } from "./seed-data.js"

/**
 * Optional local demo: puts one of each schedule status on tomorrow's public
 * schedule. Fixed ids make reruns move the same entries to the new tomorrow.
 * Run after seed-demo-accounts so the fictional resident exists.
 */
loadLocalEnv()
if (process.env.NODE_ENV === "production") {
  console.error("Demo schedule entries are for local development only.")
  process.exit(1)
}

const prisma = createPrismaClient(process.env.DATABASE_URL ?? "")
const now = new Date()
const tomorrow = addDays(localDateOf(now, COMMUNITY_TIME_ZONE), 1)
const at = (hour: number, minute = 0) =>
  zonedInstant(tomorrow, hour * 60 + minute, COMMUNITY_TIME_ZONE)

const resident = await prisma.user.findUnique({
  where: { email: "riley.resident@example.test" },
})

type DemoEntry = {
  id: string
  slug: string
  kind: ScheduleEntryKind
  startsAt: Date
  endsAt: Date
  reason?: string
}

const entries: DemoEntry[] = [
  {
    id: "0197a000-0000-7000-8000-000000000001",
    slug: "maple-tennis-1",
    kind: "booking",
    startsAt: at(10),
    endsAt: at(11),
  },
  {
    id: "0197a000-0000-7000-8000-000000000002",
    slug: "maple-tennis-1",
    kind: "hold",
    startsAt: at(11),
    endsAt: at(11, 30),
  },
  {
    id: "0197a000-0000-7000-8000-000000000003",
    slug: "maple-tennis-1",
    kind: "event",
    startsAt: at(13),
    endsAt: at(15),
    reason: "Maple Grove junior clinic",
  },
  {
    id: "0197a000-0000-7000-8000-000000000004",
    slug: "maple-tennis-1",
    kind: "block",
    startsAt: at(16),
    endsAt: at(16, 30),
    reason: "Fictional demo block",
  },
  {
    id: "0197a000-0000-7000-8000-000000000005",
    slug: "willow-soccer-field",
    kind: "closure",
    startsAt: at(9),
    endsAt: at(12),
    reason: "Goal net repair",
  },
]

for (const { id, slug, ...entry } of entries) {
  const facility = await prisma.facility.findUniqueOrThrow({ where: { slug } })
  // A hold expires at the earlier of 24 hours from now and its start.
  const expiresAt =
    entry.kind === "hold"
      ? new Date(Math.min(now.getTime() + 86_400_000, entry.startsAt.getTime()))
      : null
  const accountId =
    entry.kind === "booking" || entry.kind === "hold" || entry.kind === "block"
      ? (resident?.id ?? null)
      : null
  const data = {
    ...entry,
    facilityId: facility.id,
    expiresAt,
    accountId,
    reason: entry.reason ?? null,
  }
  await prisma.scheduleEntry.upsert({
    where: { id },
    create: { id, ...data },
    update: data,
  })
}

console.log(`Demo schedule entries placed on ${tomorrow}.`)
await prisma.$disconnect()
