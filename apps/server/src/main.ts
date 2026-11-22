import "reflect-metadata"

import { Logger } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"

import { loadLocalEnv } from "./config/load-env.js"

loadLocalEnv()

const { parseEnv } = await import("./config/env.js")
const { AppModule } = await import("./app.module.js")
const { configureApp } = await import("./configure-app.js")

const env = parseEnv()
const app = configureApp(await NestFactory.create(AppModule))

await app.listen(env.PORT)
Logger.log(`API listening on http://localhost:${env.PORT}/api`, "Bootstrap")
