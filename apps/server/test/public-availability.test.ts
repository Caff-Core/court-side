import type { INestApplication } from "@nestjs/common"
import request from "supertest"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { FixedClock } from "../src/common/clock.js"
import {
  createTestApp,
  identities,
  prismaOf,
  resetAccounts,
  resetSchedule,
  signInOk,
} from "./helpers/app.js"

// Friday 2026-11-27, 14:10 in Toronto (UTC-5).
const NOW = "2026-11-27T19:10:00Z"
const clock = new FixedClock(NOW)
let app: INestApplication

beforeAll(async () => {
  app = await createTestApp({ clock })
})

afterAll(async () => {
  await app.close()
})

beforeEach(async () => {
  clock.set(NOW)
  await resetSchedule(app)
  await resetAccounts(app)
})

const anonymous = () => request(app.getHttpServer())

type Slot = { startsAt: string; endsAt: string; status: string }

function slotAt(slots: Slot[], startsAt: string) {
  const slot = slots.find((s) => s.startsAt === startsAt)
  if (!slot) throw new Error(`No slot starts at ${startsAt}`)
  return slot
}

async function facilityId(slug: string) {
  const facility = await prismaOf(app).facility.findUniqueOrThrow({
    where: { slug },
  })
  return facility.id
}

async function fictionalBooker() {
  return prismaOf(app).user.create({
    data: {
      id: "booker-1",
      name: "Morgan Booker",
      email: "morgan.booker@example.test",
      status: "active",
      role: "resident",
    },
  })
}

describe("AC-004 facility list", () => {
  it("lists every facility to anonymous visitors without internal ids", async () => {
    const response = await anonymous().get("/api/facilities").expect(200)

    expect(response.body).toHaveLength(4)
    expect(response.body[0]).toEqual({
      slug: "cedar-basketball",
      name: "Cedar Park Basketball Court",
      sport: "Basketball",
      requiresApproval: true,
      timeZone: "America/Toronto",
    })
  })
})

