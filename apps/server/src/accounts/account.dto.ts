import { z } from "zod"

import type { User } from "../generated/prisma/client.js"

export const roleSchema = z.enum(["resident", "staff", "admin"])
export const statusSchema = z.enum(["pending", "active", "revoked"])

export const listAccountsQuery = z.object({
  search: z.string().trim().max(200).optional(),
  status: statusSchema.optional(),
  role: roleSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
export type ListAccountsQuery = z.infer<typeof listAccountsQuery>

export const changeRoleBody = z.object({ role: roleSchema })

export const auditLogQuery = z.object({
  entityId: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
export type AuditLogQuery = z.infer<typeof auditLogQuery>

export function toAccountView(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    status: user.status,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  }
}
export type AccountView = ReturnType<typeof toAccountView>
