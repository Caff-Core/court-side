/**
 * Fictional people for the local identity fixture. The subjects stand in for
 * Google OpenID Connect subjects; none belong to a real account.
 */
export const FIXTURE_PERSONAS = [
  {
    subject: "fixture-admin",
    email: "avery.admin@example.test",
    name: "Avery Admin",
    description: "First Admin once provisioned",
  },
  {
    subject: "fixture-staff",
    email: "sam.staff@example.test",
    name: "Sam Staff",
    description: "Facility Staff after Admin assigns the role",
  },
  {
    subject: "fixture-resident",
    email: "riley.resident@example.test",
    name: "Riley Resident",
    description: "Resident after Admin approval",
  },
  {
    subject: "fixture-pending",
    email: "jordan.pending@example.test",
    name: "Jordan Pending",
    description: "New sign-in waiting for approval",
  },
] as const
