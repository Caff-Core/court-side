import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common"

import { CurrentAccount, Roles, SignedIn } from "../auth/access.decorators.js"
import type { CurrentAccount as Account } from "../auth/current-account.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import {
  auditLogQuery,
  changeRoleBody,
  listAccountsQuery,
  type AuditLogQuery,
  type ListAccountsQuery,
} from "./account.dto.js"
import { AccountsService } from "./accounts.service.js"

@Controller("me")
export class MeController {
  /** Pending users use this to see their own review status. */
  @SignedIn()
  @Get()
  me(@CurrentAccount() account: Account) {
    return account
  }
}

@Roles("admin")
@Controller("admin")
export class AdminAccountsController {
  constructor(
    @Inject(AccountsService) private readonly accounts: AccountsService
  ) {}

  @Get("accounts")
  list(
    @Query(new ZodValidationPipe(listAccountsQuery)) query: ListAccountsQuery
  ) {
    return this.accounts.list(query)
  }

  @Post("accounts/:id/approve")
  @HttpCode(200)
  approve(@CurrentAccount() actor: Account, @Param("id") id: string) {
    return this.accounts.approve(actor.id, id)
  }

  @Patch("accounts/:id/role")
  changeRole(
    @CurrentAccount() actor: Account,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(changeRoleBody))
    body: { role: "resident" | "staff" | "admin" }
  ) {
    return this.accounts.changeRole(actor.id, id, body.role)
  }

  @Post("accounts/:id/revoke")
  @HttpCode(200)
  revoke(@CurrentAccount() actor: Account, @Param("id") id: string) {
    return this.accounts.revoke(actor.id, id)
  }

  @Get("audit-log")
  auditLog(@Query(new ZodValidationPipe(auditLogQuery)) query: AuditLogQuery) {
    return this.accounts.auditLog(query)
  }
}
