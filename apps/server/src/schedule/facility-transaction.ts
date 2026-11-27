import type { Prisma } from "../generated/prisma/client.js"
import type { Clock } from "../common/clock.js"
import type { PrismaService } from "../prisma/prisma.service.js"

export type Tx = Prisma.TransactionClient

/**
 * Runs schedule writes for one facility one at a time. The facility row lock
 * serializes every writer for that facility, so overlap and cap checks see
 * each other's committed results. "Now" is read after the lock, and expired
 * holds are released before any check reads occupancy or the cap.
 */
export function inFacilityTransaction<T>(
  prisma: PrismaService,
  clock: Clock,
  facilityId: string,
  work: (tx: Tx, now: Date) => Promise<T>
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM facility WHERE id = ${facilityId}::uuid FOR UPDATE`
      const now = clock.now()
      await releaseExpiredHolds(tx, facilityId, now)
      return work(tx, now)
    },
    { maxWait: 10_000, timeout: 15_000 }
  )
}

/** Expires pending requests past their deadline and frees their time. */
async function releaseExpiredHolds(tx: Tx, facilityId: string, now: Date) {
  await tx.booking.updateMany({
    where: { facilityId, status: "pending", expiresAt: { lte: now } },
    data: { status: "expired" },
  })
  await tx.scheduleEntry.deleteMany({
    where: { facilityId, kind: "hold", expiresAt: { lte: now } },
  })
}
