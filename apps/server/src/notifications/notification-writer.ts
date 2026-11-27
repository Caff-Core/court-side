import { Injectable } from "@nestjs/common"

import type { NotificationType } from "../generated/prisma/enums.js"
import type { Tx } from "../schedule/facility-transaction.js"

export type NotificationInput = {
  recipientId: string
  type: NotificationType
  bookingId?: string
  /** Unique per event and recipient, so a retried action never repeats it. */
  dedupeKey: string
  message: string
}

/**
 * Writes in-app notifications inside the caller's transaction. A failed
 * write fails the whole change, so a booking is never cancelled or blocked
 * without its notification. Tests replace this provider to inject failures.
 */
@Injectable()
export class NotificationWriter {
  async notify(tx: Tx, input: NotificationInput): Promise<void> {
    await tx.notification.create({ data: input })
  }
}
