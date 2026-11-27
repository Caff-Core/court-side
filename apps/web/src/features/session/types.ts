export type AccountStatus = "pending" | "active" | "revoked"
export type Role = "resident" | "staff" | "admin"

export type Me = {
  id: string
  name: string
  email: string
  image: string | null
  status: AccountStatus
  role: Role | null
}

export type FixturePersona = {
  subject: string
  email: string
  name: string
  description: string
}

export type AuthOptions = {
  google: boolean
  identityFixture: { personas: FixturePersona[] } | null
}

export const ROLE_LABELS: Record<Role, string> = {
  resident: "Resident",
  staff: "Facility Staff",
  admin: "Admin",
}
