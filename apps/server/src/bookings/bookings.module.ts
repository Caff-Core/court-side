import { Module } from "@nestjs/common"

import { AdminBookingsController } from "./admin-bookings.controller.js"
import { BookingLifecycleService } from "./booking-lifecycle.service.js"
import { BookingsController } from "./bookings.controller.js"
import { BookingsService } from "./bookings.service.js"

@Module({
  controllers: [BookingsController, AdminBookingsController],
  providers: [BookingsService, BookingLifecycleService],
})
export class BookingsModule {}
