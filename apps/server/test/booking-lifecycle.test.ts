import type { INestApplication } from "@nestjs/common"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { FixedClock } from "../src/common/clock.js"
import {
  createTestApp,
  identities,
  prismaOf,
  resetAccounts,
  resetSchedule,
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
const { activeAccount, book, publicStatus } = bookingHelpers(() => app)

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

async function bookOk(
  agent: Agent,
  facility: string,
  from: string,
  to: string
) {
  const response = await book(agent, facility, sat(from, to))
  expect(response.status).toBe(201)
  return response.body as { id: string; status: string; expiresAt: string }
}

const audit = (action: string) =>
  prismaOf(app).auditLog.findMany({ where: { action: action as never } })

describe("AC-008 approval", () => {
  it("lets an Admin approve a pending request before its deadline", async () => {
    const admin = await activeAccount(identities.admin, "admin")
    const riley = await activeAccount(identities.resident)
    const pending = await bookOk(riley, "cedar-basketball", "10:00", "11:00")

    const response = await admin
      .post(`/api/admin/bookings/${pending.id}/approve`)
      .expect(200)

    expect(response.body).toMatchObject({
      id: pending.id,
      status: "confirmed",
      expiresAt: null,
    })
    expect(
      await publicStatus("cedar-basketball", SATURDAY, local(SATURDAY, "10:00"))
    ).toBe("booked")
    const [entry] = await audit("booking_approved")
    expect(entry).toMatchObject({ entityType: "booking", entityId: pending.id })
  })

  it("refuses approval from Residents and Facility Staff", async () => {
    const riley = await activeAccount(identities.resident)
    const sam = await activeAccount(identities.staff, "staff")
    const pending = await bookOk(riley, "cedar-basketball", "10:00", "11:00")

    await riley.post(`/api/admin/bookings/${pending.id}/approve`).expect(403)
    await sam.post(`/api/admin/bookings/${pending.id}/approve`).expect(403)
  })

  it("fails approval at the deadline and leaves the request expired", async () => {
    const admin = await activeAccount(identities.admin, "admin")
    const riley = await activeAccount(identities.resident)
    const pending = await bookOk(riley, "cedar-basketball", "10:00", "11:00")
    expect(pending.expiresAt).toBe(local(SATURDAY, "10:00"))

    clock.set(pending.expiresAt)
    const response = await admin.post(
      `/api/admin/bookings/${pending.id}/approve`
    )

    expect(response.status).toBe(409)
    expect(response.body.code).toBe("booking_expired")
    const stored = await prismaOf(app).booking.findUniqueOrThrow({
      where: { id: pending.id },
    })
    expect(stored.status).toBe("expired")
  })

  it("only approves pending requests", async () => {
    const admin = await activeAccount(identities.admin, "admin")
    const riley = await activeAccount(identities.resident)
    const confirmed = await bookOk(riley, "maple-tennis-1", "10:00", "11:00")

    const response = await admin.post(
      `/api/admin/bookings/${confirmed.id}/approve`
    )
    expect(response.status).toBe(409)
    await admin
      .post("/api/admin/bookings/0197a000-0000-7000-8000-00000000ffff/approve")
      .expect(404)
  })
})

describe("AC-008 cancellation by the requester", () => {
  it("lets the requester withdraw a pending request and frees the time", async () => {
    const riley = await activeAccount(identities.resident)
    const pending = await bookOk(riley, "cedar-basketball", "10:00", "11:00")

    const response = await riley
      .post(`/api/bookings/${pending.id}/cancel`)
      .expect(200)

    expect(response.body.status).toBe("cancelled")
    expect(
      await publicStatus("cedar-basketball", SATURDAY, local(SATURDAY, "10:00"))
    ).toBe("available")
    expect(await audit("booking_cancelled")).toHaveLength(1)
  })

  it("treats a cancellation exactly two hours before the start as timely", async () => {
    const riley = await activeAccount(identities.resident)
    const confirmed = await bookOk(riley, "maple-tennis-1", "10:00", "11:00")

    clock.set(local(SATURDAY, "08:00"))
    const response = await riley
      .post(`/api/bookings/${confirmed.id}/cancel`)
      .expect(200)

    expect(response.body.status).toBe("cancelled")
  })

  it("records a later pre-start cancellation as a no-show and releases the time", async () => {
    const riley = await activeAccount(identities.resident)
    const morganAgent = await activeAccount(morgan)
    const confirmed = await bookOk(riley, "maple-tennis-1", "10:00", "11:00")

    clock.set(local(SATURDAY, "08:01"))
    const response = await riley
      .post(`/api/bookings/${confirmed.id}/cancel`)
      .expect(200)

    expect(response.body.status).toBe("no_show")
    expect(
      await publicStatus("maple-tennis-1", SATURDAY, local(SATURDAY, "10:00"))
    ).toBe("available")
    await book(morganAgent, "maple-tennis-1", sat("10:00", "11:00")).expect(201)
    expect(await audit("booking_no_show")).toHaveLength(1)
  })

  it("refuses to cancel a booking that has started", async () => {
    const riley = await activeAccount(identities.resident)
    const confirmed = await bookOk(riley, "maple-tennis-1", "10:00", "11:00")

    clock.set(local(SATURDAY, "10:00"))
    const response = await riley.post(`/api/bookings/${confirmed.id}/cancel`)

    expect(response.status).toBe(409)
  })

  it("does not let other users cancel it", async () => {
    const riley = await activeAccount(identities.resident)
    const morganAgent = await activeAccount(morgan)
    const admin = await activeAccount(identities.admin, "admin")
    const confirmed = await bookOk(riley, "maple-tennis-1", "10:00", "11:00")

    await morganAgent.post(`/api/bookings/${confirmed.id}/cancel`).expect(404)
    await admin.post(`/api/bookings/${confirmed.id}/cancel`).expect(404)
    const stored = await prismaOf(app).booking.findUniqueOrThrow({
      where: { id: confirmed.id },
    })
    expect(stored.status).toBe("confirmed")
  })

  it("refuses to cancel twice", async () => {
    const riley = await activeAccount(identities.resident)
    const confirmed = await bookOk(riley, "maple-tennis-1", "10:00", "11:00")
    await riley.post(`/api/bookings/${confirmed.id}/cancel`).expect(200)

    await riley.post(`/api/bookings/${confirmed.id}/cancel`).expect(409)
  })

  it("lists only the requester's own bookings", async () => {
    const riley = await activeAccount(identities.resident)
    const morganAgent = await activeAccount(morgan)
    await bookOk(riley, "maple-tennis-1", "10:00", "11:00")
    await bookOk(morganAgent, "maple-tennis-1", "12:00", "13:00")

    const response = await riley.get("/api/bookings/mine").expect(200)

    expect(response.body).toHaveLength(1)
    expect(response.body[0]).toMatchObject({
      facility: { slug: "maple-tennis-1", name: "Maple Grove Tennis Court 1" },
      startsAt: local(SATURDAY, "10:00"),
      status: "confirmed",
      cancellableUntil: local(SATURDAY, "08:00"),
    })
  })
})

describe("AC-009 Admin blocks", () => {
  it("blocks a confirmed booking, keeps the time unavailable, notifies the booker and audits it", async () => {
    const admin = await activeAccount(identities.admin, "admin")
    const riley = await activeAccount(identities.resident)
    const morganAgent = await activeAccount(morgan)
    const confirmed = await bookOk(riley, "maple-tennis-1", "10:00", "11:00")

    const response = await admin
      .post(`/api/admin/bookings/${confirmed.id}/block`)
      .send({ reason: "Court reserved for league finals" })
      .expect(200)

    expect(response.body).toMatchObject({ id: confirmed.id, status: "blocked" })
    expect(
      await publicStatus("maple-tennis-1", SATURDAY, local(SATURDAY, "10:00"))
    ).toBe("blocked")
    await book(morganAgent, "maple-tennis-1", sat("10:00", "11:00")).expect(409)

    const notifications = await riley.get("/api/notifications").expect(200)
    expect(notifications.body).toHaveLength(1)
    expect(notifications.body[0]).toMatchObject({
      type: "booking_blocked",
      bookingId: confirmed.id,
      readAt: null,
    })
    expect(notifications.body[0].message).toContain(
      "Court reserved for league finals"
    )
    const others = await morganAgent.get("/api/notifications").expect(200)
    expect(others.body).toHaveLength(0)

    const [entry] = await audit("booking_blocked")
    expect(entry).toMatchObject({ entityId: confirmed.id })
    expect(entry!.details).toMatchObject({
      reason: "Court reserved for league finals",
    })
  })

  it("blocks a pending hold beyond its deadline until the block is removed", async () => {
    const admin = await activeAccount(identities.admin, "admin")
    const riley = await activeAccount(identities.resident)
    const morganAgent = await activeAccount(morgan)
    const sunday = {
      startsAt: local("2026-11-29", "10:00"),
      endsAt: local("2026-11-29", "11:00"),
    }
    const pending = (await book(riley, "cedar-basketball", sunday)).body

    await admin
      .post(`/api/admin/bookings/${pending.id}/block`)
      .send({ reason: "Suspected duplicate request" })
      .expect(200)
    // The hold would have expired by now; the block keeps the time.
    clock.set("2026-11-28T20:00:00.000Z")
    await book(morganAgent, "cedar-basketball", sunday).expect(409)

    await admin.post(`/api/admin/bookings/${pending.id}/unblock`).expect(200)

    expect(
      await publicStatus("cedar-basketball", "2026-11-29", sunday.startsAt)
    ).toBe("available")
    await book(morganAgent, "cedar-basketball", sunday).expect(201)
    expect(await audit("booking_unblocked")).toHaveLength(1)
    const stored = await prismaOf(app).booking.findUniqueOrThrow({
      where: { id: pending.id },
    })
    expect(stored.status).toBe("blocked")
  })

  it("requires a reason", async () => {
    const admin = await activeAccount(identities.admin, "admin")
    const riley = await activeAccount(identities.resident)
    const confirmed = await bookOk(riley, "maple-tennis-1", "10:00", "11:00")

    await admin
      .post(`/api/admin/bookings/${confirmed.id}/block`)
      .send({ reason: "  " })
      .expect(400)
    expect(await prismaOf(app).notification.count()).toBe(0)
  })

  it("only blocks future pending or confirmed bookings", async () => {
    const admin = await activeAccount(identities.admin, "admin")
    const riley = await activeAccount(identities.resident)
    const cancelled = await bookOk(riley, "maple-tennis-1", "10:00", "11:00")
    await riley.post(`/api/bookings/${cancelled.id}/cancel`).expect(200)
    const ended = await bookOk(riley, "maple-tennis-1", "08:00", "08:30")
    clock.set(local(SATURDAY, "08:30"))

    for (const id of [cancelled.id, ended.id]) {
      await admin
        .post(`/api/admin/bookings/${id}/block`)
        .send({ reason: "Testing" })
        .expect(409)
    }
  })

  it("refuses blocks and unblocks from non-Admins", async () => {
    const riley = await activeAccount(identities.resident)
    const sam = await activeAccount(identities.staff, "staff")
    const confirmed = await bookOk(riley, "maple-tennis-1", "10:00", "11:00")

    await sam
      .post(`/api/admin/bookings/${confirmed.id}/block`)
      .send({ reason: "No" })
      .expect(403)
    await riley.post(`/api/admin/bookings/${confirmed.id}/unblock`).expect(403)
  })

  it("refuses to unblock a booking without an active block", async () => {
    const admin = await activeAccount(identities.admin, "admin")
    const riley = await activeAccount(identities.resident)
    const confirmed = await bookOk(riley, "maple-tennis-1", "10:00", "11:00")

    await admin.post(`/api/admin/bookings/${confirmed.id}/unblock`).expect(409)
    await admin
      .post(`/api/admin/bookings/${confirmed.id}/block`)
      .send({ reason: "Maintenance crew access" })
      .expect(200)
    await admin.post(`/api/admin/bookings/${confirmed.id}/unblock`).expect(200)
    await admin.post(`/api/admin/bookings/${confirmed.id}/unblock`).expect(409)
  })
})

describe("Admin booking list", () => {
  it("shows Admins pending requests with the requester, oldest deadline first", async () => {
    const admin = await activeAccount(identities.admin, "admin")
    const riley = await activeAccount(identities.resident)
    const morganAgent = await activeAccount(morgan)
    await bookOk(riley, "cedar-basketball", "12:00", "13:00")
    await bookOk(morganAgent, "cedar-basketball", "10:00", "11:00")
    await bookOk(riley, "maple-tennis-1", "10:00", "11:00")

    const response = await admin
      .get("/api/admin/bookings?status=pending")
      .expect(200)

    expect(
      response.body.map((b: { account: { name: string } }) => b.account.name)
    ).toEqual(["Morgan Player", "Riley Resident"])
    expect(response.body[0]).toMatchObject({
      status: "pending",
      facility: { slug: "cedar-basketball" },
      account: { email: morgan.email },
      blocked: false,
    })
    await riley.get("/api/admin/bookings").expect(403)
  })

  it("lists upcoming bookings for blocking", async () => {
    const admin = await activeAccount(identities.admin, "admin")
    const riley = await activeAccount(identities.resident)
    await bookOk(riley, "cedar-basketball", "12:00", "13:00")
    await bookOk(riley, "maple-tennis-1", "10:00", "11:00")

    const response = await admin
      .get("/api/admin/bookings?status=upcoming")
      .expect(200)

    expect(
      response.body.map((b: { status: string }) => b.status).sort()
    ).toEqual(["confirmed", "pending"])
  })
})
