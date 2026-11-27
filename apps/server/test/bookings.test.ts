import { randomUUID } from "node:crypto"

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
  type FixtureIdentity,
} from "./helpers/app.js"

// Friday 2026-11-27, 14:10 in Toronto (UTC-5).
const NOW = "2026-11-27T19:10:00.000Z"
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

type Agent = ReturnType<typeof request.agent>
type Range = { startsAt: string; endsAt: string }

/** Toronto wall-clock time on a date in late November (UTC-5) as UTC ISO. */
function local(date: string, time: string) {
  const [hour, minute] = time.split(":").map(Number) as [number, number]
  const [y, m, d] = date.split("-").map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d, hour + 5, minute)).toISOString()
}
const SATURDAY = "2026-11-28"
const sat = (from: string, to: string): Range => ({
  startsAt: local(SATURDAY, from),
  endsAt: local(SATURDAY, to),
})

async function activeAccount(
  identity: FixtureIdentity,
  role: "resident" | "staff" | "admin" = "resident"
) {
  const agent = await signInOk(app, identity)
  await prismaOf(app).user.update({
    where: { email: identity.email },
    data: { status: "active", role },
  })
  return agent
}

const morgan: FixtureIdentity = {
  subject: "fixture-morgan",
  email: "morgan.player@example.test",
  name: "Morgan Player",
}

function book(
  agent: Agent,
  facility: string,
  range: Range,
  key: string = randomUUID()
) {
  return agent
    .post("/api/bookings")
    .set("Idempotency-Key", key)
    .send({ facility, ...range })
}

async function facilityId(slug: string) {
  const facility = await prismaOf(app).facility.findUniqueOrThrow({
    where: { slug },
  })
  return facility.id
}

async function publicStatus(slug: string, date: string, startsAt: string) {
  const response = await request(app.getHttpServer())
    .get(`/api/facilities/${slug}/availability?date=${date}`)
    .expect(200)
  return response.body.slots.find(
    (slot: Range & { status: string }) => slot.startsAt === startsAt
  )?.status
}

describe("AC-005 who can book and which ranges are valid", () => {
  it("confirms an aligned request at an auto-confirm facility", async () => {
    const riley = await activeAccount(identities.resident)

    const response = await book(riley, "maple-tennis-1", sat("10:00", "11:00"))

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      facility: "maple-tennis-1",
      ...sat("10:00", "11:00"),
      status: "confirmed",
      expiresAt: null,
    })
    expect(
      await publicStatus("maple-tennis-1", SATURDAY, local(SATURDAY, "10:30"))
    ).toBe("booked")
  })

  it("lets Facility Staff and Admins book too", async () => {
    const sam = await activeAccount(identities.staff, "staff")
    await book(sam, "maple-tennis-1", sat("10:00", "10:30")).expect(201)
  })

  it("refuses visitors and pending accounts", async () => {
    await request(app.getHttpServer())
      .post("/api/bookings")
      .set("Idempotency-Key", randomUUID())
      .send({ facility: "maple-tennis-1", ...sat("10:00", "11:00") })
      .expect(401)
    const pending = await signInOk(app, identities.pending)
    await book(pending, "maple-tennis-1", sat("10:00", "11:00")).expect(403)
    expect(await prismaOf(app).booking.count()).toBe(0)
  })

  it.each([
    ["not aligned to 30 minutes", sat("10:15", "11:15")],
    ["ending before it starts", sat("11:00", "10:00")],
    ["empty", sat("10:00", "10:00")],
    ["before opening", sat("07:30", "08:30")],
    ["after closing", sat("19:30", "20:30")],
    [
      "spanning two days",
      {
        startsAt: local(SATURDAY, "19:00"),
        endsAt: local("2026-11-29", "09:00"),
      },
    ],
    [
      "already started",
      {
        startsAt: local("2026-11-27", "14:00"),
        endsAt: local("2026-11-27", "15:00"),
      },
    ],
    [
      "past the 14-day window",
      {
        startsAt: local("2026-12-11", "10:00"),
        endsAt: local("2026-12-11", "11:00"),
      },
    ],
  ])("rejects a range %s", async (_label, range) => {
    const riley = await activeAccount(identities.resident)
    const response = await book(riley, "maple-tennis-1", range)
    expect(response.status).toBe(400)
    expect(await prismaOf(app).booking.count()).toBe(0)
  })

  it("accepts the last slot before closing on the last day of the window", async () => {
    const riley = await activeAccount(identities.resident)
    // Thursday 2026-12-10: weekday hours close at 21:00.
    await book(riley, "maple-tennis-1", {
      startsAt: local("2026-12-10", "20:30"),
      endsAt: local("2026-12-10", "21:00"),
    }).expect(201)
  })

  it("rejects malformed bodies, a missing key and unknown facilities", async () => {
    const riley = await activeAccount(identities.resident)
    await riley
      .post("/api/bookings")
      .send({ facility: "maple-tennis-1", ...sat("10:00", "11:00") })
      .expect(400)
    await book(riley, "maple-tennis-1", {
      startsAt: "tomorrow",
      endsAt: "later",
    }).expect(400)
    await book(riley, "no-such-court", sat("10:00", "11:00")).expect(404)
  })
})

