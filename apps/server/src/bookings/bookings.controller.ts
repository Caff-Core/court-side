import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Inject,
  Post,
  Res,
} from "@nestjs/common"
import type { Response } from "express"
import { z } from "zod"

import { CurrentAccount } from "../auth/access.decorators.js"
import type { CurrentAccount as Account } from "../auth/current-account.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
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
    @Inject(BookingsService) private readonly bookings: BookingsService
  ) {}

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
