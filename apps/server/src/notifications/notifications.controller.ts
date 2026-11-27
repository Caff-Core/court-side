import { Controller, Get, Inject, Module } from "@nestjs/common"

import { CurrentAccount, SignedIn } from "../auth/access.decorators.js"
import type { CurrentAccount as Account } from "../auth/current-account.js"
import { PrismaService } from "../prisma/prisma.service.js"

/** Each account reads only its own in-app notifications. */
@SignedIn()
@Controller("notifications")
export class NotificationsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentAccount() account: Account) {
    const rows = await this.prisma.notification.findMany({
      where: { recipientId: account.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        bookingId: true,
        message: true,
        createdAt: true,
        readAt: true,
      },
    })
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
    }))
  }
}

@Module({ controllers: [NotificationsController] })
export class NotificationsModule {}
