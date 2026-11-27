import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from "@nestjs/common"

import type { Role } from "../generated/prisma/enums.js"
import type { CurrentAccount as Account } from "./current-account.js"

export const ACCESS_KEY = "court-side:access"

export type AccessRule =
  | { kind: "public" }
  | { kind: "signed-in" }
  | { kind: "active"; roles?: Role[] }

/** No session needed. */
export const Public = () =>
  SetMetadata(ACCESS_KEY, { kind: "public" } satisfies AccessRule)

/** Any signed-in account that is not revoked, including pending ones. */
export const SignedIn = () =>
  SetMetadata(ACCESS_KEY, { kind: "signed-in" } satisfies AccessRule)

/** An active account, optionally limited to some roles. This is the default. */
export const Roles = (...roles: Role[]) =>
  SetMetadata(ACCESS_KEY, { kind: "active", roles } satisfies AccessRule)

export const CurrentAccount = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Account =>
    ctx.switchToHttp().getRequest().account
)
