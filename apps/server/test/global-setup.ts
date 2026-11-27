import { execFileSync } from "node:child_process"
import { resolve } from "node:path"
import pg from "pg"

import { loadLocalEnv } from "../src/config/load-env.js"
import { testDatabaseUrl } from "./helpers/test-database.js"

const serverRoot = resolve(import.meta.dirname, "..")

export default async function globalSetup() {
  loadLocalEnv()
  const url = testDatabaseUrl(process.env.DATABASE_URL)
  const name = new URL(url).pathname.slice(1)

  const maintenance = new URL(url)
  maintenance.pathname = "/postgres"
  const client = new pg.Client({ connectionString: maintenance.toString() })
  await client.connect()
  const { rowCount } = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [name]
  )
  if (!rowCount) await client.query(`CREATE DATABASE "${name}"`)
  await client.end()

  const env = { ...process.env, DATABASE_URL: url }
  execFileSync("bunx", ["prisma", "migrate", "deploy"], {
    cwd: serverRoot,
    env,
    stdio: "ignore",
  })
  execFileSync("bunx", ["tsx", "prisma/seed.ts"], {
    cwd: serverRoot,
    env,
    stdio: "ignore",
  })
}
