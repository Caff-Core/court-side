import type { INestApplication } from "@nestjs/common"
import { toNodeHandler } from "better-auth/node"
import type { Express } from "express"

import { AUTH_BASE_PATH, type Auth } from "./auth/auth.js"
import { AUTH } from "./auth/auth.tokens.js"

export const API_PREFIX = "api"

/** Shared by the server entry point and the request tests. */
export function configureApp<T extends INestApplication>(app: T): T {
  // Better Auth reads the raw request body, so its handler is mounted before
  // NestJS registers its JSON body parser during init.
  const express = app.getHttpAdapter().getInstance() as Express
  express.all(`${AUTH_BASE_PATH}/*splat`, toNodeHandler(app.get<Auth>(AUTH)))

  app.setGlobalPrefix(API_PREFIX)
  app.enableShutdownHooks()
  return app
}
