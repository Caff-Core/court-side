import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Res,
} from "@nestjs/common"
import type { Response } from "express"
import { z } from "zod"

import { CurrentAccount } from "../auth/access.decorators.js"
import type { CurrentAccount as Account } from "../auth/current-account.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { BookingLifecycleService } from "./booking-lifecycle.service.js"
import { BookingsService } from "./bookings.service.js"

const bookingBody = z.object({
  facility: z.string().min(1).max(100),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
})

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,128}$/

/** Any active account may request a booking: Resident, Staff or Admin. */
@Controller("bookings")
export class BookingsController {
  constructor(
    @Inject(BookingsService) private readonly bookings: BookingsService,
    @Inject(BookingLifecycleService)
    private readonly lifecycle: BookingLifecycleService
  ) {}

  /** The signed-in account's own bookings, newest start first. */
  @Get("mine")
  mine(@CurrentAccount() account: Account) {
    return this.lifecycle.listMine(account.id)
  }

  /**
   * Withdraws a pending request or cancels a confirmed booking. Less than
   * two hours before the start it is recorded as a no-show.
   */
  @Post(":id/cancel")
  @HttpCode(200)
  cancel(@CurrentAccount() account: Account, @Param("id") id: string) {
    return this.lifecycle.cancelOwn(account.id, id)
  }

  /**
   * Requests a facility time range. Clients send a fresh Idempotency-Key per
   * submission and reuse it on retry; a retry gets the first answer back.
   */
  @Post()
  async create(
    @CurrentAccount() account: Account,
    @Headers("idempotency-key") key: string | undefined,
    @Body(new ZodValidationPipe(bookingBody)) body: z.infer<typeof bookingBody>,
    @Res({ passthrough: true }) response: Response
  ) {
    if (!key || !IDEMPOTENCY_KEY.test(key)) {
      throw new BadRequestException(
        "Send an Idempotency-Key header of 8 to 128 letters, digits, - or _"
      )
    }
    const outcome = await this.bookings.request(account.id, key, body)
    response.status(outcome.statusCode)
    return outcome.body
  }
}
