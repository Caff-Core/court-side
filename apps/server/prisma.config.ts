import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { defineConfig } from "prisma/config"

// Local development reads the repository root .env. CI sets real variables.
const envFile = resolve(import.meta.dirname, "../../.env")
if (existsSync(envFile)) process.loadEnvFile(envFile)

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // prisma generate runs without a database, so the URL may be empty here.
    url: process.env.DATABASE_URL ?? "",
  },
})