describe("AC-005 two active bookings per facility", () => {
  it("allows two future bookings and refuses a third at the same facility", async () => {
    const riley = await activeAccount(identities.resident)
    await book(riley, "maple-tennis-1", sat("09:00", "10:00")).expect(201)
    await book(riley, "maple-tennis-1", sat("12:00", "13:00")).expect(201)

    const third = await book(riley, "maple-tennis-1", sat("15:00", "16:00"))

    expect(third.status).toBe(409)
    expect(third.body.code).toBe("booking_limit")
    await book(riley, "maple-tennis-2", sat("15:00", "16:00")).expect(201)
  })

  it("refuses the third even when it races the second", async () => {
    const riley = await activeAccount(identities.resident)
    await book(riley, "maple-tennis-1", sat("09:00", "10:00")).expect(201)

    const results = await Promise.all([
      book(riley, "maple-tennis-1", sat("12:00", "13:00")),
      book(riley, "maple-tennis-1", sat("15:00", "16:00")),
    ])

    expect(results.map((r) => r.status).sort()).toEqual([201, 409])
    expect(results.find((r) => r.status === 409)!.body.code).toBe(
      "booking_limit"
    )
    expect(
      await prismaOf(app).booking.count({
        where: { status: { in: ["pending", "confirmed"] } },
      })
    ).toBe(2)
  })

  it("stops counting a booking once it has ended", async () => {
    const riley = await activeAccount(identities.resident)
    await book(riley, "maple-tennis-1", sat("08:00", "08:30")).expect(201)
    await book(riley, "maple-tennis-1", sat("12:00", "13:00")).expect(201)

    clock.set(local(SATURDAY, "08:30"))

    await book(riley, "maple-tennis-1", sat("15:00", "16:00")).expect(201)
  })
})

