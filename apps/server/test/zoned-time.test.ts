import { describe, expect, it } from "vitest"

import {
  addDays,
  localDateOf,
  parseLocalDate,
  zonedInstant,
} from "../src/schedule/zoned-time.js"

const TORONTO = "America/Toronto"

describe("zoned time", () => {
  it("reads the community's calendar date at an instant", () => {
    // 03:30 UTC is still the previous evening in Toronto.
    expect(localDateOf(new Date("2026-11-27T03:30:00Z"), TORONTO)).toBe(
      "2026-11-26"
    )
    expect(localDateOf(new Date("2026-11-27T05:00:00Z"), TORONTO)).toBe(
      "2026-11-27"
    )
  })

  it("turns local wall-clock minutes into instants in standard time", () => {
    expect(zonedInstant("2026-11-27", 7 * 60, TORONTO).toISOString()).toBe(
      "2026-11-27T12:00:00.000Z"
    )
  })

  it("turns local wall-clock minutes into instants in daylight time", () => {
    expect(zonedInstant("2026-07-15", 7 * 60, TORONTO).toISOString()).toBe(
      "2026-07-15T11:00:00.000Z"
    )
  })

  it("uses the new offset after clocks fall back", () => {
    // Toronto leaves daylight time at 02:00 on 2026-11-01.
    expect(zonedInstant("2026-11-01", 8 * 60, TORONTO).toISOString()).toBe(
      "2026-11-01T13:00:00.000Z"
    )
    expect(zonedInstant("2026-11-01", 0, TORONTO).toISOString()).toBe(
      "2026-11-01T04:00:00.000Z"
    )
  })

  it("moves a skipped spring-forward time later, like Temporal's compatible mode", () => {
    // 02:30 does not exist in Toronto on 2026-03-08.
    expect(zonedInstant("2026-03-08", 2 * 60 + 30, TORONTO).toISOString()).toBe(
      "2026-03-08T07:30:00.000Z"
    )
  })

  it("supports closing time at local midnight of the next day", () => {
    expect(zonedInstant("2026-11-27", 24 * 60, TORONTO).toISOString()).toBe(
      "2026-11-28T05:00:00.000Z"
    )
  })

  it("does calendar arithmetic without time zone drift", () => {
    expect(addDays("2026-11-27", 13)).toBe("2026-12-10")
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28")
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29")
  })

  it("accepts only real ISO calendar dates", () => {
    expect(parseLocalDate("2026-11-27")).toEqual({
      year: 2026,
      month: 11,
      day: 27,
    })
    expect(parseLocalDate("2026-02-30")).toBeNull()
    expect(parseLocalDate("2026-11-7")).toBeNull()
    expect(parseLocalDate("27/11/2026")).toBeNull()
  })
})
