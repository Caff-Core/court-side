/**
 * Display formatting for schedule instants. The server sends UTC instants and
 * the facility's IANA zone; Intl renders them in that zone for every viewer,
 * so a visitor abroad still sees the facility's local times.
 */
const cache = new Map<string, Intl.DateTimeFormat>()

function formatter(
  key: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
) {
  const id = `${key}:${timeZone}`
  let value = cache.get(id)
  if (!value) {
    value = new Intl.DateTimeFormat(undefined, { ...options, timeZone })
    cache.set(id, value)
  }
  return value
}

export function formatTime(iso: string, timeZone: string) {
  return formatter("time", timeZone, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso))
}

export function formatTimeRange(start: string, end: string, timeZone: string) {
  return formatter("time", timeZone, {
    hour: "numeric",
    minute: "2-digit",
  }).formatRange(new Date(start), new Date(end))
}

/** "Saturday, November 28" for the instant the local day starts. */
export function formatDay(dayStartsAt: string, timeZone: string) {
  return formatter("day", timeZone, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(dayStartsAt))
}

/** A readable zone name such as "Eastern Time", falling back to the IANA id. */
export function zoneName(timeZone: string, at: string) {
  const part = formatter("zone", timeZone, { timeZoneName: "longGeneric" })
    .formatToParts(new Date(at))
    .find((p) => p.type === "timeZoneName")
  return part?.value ?? timeZone
}
