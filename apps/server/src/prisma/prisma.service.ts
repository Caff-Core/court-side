import { Injectable, type OnModuleDestroy } from "@nestjs/common"
import { PrismaPg } from "@prisma/adapter-pg"

import { parseEnv } from "../config/env.js"
import { PrismaClient } from "../generated/prisma/client.js"

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({ connectionString: parseEnv().DATABASE_URL }),
    })
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
