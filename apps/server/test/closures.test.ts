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
} from "./helpers/app.js"
import {
  bookingHelpers,
  local,
  morgan,
  NOW,
  sat,
  SATURDAY,
  type Agent,
} from "./helpers/bookings.js"

const clock = new FixedClock(NOW)
let app: INestApplication
let other: INestApplication
const { activeAccount, book, publicStatus } = bookingHelpers(() => app)
const onOther = bookingHelpers(() => other)

beforeAll(async () => {
  app = await createTestApp({ clock })
  other = await createTestApp({ clock })
})

afterAll(async () => {
  await Promise.all([app.close(), other.close()])
})

beforeEach(async () => {
  clock.set(NOW)
  await resetSchedule(app)
  await resetAccounts(app)
})

/** Saturday wall-clock times as the Staff form sends them. */
const satLocal = (from: string, to: string) => ({
  startsLocal: `${SATURDAY}T${from}`,
  endsLocal: `${SATURDAY}T${to}`,
})

function close(
  agent: Agent,
  facility: string,
  range: { startsLocal: string; endsLocal: string },
  reason = "Net replacement",
  key: string = randomUUID()
) {
  return agent
    .post("/api/closures")
    .set("Idempotency-Key", key)
    .send({ facility, ...range, reason })
}

async function bookOk(
  agent: Agent,
  facility: string,
  from: string,
  to: string
) {
  const response = await book(agent, facility, sat(from, to))
  expect(response.status).toBe(201)
  return response.body as { id: string }
}

const statusOf = async (id: string) =>
  (await prismaOf(app).booking.findUniqueOrThrow({ where: { id } })).status

