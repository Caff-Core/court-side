import type { INestApplication } from "@nestjs/common"

export const API_PREFIX = "api"

/** Shared by the server entry point and the request tests. */
export function configureApp<T extends INestApplication>(app: T): T {
  app.setGlobalPrefix(API_PREFIX)
  app.enableShutdownHooks()
  return app
}
