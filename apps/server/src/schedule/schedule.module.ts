import { Module } from "@nestjs/common"

import { FacilitiesController } from "./schedule.controller.js"
import { ScheduleService } from "./schedule.service.js"

@Module({
  controllers: [FacilitiesController],
  providers: [ScheduleService],
})
export class ScheduleModule {}
