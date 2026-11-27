import { randomUUID } from "node:crypto"

import type { INestApplication } from "@nestjs/common"
import request from "supertest"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { FixedClock } from "../src/common/clock.js"
import { NotificationWriter } from "../src/notifications/notification-writer.js"
import {
  createTestApp,
  identities,
  prismaOf,
  resetAccounts,
  resetSchedule,
} from "./helpers/app.js"
import {
  bookingHelpers,
  morgan,
  NOW,
  sat,
  SATURDAY,
  type Agent,
} from "./helpers/bookings.js"

/** Fails every write, to prove the surrounding transaction rolls back. */
class FailingWriter extends NotificationWriter {
  override async notify(): Promise<never> {
    throw new Error("Injected notification failure")
  }
}

const clock = new FixedClock(NOW)
let app: INestApplication
let failing: INestApplication
const { activeAccount, book } = bookingHelpers(() => app)
const onFailing = bookingHelpers(() => failing)

beforeAll(async () => {
  app = await createTestApp({ clock })
  failing = await createTestApp({
    clock,
    overrides: [{ provide: NotificationWriter, useValue: new FailingWriter() }],
  })
})

afterAll(async () => {
  await Promise.all([app.close(), failing.close()])
})

beforeEach(async () => {
  clock.set(NOW)
  await resetSchedule(app)
  await resetAccounts(app)
})

const closeSaturday = (agent: Agent, key: string = randomUUID()) =>
  agent
    .post("/api/closures")
    .set("Idempotency-Key", key)
    .send({
      facility: "maple-tennis-1",
      startsLocal: `${SATURDAY}T09:00`,
      endsLocal: `${SATURDAY}T12:00`,
      reason: "Court lights rewiring",
    })

async function bookedSaturday() {
  const riley = await activeAccount(identities.resident)
  const morganAgent = await activeAccount(morgan)
  const response = await book(riley, "maple-tennis-1", sat("10:00", "11:00"))
  expect(response.status).toBe(201)
  return { riley, morganAgent, bookingId: response.body.id as string }
}

describe("AC-012 who can see a notification", () => {
  it("shows a notification only to its recipient, who alone can mark it read", async () => {
    const sam = await activeAccount(identities.staff, "staff")
    const { riley, morganAgent } = await bookedSaturday()
    await closeSaturday(sam).expect(201)

    const [note] = (await riley.get("/api/notifications").expect(200)).body
    expect(note.readAt).toBeNull()
    expect(
      (await riley.get("/api/notifications/unread-count").expect(200)).body
    ).toEqual({ count: 1 })
    expect(
      (await morganAgent.get("/api/notifications").expect(200)).body
    ).toEqual([])
    expect(
      (await morganAgent.get("/api/notifications/unread-count").expect(200))
        .body
    ).toEqual({ count: 0 })

    await morganAgent.post(`/api/notifications/${note.id}/read`).expect(404)
    await sam.post(`/api/notifications/${note.id}/read`).expect(404)
    const read = await riley
      .post(`/api/notifications/${note.id}/read`)
      .expect(200)

    expect(read.body.readAt).toBe(NOW)
    expect(
      (await riley.get("/api/notifications/unread-count").expect(200)).body
    ).toEqual({ count: 0 })
  })

  it("marks every unread notification read for the recipient only", async () => {
    const admin = await activeAccount(identities.admin, "admin")
    const { riley, morganAgent, bookingId } = await bookedSaturday()
    const other = await book(
      morganAgent,
      "maple-tennis-1",
      sat("15:00", "16:00")
    )
    await admin
      .post(`/api/admin/bookings/${bookingId}/block`)
      .send({ reason: "Tournament seeding" })
      .expect(200)
    await admin
      .post(`/api/admin/bookings/${other.body.id}/block`)
      .send({ reason: "Tournament seeding" })
      .expect(200)

    const response = await riley.post("/api/notifications/read-all").expect(200)

    expect(response.body).toEqual({ updated: 1 })
    expect(
      (await riley.get("/api/notifications/unread-count").expect(200)).body
    ).toEqual({ count: 0 })
    expect(
      (await morganAgent.get("/api/notifications/unread-count").expect(200))
        .body
    ).toEqual({ count: 1 })
  })

  it("asks visitors to sign in", async () => {
    await request(app.getHttpServer()).get("/api/notifications").expect(401)
  })
})

describe("AC-012 retried closures", () => {
  it("creates one closure and one notification when the same request arrives twice at once", async () => {
    const sam = await activeAccount(identities.staff, "staff")
    const { riley } = await bookedSaturday()
    const key = randomUUID()

    const results = await Promise.all([
      closeSaturday(sam, key),
      closeSaturday(sam, key),
    ])

    expect(results.map((r) => r.status)).toEqual([201, 201])
    expect(results[1]!.body.id).toBe(results[0]!.body.id)
    expect(await prismaOf(app).closure.count()).toBe(1)
    expect(
      (await riley.get("/api/notifications").expect(200)).body
    ).toHaveLength(1)
  })
})

describe("AC-012 rollback when a notification cannot be written", () => {
  it("rolls back the closure, the cancellation and the schedule change together", async () => {
    const { bookingId } = await bookedSaturday()
    const sam = await onFailing.activeAccount(identities.staff, "staff")

    const response = await closeSaturday(sam)

    expect(response.status).toBe(500)
    const prisma = prismaOf(app)
    expect(await prisma.closure.count()).toBe(0)
    expect(
      await prisma.scheduleEntry.count({ where: { kind: "closure" } })
    ).toBe(0)
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
    })
    expect(booking.status).toBe("confirmed")
    expect(await prisma.scheduleEntry.count({ where: { bookingId } })).toBe(1)
    expect(await prisma.notification.count()).toBe(0)
    expect(
      await prisma.auditLog.count({ where: { action: "closure_created" } })
    ).toBe(0)
  })

  it("rolls back an Admin block too", async () => {
    const { bookingId } = await bookedSaturday()
    const admin = await onFailing.activeAccount(identities.admin, "admin")

    const response = await admin
      .post(`/api/admin/bookings/${bookingId}/block`)
      .send({ reason: "Tournament seeding" })

    expect(response.status).toBe(500)
    const booking = await prismaOf(app).booking.findUniqueOrThrow({
      where: { id: bookingId },
    })
    expect(booking.status).toBe("confirmed")
    expect(
      await prismaOf(app).scheduleEntry.count({ where: { kind: "block" } })
    ).toBe(0)
  })
})