describe("AC-010 creating a closure", () => {
  it("closes the period, cancels overlapping future bookings, notifies each booker once and audits it", async () => {
    const sam = await activeAccount(identities.staff, "staff")
    const riley = await activeAccount(identities.resident)
    const morganAgent = await activeAccount(morgan)
    const inside = await bookOk(riley, "maple-tennis-1", "10:00", "11:00")
    const overlapping = await bookOk(
      morganAgent,
      "maple-tennis-1",
      "11:30",
      "12:30"
    )
    const outside = await bookOk(riley, "maple-tennis-1", "15:00", "16:00")
    const elsewhere = await bookOk(
      morganAgent,
      "maple-tennis-2",
      "10:00",
      "11:00"
    )

    const response = await close(
      sam,
      "maple-tennis-1",
      satLocal("09:00", "12:00"),
      "Net replacement"
    )

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      facility: { slug: "maple-tennis-1" },
      startsAt: local(SATURDAY, "09:00"),
      endsAt: local(SATURDAY, "12:00"),
      reason: "Net replacement",
      endedAt: null,
      cancelledBookings: 2,
    })
    expect(await statusOf(inside.id)).toBe("cancelled")
    expect(await statusOf(overlapping.id)).toBe("cancelled")
    expect(await statusOf(outside.id)).toBe("confirmed")
    expect(await statusOf(elsewhere.id)).toBe("confirmed")
    for (const time of ["09:00", "10:30", "11:30"]) {
      expect(
        await publicStatus("maple-tennis-1", SATURDAY, local(SATURDAY, time))
      ).toBe("closed")
    }
    // Morgan's whole booking is cancelled, including the part after 12:00.
    expect(
      await publicStatus("maple-tennis-1", SATURDAY, local(SATURDAY, "12:00"))
    ).toBe("available")

    const rileyNotes = (await riley.get("/api/notifications").expect(200)).body
    const morganNotes = (
      await morganAgent.get("/api/notifications").expect(200)
    ).body
    expect(rileyNotes).toHaveLength(1)
    expect(morganNotes).toHaveLength(1)
    expect(rileyNotes[0]).toMatchObject({
      type: "booking_cancelled_closure",
      bookingId: inside.id,
    })
    expect(rileyNotes[0].message).toContain("Net replacement")

    const mine = (await riley.get("/api/bookings/mine").expect(200)).body
    expect(mine.find((b: { id: string }) => b.id === inside.id)).toMatchObject({
      status: "cancelled",
      reason: "Closed: Net replacement",
    })

    const actions = (
      await prismaOf(app).auditLog.findMany({ select: { action: true } })
    ).map((entry) => entry.action)
    expect(actions.filter((a) => a === "closure_created")).toHaveLength(1)
    expect(actions.filter((a) => a === "booking_cancelled")).toHaveLength(2)
  })

  it("leaves bookings that have already ended alone", async () => {
    const admin = await activeAccount(identities.admin, "admin")
    const riley = await activeAccount(identities.resident)
    const early = await bookOk(riley, "maple-tennis-1", "08:00", "08:30")
    clock.set(local(SATURDAY, "08:30"))

    await close(admin, "maple-tennis-1", satLocal("08:00", "10:00")).expect(201)

    expect(await statusOf(early.id)).toBe("confirmed")
    expect(await prismaOf(app).notification.count()).toBe(0)
  })

  it("refuses new bookings inside the closure", async () => {
    const sam = await activeAccount(identities.staff, "staff")
    const riley = await activeAccount(identities.resident)
    await close(sam, "maple-tennis-1", satLocal("09:00", "12:00")).expect(201)

    const response = await book(riley, "maple-tennis-1", sat("10:00", "11:00"))

    expect(response.status).toBe(409)
    expect(response.body.code).toBe("slot_unavailable")
  })

  it("lets only Facility Staff and Admins close facilities", async () => {
    const riley = await activeAccount(identities.resident)
    const pending = await signInOk(app, identities.pending)

    await close(riley, "maple-tennis-1", satLocal("09:00", "12:00")).expect(403)
    await close(pending, "maple-tennis-1", satLocal("09:00", "12:00")).expect(
      403
    )
    await request(app.getHttpServer())
      .post("/api/closures")
      .set("Idempotency-Key", randomUUID())
      .send({
        facility: "maple-tennis-1",
        ...satLocal("09:00", "12:00"),
        reason: "x",
      })
      .expect(401)
    expect(await prismaOf(app).closure.count()).toBe(0)
  })

  it.each([
    ["ending before it starts", satLocal("12:00", "09:00"), "Repairs"],
    [
      "already over",
      { startsLocal: "2026-11-27T08:00", endsLocal: "2026-11-27T09:00" },
      "Repairs",
    ],
    ["without a reason", satLocal("09:00", "12:00"), "   "],
    [
      "with a malformed time",
      { startsLocal: "2026-11-28 09:00", endsLocal: "noon" },
      "Repairs",
    ],
  ])("rejects a closure %s", async (_label, range, reason) => {
    const sam = await activeAccount(identities.staff, "staff")
    await close(sam, "maple-tennis-1", range, reason).expect(400)
  })

  it("rejects an unknown facility", async () => {
    const sam = await activeAccount(identities.staff, "staff")
    await close(sam, "no-such-court", satLocal("09:00", "12:00")).expect(404)
  })

  it("returns the recorded closure for a retried request without repeating side effects", async () => {
    const sam = await activeAccount(identities.staff, "staff")
    const riley = await activeAccount(identities.resident)
    await bookOk(riley, "maple-tennis-1", "10:00", "11:00")
    const key = randomUUID()

    const first = await close(
      sam,
      "maple-tennis-1",
      satLocal("09:00", "12:00"),
      "Leak",
      key
    )
    const again = await close(
      sam,
      "maple-tennis-1",
      satLocal("09:00", "12:00"),
      "Leak",
      key
    )

    expect(again.status).toBe(201)
    expect(again.body.id).toBe(first.body.id)
    expect(await prismaOf(app).closure.count()).toBe(1)
    expect(await prismaOf(app).notification.count()).toBe(1)
    await close(
      sam,
      "maple-tennis-1",
      satLocal("13:00", "14:00"),
      "Leak",
      key
    ).expect(422)
  })

  it("lists current and upcoming closures for Staff", async () => {
    const sam = await activeAccount(identities.staff, "staff")
    const riley = await activeAccount(identities.resident)
    await close(sam, "maple-tennis-1", satLocal("09:00", "12:00")).expect(201)
    await close(sam, "willow-soccer-field", satLocal("08:00", "10:00")).expect(
      201
    )

    const response = await sam.get("/api/closures").expect(200)

    expect(
      response.body.map((c: { facility: { slug: string } }) => c.facility.slug)
    ).toEqual(["willow-soccer-field", "maple-tennis-1"])
    await riley.get("/api/closures").expect(403)
  })
})

