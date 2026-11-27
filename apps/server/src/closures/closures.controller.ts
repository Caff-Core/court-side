import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Module,
  Param,
  Post,
} from "@nestjs/common"
import { z } from "zod"

import { CurrentAccount, Roles } from "../auth/access.decorators.js"
import type { CurrentAccount as Account } from "../auth/current-account.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { ClosuresService } from "./closures.service.js"

const closureBody = z.object({
  facility: z.string().min(1).max(100),
  /** Wall-clock times in the facility's time zone, as datetime-local sends. */
  startsLocal: z.string().max(20),
  endsLocal: z.string().max(20),
  reason: z.string().trim().min(1, "Give a reason for the closure").max(500),
})

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,128}$/

/** Facility Staff and Admins manage maintenance closures. */
@Roles("staff", "admin")
@Controller("closures")
export class ClosuresController {
  constructor(
    @Inject(ClosuresService) private readonly closures: ClosuresService
  ) {}

  @Get()
  list() {
    return this.closures.listCurrent()
  }

  @Post()
  create(
    @CurrentAccount() actor: Account,
    @Headers("idempotency-key") key: string | undefined,
    @Body(new ZodValidationPipe(closureBody)) body: z.infer<typeof closureBody>
  ) {
    if (!key || !IDEMPOTENCY_KEY.test(key)) {
      throw new BadRequestException(
        "Send an Idempotency-Key header of 8 to 128 letters, digits, - or _"
      )
    }
    return this.closures.create(actor.id, key, body)
  }

  @Post(":id/end")
  @HttpCode(200)
  end(@CurrentAccount() actor: Account, @Param("id") id: string) {
    return this.closures.end(actor.id, id)
  }
}

@Module({
  controllers: [ClosuresController],
  providers: [ClosuresService],
})
export class ClosuresModule {}
