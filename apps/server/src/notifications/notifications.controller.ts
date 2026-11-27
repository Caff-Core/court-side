import {
  Controller,
  Get,
  Global,
  HttpCode,
  Inject,
  Module,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common"

import { CurrentAccount, SignedIn } from "../auth/access.decorators.js"
import type { CurrentAccount as Account } from "../auth/current-account.js"
import { CLOCK, type Clock } from "../common/clock.js"
import type { Prisma } from "../generated/prisma/client.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { NotificationWriter } from "./notification-writer.js"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const notificationView = {
  id: true,
  type: true,
  bookingId: true,
  message: true,
  createdAt: true,
  readAt: true,
} as const satisfies Prisma.NotificationSelect

type NotificationRow = Prisma.NotificationGetPayload<{
  select: typeof notificationView
}>

/**
 * Every read and write is scoped to the signed-in recipient, so one account
 * can never see or mark another's notifications.
 */
@SignedIn()
@Controller("notifications")
export class NotificationsController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock
  ) {}

  private mine(account: Account) {
    return { recipientId: account.id } satisfies Prisma.NotificationWhereInput
  }

  @Get()
  async list(@CurrentAccount() account: Account) {
    const rows = await this.prisma.notification.findMany({
      where: this.mine(account),
      orderBy: { createdAt: "desc" },
      take: 50,
      select: notificationView,
    })
    return rows.map(toView)
  }

  @Get("unread-count")
  async unreadCount(@CurrentAccount() account: Account) {
    const count = await this.prisma.notification.count({
      where: { ...this.mine(account), readAt: null },
    })
    return { count }
  }

  @Post("read-all")
  @HttpCode(200)
  async readAll(@CurrentAccount() account: Account) {
    const result = await this.prisma.notification.updateMany({
      where: { ...this.mine(account), readAt: null },
      data: { readAt: this.clock.now() },
    })
    return { updated: result.count }
  }

  @Post(":id/read")
  @HttpCode(200)
  async read(@CurrentAccount() account: Account, @Param("id") id: string) {
    const where = { ...this.mine(account), id }
    const found = UUID.test(id)
      ? await this.prisma.notification.findFirst({
          where,
          select: notificationView,
        })
      : null
    if (!found) throw new NotFoundException("Notification not found")
    if (found.readAt) return toView(found)
    const row = await this.prisma.notification.update({
      where: { id },
      data: { readAt: this.clock.now() },
      select: notificationView,
    })
    return toView(row)
  }
}

function toView(row: NotificationRow) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
  }
}

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationWriter],
  exports: [NotificationWriter],
})
export class NotificationsModule {}
