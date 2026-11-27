import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { fromNodeHeaders } from "better-auth/node"
import type { Request } from "express"

import { ACCESS_KEY, type AccessRule } from "./access.decorators.js"
import { AUTH } from "./auth.tokens.js"
import type { Auth } from "./auth.js"
import type { CurrentAccount } from "./current-account.js"

/**
 * Global guard. Every route needs an active account unless it says otherwise,
 * and the account's current status and role are read on every request.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AUTH) private readonly auth: Auth
  ) {}

  async canActivate(context: ExecutionContext) {
    const rule = this.reflector.getAllAndOverride<AccessRule | undefined>(
      ACCESS_KEY,
      [context.getHandler(), context.getClass()]
    ) ?? { kind: "active" }
    if (rule.kind === "public") return true

    const request = context
      .switchToHttp()
      .getRequest<Request & { account?: CurrentAccount }>()
    const result = await this.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    })
    if (!result) throw new UnauthorizedException("Sign in to continue")

    const { user } = result
    const account: CurrentAccount = {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
      status: user.status as CurrentAccount["status"],
      role: (user.role ?? null) as CurrentAccount["role"],
    }
    if (account.status === "revoked") {
      throw new UnauthorizedException("This account no longer has access")
    }
    request.account = account

    if (rule.kind === "signed-in") return true
    if (account.status !== "active") {
      throw new ForbiddenException("Your account is waiting for approval")
    }
    if (rule.roles?.length && !rule.roles.includes(account.role!)) {
      throw new ForbiddenException("Your role cannot do this")
    }
    return true
  }
}