describe("AC-006 overlap and adjacency", () => {
  it("keeps adjacent intervals bookable", async () => {
    const riley = await activeAccount(identities.resident)
    const morganAgent = await activeAccount(morgan)
    await book(riley, "maple-tennis-1", sat("10:00", "11:00")).expect(201)
    await book(morganAgent, "maple-tennis-1", sat("11:00", "12:00")).expect(201)
    await book(morganAgent, "maple-tennis-1", sat("09:30", "10:00")).expect(201)
  })

  it("rejects an overlapping request with nearby alternatives of the same length", async () => {
    const riley = await activeAccount(identities.resident)
    const morganAgent = await activeAccount(morgan)
    await book(riley, "maple-tennis-1", sat("10:00", "11:00")).expect(201)

    const response = await book(
      morganAgent,
      "maple-tennis-1",
      sat("10:30", "11:30")
    )

    expect(response.status).toBe(409)
    expect(response.body.code).toBe("slot_unavailable")
    const alternatives: Range[] = response.body.alternatives
    expect(alternatives.length).toBeGreaterThan(0)
    expect(alternatives.length).toBeLessThanOrEqual(3)
    expect(alternatives[0]).toEqual(sat("11:00", "12:00"))
    for (const alt of alternatives) {
      expect(Date.parse(alt.endsAt) - Date.parse(alt.startsAt)).toBe(3_600_000)
      const overlaps =
        alt.startsAt < local(SATURDAY, "11:00") &&
        alt.endsAt > local(SATURDAY, "10:00")
      expect(overlaps).toBe(false)
    }
  })

  it("gives exactly one of two simultaneous overlapping requests the slot", async () => {
    const riley = await activeAccount(identities.resident)
    const morganAgent = await activeAccount(morgan)

    const results = await Promise.all([
      book(riley, "maple-tennis-1", sat("10:00", "11:00")),
      book(morganAgent, "maple-tennis-1", sat("10:30", "11:30")),
    ])

    expect(results.map((r) => r.status).sort()).toEqual([201, 409])
    const loser = results.find((r) => r.status === 409)!
    expect(loser.body.code).toBe("slot_unavailable")
    expect(loser.body.alternatives.length).toBeGreaterThan(0)
    expect(
      await prismaOf(app).scheduleEntry.count({
        where: { kind: { in: ["hold", "booking"] } },
      })
    ).toBe(1)
  })

  it("rejects time taken by an event, block or closure", async () => {
    const riley = await activeAccount(identities.resident)
    const id = await facilityId("maple-tennis-1")
    const kinds = ["event", "block", "closure"] as const
    await prismaOf(app).scheduleEntry.createMany({
      data: kinds.map((kind, index) => ({
        facilityId: id,
        kind,
        startsAt: new Date(local(SATURDAY, `${10 + index * 2}:00`)),
        endsAt: new Date(local(SATURDAY, `${11 + index * 2}:00`)),
      })),
    })

    for (const start of ["10:30", "12:00", "14:30"]) {
      const [h, m] = start.split(":").map(Number) as [number, number]
      const end = `${h + 1}:${String(m).padStart(2, "0")}`
      const response = await book(riley, "maple-tennis-1", sat(start, end))
      expect(response.status).toBe(409)
      expect(response.body.code).toBe("slot_unavailable")
    }
  })

  it("lets the database itself refuse overlapping holds and bookings", async () => {
    const id = await facilityId("maple-tennis-1")
    const prisma = prismaOf(app)
    await prisma.scheduleEntry.create({
      data: {
        facilityId: id,
        kind: "booking",
        startsAt: new Date(local(SATURDAY, "10:00")),
        endsAt: new Date(local(SATURDAY, "11:00")),
      },
    })

    await expect(
      prisma.scheduleEntry.create({
        data: {
          facilityId: id,
          kind: "hold",
          startsAt: new Date(local(SATURDAY, "10:30")),
          endsAt: new Date(local(SATURDAY, "11:30")),
          expiresAt: new Date(local(SATURDAY, "10:30")),
        },
      })
    ).rejects.toThrow()
    // Closures may overlap bookings; the closure flow cancels them.
    await prisma.scheduleEntry.create({
      data: {
        facilityId: id,
        kind: "closure",
        startsAt: new Date(local(SATURDAY, "10:00")),
        endsAt: new Date(local(SATURDAY, "12:00")),
      },
    })
  })
})

