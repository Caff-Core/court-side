import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common"

import { Public } from "../auth/access.decorators.js"
import { PrismaService } from "../prisma/prisma.service.js"

@Controller("health")
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      throw new ServiceUnavailableException({
        status: "error",
        database: "down",
      })
    }
    return { status: "ok", database: "up" }
  }
}
