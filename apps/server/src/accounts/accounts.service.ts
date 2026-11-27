import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common"

import type { Prisma, Role } from "../generated/prisma/client.js"
import { PrismaService } from "../prisma/prisma.service.js"
import {
  toAccountView,
  type AuditLogQuery,
  type ListAccountsQuery,
} from "./account.dto.js"

type Tx = Prisma.TransactionClient

@Injectable()
export class AccountsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: ListAccountsQuery) {
    const where: Prisma.UserWhereInput = {
      status: query.status,
      role: query.role,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ])
    return { items: items.map(toAccountView), total }
  }

  approve(actorId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.user.updateMany({
        where: { id: userId, status: "pending" },
        data: { status: "active", role: "resident" },
      })
      const user = await this.findOrThrow(tx, userId)
      if (count === 0) {
        throw new ConflictException(`Account is ${user.status}, not pending`)
      }
      await this.audit(tx, actorId, "account_approved", userId, {
        role: "resident",
      })
      return toAccountView(user)
    })
  }

  changeRole(actorId: string, userId: string, role: Role) {
    if (actorId === userId) {
      throw new ConflictException("You cannot change your own role")
    }
    return this.prisma.$transaction(async (tx) => {
      const before = await this.findOrThrow(tx, userId)
      if (before.status !== "active") {
        throw new ConflictException(
          `Only active accounts have a role to change`
        )
      }
      if (before.role === role) return toAccountView(before)
      const user = await tx.user.update({
        where: { id: userId },
        data: { role },
      })
      await this.audit(tx, actorId, "account_role_changed", userId, {
        from: before.role,
        to: role,
      })
      return toAccountView(user)
    })
  }

  revoke(actorId: string, userId: string) {
    if (actorId === userId) {
      throw new ConflictException("You cannot revoke your own access")
    }
    return this.prisma.$transaction(async (tx) => {
      const before = await this.findOrThrow(tx, userId)
      if (before.status === "revoked") {
        throw new ConflictException("Account is already revoked")
      }
      const user = await tx.user.update({
        where: { id: userId },
        data: { status: "revoked" },
      })
      // Deleting sessions ends access on the very next request.
      const { count } = await tx.session.deleteMany({ where: { userId } })
      await this.audit(tx, actorId, "account_revoked", userId, {
        previousStatus: before.status,
        sessionsEnded: count,
      })
      return toAccountView(user)
    })
  }

  async auditLog(query: AuditLogQuery) {
    const where: Prisma.AuditLogWhereInput = { entityId: query.entityId }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { actor: { select: { id: true, name: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ])
    return {
      items: items.map((entry) => ({
        id: entry.id,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        details: entry.details,
        actor: entry.actor,
        createdAt: entry.createdAt.toISOString(),
      })),
      total,
    }
  }

  private async findOrThrow(tx: Tx, userId: string) {
    const user = await tx.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException("Account not found")
    return user
  }

  private audit(
    tx: Tx,
    actorId: string,
    action: "account_approved" | "account_role_changed" | "account_revoked",
    userId: string,
    details: Prisma.InputJsonObject
  ) {
    return tx.auditLog.create({
      data: { actorId, action, entityType: "user", entityId: userId, details },
    })
  }
}
