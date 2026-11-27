import { Prisma, type PrismaClient } from "../generated/prisma/client.js"

export const GOOGLE_ISSUER = "https://accounts.google.com"

/** Better Auth provider ids mapped to the OpenID Connect issuers they verify. */
const ISSUER_BY_PROVIDER: Record<string, string> = {
  google: GOOGLE_ISSUER,
}

type Db = Pick<PrismaClient, "$transaction" | "adminProvision" | "auditLog">

/**
 * One-time operator step. Stores the exact issuer and subject that becomes
 * the first Admin. The singleton row means setup can never grant Admin again.
 */
export async function provisionFirstAdmin(
  db: Db,
  identity: { issuer: string; subject: string }
) {
  try {
    return await db.$transaction(async (tx) => {
      const provision = await tx.adminProvision.create({
        data: { id: 1, issuer: identity.issuer, subject: identity.subject },
      })
      await tx.auditLog.create({
        data: {
          action: "admin_provisioned",
          entityType: "admin_provision",
          entityId: "1",
          details: { issuer: identity.issuer, subject: identity.subject },
        },
      })
      return provision
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("First Admin is already provisioned", { cause: error })
    }
    throw error
  }
}

/**
 * Runs before each new session. When the user owns the provisioned identity
 * and the grant is unused, it makes them the active Admin exactly once.
 */
export async function claimFirstAdmin(db: PrismaClient, userId: string) {
  const provision = await db.adminProvision.findFirst({
    where: { consumedAt: null },
  })
  if (!provision) return false

  const providerIds = Object.entries(ISSUER_BY_PROVIDER)
    .filter(([, issuer]) => issuer === provision.issuer)
    .map(([providerId]) => providerId)
  const account = await db.account.findFirst({
    where: {
      userId,
      providerId: { in: providerIds },
      accountId: provision.subject,
    },
  })
  if (!account) return false

  return db.$transaction(async (tx) => {
    // The consumedAt guard makes concurrent first sign-ins claim at most once.
    const { count } = await tx.adminProvision.updateMany({
      where: { id: provision.id, consumedAt: null },
      data: { consumedAt: new Date(), userId },
    })
    if (count === 0) return false
    await tx.user.update({
      where: { id: userId },
      data: { status: "active", role: "admin" },
    })
    await tx.auditLog.create({
      data: {
        action: "admin_bootstrapped",
        entityType: "user",
        entityId: userId,
        details: { issuer: provision.issuer, subject: provision.subject },
      },
    })
    return true
  })
}
