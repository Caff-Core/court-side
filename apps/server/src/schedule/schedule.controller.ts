import { Controller, Get, Inject, Param, Query } from "@nestjs/common"
import { z } from "zod"

import { Public } from "../auth/access.decorators.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { ScheduleService } from "./schedule.service.js"
import { parseLocalDate } from "./zoned-time.js"

const availabilityQuery = z.object({
  date: z
    .string()
    .refine((value) => parseLocalDate(value) !== null, {
      message: "Use an ISO calendar date such as 2026-11-27",
    })
    .optional(),
})

/** Anyone, signed in or not, can browse facilities and their schedule. */
@Public()
@Controller("facilities")
export class FacilitiesController {
  constructor(
    @Inject(ScheduleService) private readonly schedule: ScheduleService
  ) {}

  @Get()
  list() {
    return this.schedule.listFacilities()
  }

  @Get(":slug/availability")
  availability(
    @Param("slug") slug: string,
    @Query(new ZodValidationPipe(availabilityQuery))
    query: z.infer<typeof availabilityQuery>
  ) {
    return this.schedule.availability(slug, query.date)
  }
}
