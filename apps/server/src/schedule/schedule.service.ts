import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common"

import { CLOCK, type Clock } from "../common/clock.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { daySlots } from "./availability.js"
import { bookingWindow } from "./slot-rules.js"
import {
  addDays,
  isoWeekday,
  zonedInstant,
  type LocalDate,
} from "./zoned-time.js"

/** Facility fields safe for anyone to read. */
const publicFacility = {
  slug: true,
  name: true,
  sport: true,
  requiresApproval: true,
  timeZone: true,
} as const

@Injectable()
export class ScheduleService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock
  ) {}

  listFacilities() {
    return this.prisma.facility.findMany({
      select: publicFacility,
      orderBy: { name: "asc" },
    })
  }

  /** One local day of public availability inside the 14-day window. */
  async availability(slug: string, requested: LocalDate | undefined) {
    const facility = await this.prisma.facility.findUnique({
      where: { slug },
      select: { id: true, ...publicFacility },
    })
    if (!facility) throw new NotFoundException("Facility not found")
    const { id: facilityId, ...visible } = facility

    const now = this.clock.now()
    const { timeZone } = facility
    const { firstDate, lastDate } = bookingWindow(now, timeZone)
    const today = firstDate
    const date = requested ?? today
    if (date < firstDate || date > lastDate) {
      throw new BadRequestException(
        `Choose a date from ${firstDate} to ${lastDate}`
      )
    }

    const hours = await this.prisma.openingHours.findUnique({
      where: {
        facilityId_weekday: {
          facilityId,
          weekday: isoWeekday(date),
        },
      },
    })
    const opensAt = hours
      ? zonedInstant(date, hours.opensAtMin, timeZone)
      : null
    const closesAt = hours
      ? zonedInstant(date, hours.closesAtMin, timeZone)
      : null

    // Select only what the public projection needs: never the requester or
    // the reason, so they cannot leak through a later change to the mapping.
    const entries =
      opensAt && closesAt
        ? await this.prisma.scheduleEntry.findMany({
            where: {
              facilityId,
              startsAt: { lt: closesAt },
              endsAt: { gt: opensAt },
            },
            select: {
              kind: true,
              startsAt: true,
              endsAt: true,
              expiresAt: true,
            },
          })
        : []

    return {
      facility: visible,
      date,
      dayStartsAt: zonedInstant(date, 0, timeZone).toISOString(),
      today,
      firstDate,
      lastDate,
      previousDate: date > firstDate ? addDays(date, -1) : null,
      nextDate: date < lastDate ? addDays(date, 1) : null,
      open: hours !== null && hours.closesAtMin > hours.opensAtMin,
      opensAt: opensAt?.toISOString() ?? null,
      closesAt: closesAt?.toISOString() ?? null,
      slots: hours
        ? daySlots({
            date,
            timeZone,
            opensAtMin: hours.opensAtMin,
            closesAtMin: hours.closesAtMin,
            entries,
            now,
          })
        : [],
    }
  }
}
