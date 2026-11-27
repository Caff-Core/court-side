import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api"
import type { AccountStatus, Role } from "@/features/session/types"

export type AccountRow = {
  id: string
  name: string
  email: string
  image: string | null
  status: AccountStatus
  role: Role | null
  createdAt: string
}

export type AccountFilters = {
  search: string
  status: AccountStatus | "all"
  page: number
  pageSize: number
}

export const accountsQuery = (filters: AccountFilters) =>
  queryOptions({
    queryKey: ["accounts", filters],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(filters.page),
        pageSize: String(filters.pageSize),
      })
      if (filters.search) params.set("search", filters.search)
      if (filters.status !== "all") params.set("status", filters.status)
      return api<{ items: AccountRow[]; total: number }>(
        `/api/admin/accounts?${params}`
      )
    },
    placeholderData: keepPreviousData,
  })

export const approveAccount = (id: string) =>
  api<AccountRow>(`/api/admin/accounts/${id}/approve`, { method: "POST" })

export const changeAccountRole = (id: string, role: Role) =>
  api<AccountRow>(`/api/admin/accounts/${id}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  })

export const revokeAccount = (id: string) =>
  api<AccountRow>(`/api/admin/accounts/${id}/revoke`, { method: "POST" })
