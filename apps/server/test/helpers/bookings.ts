import { randomUUID } from "node:crypto"

import type { INestApplication } from "@nestjs/common"
import request from "supertest"

import { prismaOf, signInOk, type FixtureIdentity } from "./app.js"

export type Agent = ReturnType<typeof request.agent>
export type Range = { startsAt: string; endsAt: string }

/** Friday 2026-11-27, 14:10 in Toronto (UTC-5). */
export const NOW = "2026-11-27T19:10:00.000Z"
export const SATURDAY = "2026-11-28"

/** Toronto wall-clock time on a date in late November (UTC-5) as UTC ISO. */
export function local(date: string, time: string) {
  const [hour, minute] = time.split(":").map(Number) as [number, number]
  const [y, m, d] = date.split("-").map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d, hour + 5, minute)).toISOString()
}

export const sat = (from: string, to: string): Range => ({
  startsAt: local(SATURDAY, from),
  endsAt: local(SATURDAY, to),
})

export const morgan: FixtureIdentity = {
  subject: "fixture-morgan",
  email: "morgan.player@example.test",
  name: "Morgan Player",
}

/** Booking helpers bound to one running test app. */
export function bookingHelpers(app: () => INestApplication) {
  async function activeAccount(
    identity: FixtureIdentity,
    role: "resident" | "staff" | "admin" = "resident"
  ) {
    const agent = await signInOk(app(), identity)
    await prismaOf(app()).user.update({
      where: { email: identity.email },
      data: { status: "active", role },
    })
    return agent
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
    const facility = await prismaOf(app()).facility.findUniqueOrThrow({
      where: { slug },
    })
    return facility.id
  }

  async function publicStatus(slug: string, date: string, startsAt: string) {
    const response = await request(app().getHttpServer())
      .get(`/api/facilities/${slug}/availability?date=${date}`)
      .expect(200)
    return response.body.slots.find(
      (slot: Range & { status: string }) => slot.startsAt === startsAt
    )?.status as string | undefined
  }

  return { activeAccount, book, facilityId, publicStatus }
}
