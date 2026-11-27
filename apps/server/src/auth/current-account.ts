import type { AccountStatus, Role } from "../generated/prisma/enums.js"

export type CurrentAccount = {
  id: string
  name: string
  email: string
  image: string | null
  status: AccountStatus
  role: Role | null
}