describe("AC-004 public availability", () => {
  it("shows today's open slots in the facility's time zone", async () => {
    const response = await anonymous()
      .get("/api/facilities/maple-tennis-1/availability")
      .expect(200)

    expect(response.body).toMatchObject({
      facility: { slug: "maple-tennis-1", timeZone: "America/Toronto" },
      date: "2026-11-27",
      today: "2026-11-27",
      firstDate: "2026-11-27",
      lastDate: "2026-12-10",
      previousDate: null,
      nextDate: "2026-11-28",
      open: true,
    })
    // Weekday hours 07:00-21:00 local, in 30-minute slots.
    const slots: Slot[] = response.body.slots
    expect(slots).toHaveLength(28)
    expect(slots[0]).toEqual({
      startsAt: "2026-11-27T12:00:00.000Z",
      endsAt: "2026-11-27T12:30:00.000Z",
      status: "past",
    })
    expect(slots.at(-1)!.endsAt).toBe("2026-11-28T02:00:00.000Z")
    // The 14:00 slot has not ended at 14:10, so it still shows its status.
    expect(slotAt(slots, "2026-11-27T19:00:00.000Z").status).toBe("available")
    expect(slotAt(slots, "2026-11-27T18:30:00.000Z").status).toBe("past")
  })

  it("shows weekend hours for a later date in the window", async () => {
    const response = await anonymous()
      .get("/api/facilities/maple-tennis-1/availability?date=2026-11-28")
      .expect(200)

    expect(response.body.previousDate).toBe("2026-11-27")
    // Weekend hours 08:00-20:00 local.
    expect(response.body.slots).toHaveLength(24)
    expect(response.body.slots[0].startsAt).toBe("2026-11-28T13:00:00.000Z")
    expect(
      response.body.slots.every((s: Slot) => s.status === "available")
    ).toBe(true)
  })

  it("keeps slot boundaries right on the day clocks fall back", async () => {
    clock.set("2026-10-31T16:00:00Z")

    const response = await anonymous()
      .get("/api/facilities/maple-tennis-1/availability?date=2026-11-01")
      .expect(200)

    expect(response.body.slots).toHaveLength(24)
    expect(response.body.slots[0].startsAt).toBe("2026-11-01T13:00:00.000Z")
    expect(response.body.slots.at(-1).endsAt).toBe("2026-11-02T01:00:00.000Z")
  })

  it("maps schedule entries to public statuses without booker details or reasons", async () => {
    const id = await facilityId("maple-tennis-1")
    const booker = await fictionalBooker()
    const at = (time: string) => new Date(`2026-11-28T${time}:00Z`)
    await prismaOf(app).scheduleEntry.createMany({
      data: [
        {
          facilityId: id,
          kind: "hold",
          startsAt: at("13:00"),
          endsAt: at("13:30"),
          expiresAt: at("13:00"),
          accountId: booker.id,
        },
        {
          facilityId: id,
          kind: "booking",
          startsAt: at("14:00"),
          endsAt: at("15:00"),
          accountId: booker.id,
        },
        {
          facilityId: id,
          kind: "event",
          startsAt: at("15:00"),
          endsAt: at("15:30"),
          reason: "Junior league practice for the Okafor family",
        },
        {
          facilityId: id,
          kind: "block",
          startsAt: at("16:00"),
          endsAt: at("16:30"),
          accountId: booker.id,
          reason: "Repeated no-shows by this resident",
        },
        {
          facilityId: id,
          kind: "closure",
          startsAt: at("17:00"),
          endsAt: at("18:00"),
          reason: "Broken glass near the north fence",
        },
      ],
    })

    const response = await anonymous()
      .get("/api/facilities/maple-tennis-1/availability?date=2026-11-28")
      .expect(200)
    const slots: Slot[] = response.body.slots

    expect(slotAt(slots, "2026-11-28T13:00:00.000Z").status).toBe("pending")
    expect(slotAt(slots, "2026-11-28T14:00:00.000Z").status).toBe("booked")
    expect(slotAt(slots, "2026-11-28T14:30:00.000Z").status).toBe("booked")
    // End-exclusive ranges: the booking ends where the event starts.
    expect(slotAt(slots, "2026-11-28T15:00:00.000Z").status).toBe("event")
    expect(slotAt(slots, "2026-11-28T15:30:00.000Z").status).toBe("available")
    expect(slotAt(slots, "2026-11-28T16:00:00.000Z").status).toBe("blocked")
    expect(slotAt(slots, "2026-11-28T17:30:00.000Z").status).toBe("closed")

    for (const slot of slots) {
      expect(Object.keys(slot).sort()).toEqual(["endsAt", "startsAt", "status"])
    }
    const body = JSON.stringify(response.body)
    for (const secret of [
      booker.id,
      booker.name,
      booker.email,
      "Okafor",
      "no-shows",
      "Broken glass",
    ]) {
      expect(body).not.toContain(secret)
    }
  })

  it("frees a slot once its pending hold has expired, before any cleanup", async () => {
    const id = await facilityId("maple-tennis-1")
    await prismaOf(app).scheduleEntry.create({
      data: {
        facilityId: id,
        kind: "hold",
        startsAt: new Date("2026-11-28T13:00:00Z"),
        endsAt: new Date("2026-11-28T13:30:00Z"),
        expiresAt: new Date("2026-11-27T19:00:00Z"),
      },
    })

    const response = await anonymous()
      .get("/api/facilities/maple-tennis-1/availability?date=2026-11-28")
      .expect(200)

    expect(response.body.slots[0].status).toBe("available")
  })

  it("shows a closure over a block when they overlap", async () => {
    const id = await facilityId("maple-tennis-1")
    const range = {
      facilityId: id,
      startsAt: new Date("2026-11-28T13:00:00Z"),
      endsAt: new Date("2026-11-28T14:00:00Z"),
    }
    await prismaOf(app).scheduleEntry.createMany({
      data: [
        { ...range, kind: "block" },
        { ...range, kind: "closure" },
      ],
    })

    const response = await anonymous()
      .get("/api/facilities/maple-tennis-1/availability?date=2026-11-28")
      .expect(200)

    expect(response.body.slots[0].status).toBe("closed")
  })

  it("only reads entries for the requested facility", async () => {
    await prismaOf(app).scheduleEntry.create({
      data: {
        facilityId: await facilityId("maple-tennis-2"),
        kind: "closure",
        startsAt: new Date("2026-11-28T13:00:00Z"),
        endsAt: new Date("2026-11-28T14:00:00Z"),
      },
    })

    const response = await anonymous()
      .get("/api/facilities/maple-tennis-1/availability?date=2026-11-28")
      .expect(200)

    expect(response.body.slots[0].status).toBe("available")
  })

  it("gives a pending user exactly the public view", async () => {
    const pending = await signInOk(app, identities.pending)
    const path = "/api/facilities/maple-tennis-1/availability?date=2026-11-28"

    const asPending = await pending.get(path).expect(200)
    const asAnonymous = await anonymous().get(path).expect(200)

    expect(asPending.body).toEqual(asAnonymous.body)
    await pending.get("/api/admin/accounts").expect(403)
  })

  it("limits browsing to the 14-day window", async () => {
    await anonymous()
      .get("/api/facilities/maple-tennis-1/availability?date=2026-11-26")
      .expect(400)
    await anonymous()
      .get("/api/facilities/maple-tennis-1/availability?date=2026-12-11")
      .expect(400)
    const last = await anonymous()
      .get("/api/facilities/maple-tennis-1/availability?date=2026-12-10")
      .expect(200)
    expect(last.body.nextDate).toBeNull()
  })

  it("rejects malformed dates and unknown facilities", async () => {
    await anonymous()
      .get("/api/facilities/maple-tennis-1/availability?date=2026-02-30")
      .expect(400)
    await anonymous()
      .get("/api/facilities/maple-tennis-1/availability?date=tomorrow")
      .expect(400)
    await anonymous()
      .get("/api/facilities/no-such-court/availability")
      .expect(404)
  })
})