describe("AC-010 ending a closure", () => {
  it("releases only that closure's restriction and keeps cancellations", async () => {
    const sam = await activeAccount(identities.staff, "staff")
    const admin = await activeAccount(identities.admin, "admin")
    const riley = await activeAccount(identities.resident)
    const morganAgent = await activeAccount(morgan)
    const cancelled = await bookOk(riley, "maple-tennis-1", "10:00", "11:00")
    const blocked = await bookOk(
      morganAgent,
      "maple-tennis-1",
      "11:00",
      "11:30"
    )
    await admin
      .post(`/api/admin/bookings/${blocked.id}/block`)
      .send({ reason: "League finals" })
      .expect(200)
    const wide = (
      await close(sam, "maple-tennis-1", satLocal("09:00", "12:00"))
    ).body
    await close(
      sam,
      "maple-tennis-1",
      satLocal("09:00", "09:30"),
      "Line painting"
    ).expect(201)

    const response = await sam.post(`/api/closures/${wide.id}/end`).expect(200)

    expect(response.body.endedAt).toBe(NOW)
    const status = (time: string) =>
      publicStatus("maple-tennis-1", SATURDAY, local(SATURDAY, time))
    expect(await status("10:00")).toBe("available")
    expect(await status("09:00")).toBe("closed")
    expect(await status("11:00")).toBe("blocked")
    expect(await statusOf(cancelled.id)).toBe("cancelled")
    const ended = await prismaOf(app).auditLog.count({
      where: { action: "closure_ended" },
    })
    expect(ended).toBe(1)
    await sam.post(`/api/closures/${wide.id}/end`).expect(409)
  })

  it("lets only Facility Staff and Admins end closures", async () => {
    const sam = await activeAccount(identities.staff, "staff")
    const riley = await activeAccount(identities.resident)
    const closure = (
      await close(sam, "maple-tennis-1", satLocal("09:00", "12:00"))
    ).body

    await riley.post(`/api/closures/${closure.id}/end`).expect(403)
  })
})

describe("AC-011 approval racing a closure", () => {
  async function pendingRequest() {
    const admin = await activeAccount(identities.admin, "admin")
    const sam = await activeAccount(identities.staff, "staff")
    const riley = await activeAccount(identities.resident)
    const pending = await bookOk(riley, "cedar-basketball", "10:00", "11:00")
    return { admin, sam, pending }
  }

  it("fails the approval when the closure commits first", async () => {
    const { admin, sam, pending } = await pendingRequest()
    await close(sam, "cedar-basketball", satLocal("09:00", "12:00")).expect(201)

    const approval = await admin.post(
      `/api/admin/bookings/${pending.id}/approve`
    )

    expect(approval.status).toBe(409)
    expect(await statusOf(pending.id)).toBe("cancelled")
  })

  it("cancels the approved booking when the approval commits first", async () => {
    const { admin, sam, pending } = await pendingRequest()
    await admin.post(`/api/admin/bookings/${pending.id}/approve`).expect(200)

    const closure = await close(
      sam,
      "cedar-basketball",
      satLocal("09:00", "12:00")
    )

    expect(closure.body.cancelledBookings).toBe(1)
    expect(await statusOf(pending.id)).toBe("cancelled")
  })

  it("leaves no active booking inside the closure when both arrive together", async () => {
    const orders: string[] = []
    for (let round = 1; round <= 6; round++) {
      await resetSchedule(app)
      await resetAccounts(app)
      const { sam, pending } = await pendingRequest()
      // The approval runs on a second app instance with its own pool.
      const adminOther = await onOther.activeAccount(identities.admin, "admin")

      const [approval, closure] = await Promise.all([
        adminOther.post(`/api/admin/bookings/${pending.id}/approve`),
        close(sam, "cedar-basketball", satLocal("09:00", "12:00")),
      ])

      expect(closure.status).toBe(201)
      expect(await statusOf(pending.id)).toBe("cancelled")
      expect(
        await prismaOf(app).scheduleEntry.count({
          where: { kind: { in: ["hold", "booking"] } },
        })
      ).toBe(0)
      orders.push(approval.status === 200 ? "approval first" : "closure first")
    }
    console.info(`[closure race] ${orders.join(", ")}`)
  })
})
