import { Module } from "@nestjs/common"

import { AdminAccountsController, MeController } from "./accounts.controller.js"
import { AccountsService } from "./accounts.service.js"

@Module({
  controllers: [MeController, AdminAccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
