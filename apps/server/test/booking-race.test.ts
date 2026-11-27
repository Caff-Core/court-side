import type { INestApplication } from "@nestjs/common"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

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
  morgan,
  NOW,
  sat,
  type Agent,
  type Range,
} from "./helpers/bookings.js"

/**
 * TEST-006 under real contention: two app instances, each with its own
 * PostgreSQL connection pool, receive overlapping requests started in the
 * same tick. Every round must produce exactly one reservation and one
 * conflict. The rounds are logged so the run can be recorded.
 */
const ROUNDS = 10
const clock = new FixedClock(NOW)
let first: INestApplication
let second: INestApplication
const onFirst = bookingHelpers(() => first)
const onSecond = bookingHelpers(() => second)

beforeAll(async () => {
  first = await createTestApp({ clock })
  second = await createTestApp({ clock })
})

afterAll(async () => {
  await Promise.all([first.close(), second.close()])
})

async function freshStart() {
  await resetSchedule(first)
  await resetAccounts(first)
}

type Attempt = {
  who: string
  agent: Agent
  app: "first" | "second"
  range: Range
}

async function race(attempts: Attempt[]) {
  // Build both requests, then let them run together.
  const responses = await Promise.all(
    attempts.map(({ agent, app, range }) =>
      (app === "first" ? onFirst : onSecond).book(
        agent,
        "maple-tennis-1",
        range
      )
    )
  )
  return responses.map((response, index) => ({
    who: attempts[index]!.who,
    status: response.status,
    code: response.body.code as string | undefined,
    alternatives: (response.body.alternatives as unknown[] | undefined)?.length,
  }))
}

describe("AC-006 race across independent connections", () => {
  it(`gives one of two overlapping requests the slot in each of ${ROUNDS} rounds`, async () => {
    const tally: Record<string, number> = {}
    for (let round = 1; round <= ROUNDS; round++) {
      await freshStart()
      const riley = await onFirst.activeAccount(identities.resident)
      const morganAgent = await onSecond.activeAccount(morgan)
      const attempts: Attempt[] = [
        {
          who: "Riley via app 1 (10:00-11:00)",
          agent: riley,
          app: "first",
          range: sat("10:00", "11:00"),
        },
        {
          who: "Morgan via app 2 (10:30-11:30)",
          agent: morganAgent,
          app: "second",
          range: sat("10:30", "11:30"),
        },
      ]
      // Alternate which request is issued first in code.
      const outcomes = await race(
        round % 2 === 1 ? attempts : [...attempts].reverse()
      )

      const winners = outcomes.filter((o) => o.status === 201)
      const losers = outcomes.filter((o) => o.status === 409)
      expect(winners).toHaveLength(1)
      expect(losers).toHaveLength(1)
      expect(losers[0]!.code).toBe("slot_unavailable")
      expect(losers[0]!.alternatives).toBeGreaterThan(0)
      expect(
        await prismaOf(first).scheduleEntry.count({
          where: { kind: { in: ["hold", "booking"] } },
        })
      ).toBe(1)

      const winner = winners[0]!.who
      tally[winner] = (tally[winner] ?? 0) + 1
      console.info(
        `[race] round ${round}: winner ${winner} 201; ` +
          `conflict ${losers[0]!.who} 409 ${losers[0]!.code} ` +
          `with ${losers[0]!.alternatives} alternatives`
      )
    }
    console.info(`[race] winners: ${JSON.stringify(tally)}`)
  })

  it("refuses the third booking when it races the second across connections", async () => {
    for (let round = 1; round <= 5; round++) {
      await freshStart()
      const viaFirst = await onFirst.activeAccount(identities.resident)
      const viaSecond = await onSecond.activeAccount(identities.resident)
      await onFirst
        .book(viaFirst, "maple-tennis-1", sat("08:00", "09:00"))
        .expect(201)

      const [a, b] = await Promise.all([
        onFirst.book(viaFirst, "maple-tennis-1", sat("12:00", "13:00")),
        onSecond.book(viaSecond, "maple-tennis-1", sat("15:00", "16:00")),
      ])

      expect([a.status, b.status].sort()).toEqual([201, 409])
      const loser = a.status === 409 ? a : b
      expect(loser.body.code).toBe("booking_limit")
      console.info(
        `[cap] round ${round}: ${a.status === 201 ? "app 1" : "app 2"} booked the second slot; ` +
          "the other got 409 booking_limit"
      )
    }
  })
})
