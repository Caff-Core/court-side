import { Global, Module } from "@nestjs/common"
import { APP_GUARD } from "@nestjs/core"

import { ENV } from "../config/config.module.js"
import type { Env } from "../config/env.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { AccessGuard } from "./access.guard.js"
import { AuthOptionsController } from "./auth-options.controller.js"
import { createAuth } from "./auth.js"
import { AUTH } from "./auth.tokens.js"

@Global()
@Module({
  controllers: [AuthOptionsController],
  providers: [
    {
      provide: AUTH,
      inject: [PrismaService, ENV],
      useFactory: (prisma: PrismaService, env: Env) => createAuth(prisma, env),
    },
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
  exports: [AUTH],
})
export class AuthModule {}
