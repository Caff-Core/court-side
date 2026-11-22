/**
 * Fictional data for the Maple Grove example community. Every name is made
 * up; no real facility or person is represented.
 */
export const COMMUNITY_TIME_ZONE = "America/Toronto"

type WeeklyHours = { weekdays: [number, number]; weekend: [number, number] }

type SeedFacility = {
  slug: string
  name: string
  sport: string
  requiresApproval: boolean
  hours: WeeklyHours
}

const hour = (h: number) => h * 60

const STANDARD: WeeklyHours = {
  weekdays: [hour(7), hour(21)],
  weekend: [hour(8), hour(20)],
}

export const SEED_FACILITIES: readonly SeedFacility[] = [
  {
    slug: "maple-tennis-1",
    name: "Maple Grove Tennis Court 1",
    sport: "Tennis",
    requiresApproval: false,
    hours: STANDARD,
  },
  {
    slug: "maple-tennis-2",
    name: "Maple Grove Tennis Court 2",
    sport: "Tennis",
    requiresApproval: false,
    hours: STANDARD,
  },
  {
    slug: "cedar-basketball",
    name: "Cedar Park Basketball Court",
    sport: "Basketball",
    requiresApproval: true,
    hours: { weekdays: [hour(9), hour(22)], weekend: [hour(9), hour(22)] },
  },
  {
    slug: "willow-soccer-field",
    name: "Willow Field",
    sport: "Soccer",
    requiresApproval: true,
    hours: { weekdays: [hour(8), hour(20)], weekend: [hour(8), hour(18)] },
  },
]

/** ISO weekdays 1 to 7 with opening and closing minutes from local midnight. */
export function openingHoursFor(hours: WeeklyHours) {
  return [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
    const [opensAtMin, closesAtMin] =
      weekday <= 5 ? hours.weekdays : hours.weekend
    return { weekday, opensAtMin, closesAtMin }
  })
}
