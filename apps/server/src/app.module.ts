import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { Module, type DynamicModule } from "@nestjs/common"
import { ServeStaticModule } from "@nestjs/serve-static"

import { AccountsModule } from "./accounts/accounts.module.js"
import { AuthModule } from "./auth/auth.module.js"
import { BookingsModule } from "./bookings/bookings.module.js"
import { ClosuresModule } from "./closures/closures.controller.js"
import { ClockModule } from "./common/clock.js"
import { ConfigModule } from "./config/config.module.js"
import { HealthModule } from "./health/health.module.js"
import { NotificationsModule } from "./notifications/notifications.controller.js"
import { PrismaModule } from "./prisma/prisma.module.js"
import { ScheduleModule } from "./schedule/schedule.module.js"

const webDist = resolve(import.meta.dirname, "../../web/dist")

/**
 * Same-origin setup: once the web app is built, NestJS serves it next to the
 * API. During development Vite serves the web app and proxies /api here.
 */
function webAppModule(): DynamicModule[] {
  if (process.env.NODE_ENV !== "production" || !existsSync(webDist)) return []
  return [
    ServeStaticModule.forRoot({
      rootPath: webDist,
      exclude: ["/api/{*path}"],
    }),
  ]
}

@Module({
  imports: [
    ConfigModule,
    ClockModule,
    PrismaModule,
    AuthModule,
    HealthModule,
    AccountsModule,
    ScheduleModule,
    BookingsModule,
    NotificationsModule,
    ClosuresModule,
    ...webAppModule(),
  ],
})
export class AppModule {}
