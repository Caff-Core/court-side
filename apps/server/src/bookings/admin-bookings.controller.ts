import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
} from "@nestjs/common"
import { z } from "zod"

import { CurrentAccount, Roles } from "../auth/access.decorators.js"
import type { CurrentAccount as Account } from "../auth/current-account.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { BookingLifecycleService } from "./booking-lifecycle.service.js"

const listQuery = z.object({
  status: z.enum(["pending", "upcoming", "blocked"]).default("pending"),
})

const blockBody = z.object({
  reason: z.string().trim().min(1, "Give a reason for the block").max(500),
})

@Roles("admin")
@Controller("admin/bookings")
export class AdminBookingsController {
  constructor(
    @Inject(BookingLifecycleService)
    private readonly lifecycle: BookingLifecycleService
  ) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(listQuery)) query: z.infer<typeof listQuery>
  ) {
    return this.lifecycle.listForAdmin(query.status)
  }

  @Post(":id/approve")
  @HttpCode(200)
  approve(@CurrentAccount() actor: Account, @Param("id") id: string) {
    return this.lifecycle.approve(actor.id, id)
  }

  @Post(":id/block")
  @HttpCode(200)
  block(
    @CurrentAccount() actor: Account,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(blockBody)) body: z.infer<typeof blockBody>
  ) {
    return this.lifecycle.block(actor.id, id, body.reason)
  }

  @Post(":id/unblock")
  @HttpCode(200)
  unblock(@CurrentAccount() actor: Account, @Param("id") id: string) {
    return this.lifecycle.unblock(actor.id, id)
  }
}
