import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClient } from "../src/prisma/prisma-client.js"
import { SEED_FACILITIES } from "../prisma/seed-data.js"

const prisma = createPrismaClient(process.env.DATABASE_URL ?? "")

describe("facility schema", () => {
  let facilityId: string

  beforeAll(async () => {
    const facility = await prisma.facility.findFirstOrThrow({
      where: { slug: SEED_FACILITIES[0]!.slug },
    })
    facilityId = facility.id
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it("loads every fictional facility with opening hours for all weekdays", async () => {
    const facilities = await prisma.facility.findMany({
      include: { openingHours: true },
    })

    expect(facilities.map((f) => f.slug).sort()).toEqual(
      SEED_FACILITIES.map((f) => f.slug).sort()
    )
    for (const facility of facilities) {
      expect(facility.openingHours.map((h) => h.weekday).sort()).toEqual([
        1, 2, 3, 4, 5, 6, 7,
      ])
    }
  })

  it("seeds both auto-confirm and approval-only facilities", async () => {
    const approval = await prisma.facility.groupBy({
      by: ["requiresApproval"],
      _count: true,
    })

    expect(approval.map((g) => g.requiresApproval).sort()).toEqual([
      false,
      true,
    ])
  })

  it.each([
    {
      name: "a window that is not slot aligned",
      opensAtMin: 435,
      closesAtMin: 1260,
    },
    {
      name: "a window that closes before it opens",
      opensAtMin: 1260,
      closesAtMin: 420,
    },
    { name: "a window past midnight", opensAtMin: 420, closesAtMin: 1470 },
  ])("rejects $name", async ({ opensAtMin, closesAtMin }) => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.openingHours.deleteMany({ where: { facilityId, weekday: 1 } })
        await tx.openingHours.create({
          data: { facilityId, weekday: 1, opensAtMin, closesAtMin },
        })
      })
    ).rejects.toThrow()
  })

  it("rejects a weekday outside ISO 1 to 7", async () => {
    await expect(
      prisma.openingHours.create({
        data: { facilityId, weekday: 8, opensAtMin: 420, closesAtMin: 1260 },
      })
    ).rejects.toThrow()
  })
  it("rejects a schedule entry that does not end after it starts", async () => {
    const at = new Date("2026-11-28T13:00:00Z")
    await expect(
      prisma.scheduleEntry.create({
        data: { facilityId, kind: "closure", startsAt: at, endsAt: at },
      })
    ).rejects.toThrow()
  })

  it("requires a deadline on holds and only on holds", async () => {
    const range = {
      facilityId,
      startsAt: new Date("2026-11-28T13:00:00Z"),
      endsAt: new Date("2026-11-28T13:30:00Z"),
    }
    await expect(
      prisma.scheduleEntry.create({ data: { ...range, kind: "hold" } })
    ).rejects.toThrow()
    await expect(
      prisma.scheduleEntry.create({
        data: { ...range, kind: "booking", expiresAt: range.startsAt },
      })
    ).rejects.toThrow()
  })
})