describe("AC-007 pending holds", () => {
  it("holds an approval-only slot until its start when that comes first", async () => {
    const riley = await activeAccount(identities.resident)

    const response = await book(
      riley,
      "cedar-basketball",
      sat("10:00", "11:00")
    )

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      status: "pending",
      expiresAt: local(SATURDAY, "10:00"),
    })
    expect(
      await publicStatus("cedar-basketball", SATURDAY, local(SATURDAY, "10:00"))
    ).toBe("pending")
  })

  it("holds for 24 hours when the slot is further away", async () => {
    const riley = await activeAccount(identities.resident)

    const response = await book(riley, "cedar-basketball", {
      startsAt: local("2026-11-29", "10:00"),
      endsAt: local("2026-11-29", "11:00"),
    })

    expect(response.body.expiresAt).toBe("2026-11-28T19:10:00.000Z")
  })

  it("blocks overlapping requests while held and frees the time at expiry before cleanup", async () => {
    const riley = await activeAccount(identities.resident)
    const morganAgent = await activeAccount(morgan)
    const sunday = {
      startsAt: local("2026-11-29", "10:00"),
      endsAt: local("2026-11-29", "11:00"),
    }
    await book(riley, "cedar-basketball", sunday).expect(201)
    const blocked = await book(morganAgent, "cedar-basketball", sunday)
    expect(blocked.status).toBe(409)

    clock.set("2026-11-28T19:10:00.000Z")

    // No write has run since expiry, so no cleanup either.
    expect(
      await prismaOf(app).booking.count({ where: { status: "pending" } })
    ).toBe(1)
    expect(
      await publicStatus("cedar-basketball", "2026-11-29", sunday.startsAt)
    ).toBe("available")
    const taken = await book(morganAgent, "cedar-basketball", sunday)
    expect(taken.status).toBe(201)
    const expired = await prismaOf(app).booking.findFirstOrThrow({
      where: { account: { email: identities.resident.email } },
    })
    expect(expired.status).toBe("expired")
  })

  it("stops counting an expired hold toward the cap", async () => {
    const riley = await activeAccount(identities.resident)
    await book(riley, "cedar-basketball", sat("10:00", "11:00")).expect(201)
    await book(riley, "cedar-basketball", {
      startsAt: local("2026-11-29", "10:00"),
      endsAt: local("2026-11-29", "11:00"),
    }).expect(201)
    const nextWeek = {
      startsAt: local("2026-12-01", "10:00"),
      endsAt: local("2026-12-01", "11:00"),
    }
    expect((await book(riley, "cedar-basketball", nextWeek)).status).toBe(409)

    // The Saturday hold expires at its start.
    clock.set(local(SATURDAY, "10:00"))

    await book(riley, "cedar-basketball", nextWeek).expect(201)
  })
})

describe("AC-007 retried submissions", () => {
  it("returns the first outcome for a retried submission and books once", async () => {
    const riley = await activeAccount(identities.resident)
    const key = randomUUID()

    const first = await book(
      riley,
      "maple-tennis-1",
      sat("10:00", "11:00"),
      key
    )
    const again = await book(
      riley,
      "maple-tennis-1",
      sat("10:00", "11:00"),
      key
    )

    expect(first.status).toBe(201)
    expect(again.status).toBe(201)
    expect(again.body).toEqual(first.body)
    expect(await prismaOf(app).booking.count()).toBe(1)
    expect(await prismaOf(app).bookingAttempt.count()).toBe(1)
  })

  it("books once when the same submission arrives twice at the same moment", async () => {
    const riley = await activeAccount(identities.resident)
    const key = randomUUID()

    const results = await Promise.all([
      book(riley, "maple-tennis-1", sat("10:00", "11:00"), key),
      book(riley, "maple-tennis-1", sat("10:00", "11:00"), key),
    ])

    expect(results.map((r) => r.status)).toEqual([201, 201])
    expect(results[1]!.body).toEqual(results[0]!.body)
    expect(await prismaOf(app).booking.count()).toBe(1)
  })

  it("replays a recorded conflict instead of trying again", async () => {
    const riley = await activeAccount(identities.resident)
    const morganAgent = await activeAccount(morgan)
    await book(riley, "maple-tennis-1", sat("10:00", "11:00")).expect(201)
    const key = randomUUID()
    const first = await book(
      morganAgent,
      "maple-tennis-1",
      sat("10:00", "11:00"),
      key
    )
    expect(first.status).toBe(409)

    const again = await book(
      morganAgent,
      "maple-tennis-1",
      sat("10:00", "11:00"),
      key
    )

    expect(again.status).toBe(409)
    expect(again.body).toEqual(first.body)
    expect(await prismaOf(app).bookingAttempt.count()).toBe(2)
  })

  it("refuses a reused key for a different request", async () => {
    const riley = await activeAccount(identities.resident)
    const key = randomUUID()
    await book(riley, "maple-tennis-1", sat("10:00", "11:00"), key).expect(201)

    await book(riley, "maple-tennis-1", sat("12:00", "13:00"), key).expect(422)
    expect(await prismaOf(app).booking.count()).toBe(1)
  })
})
