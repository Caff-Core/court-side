import { existsSync } from "node:fs"
import { resolve } from "node:path"

/**
 * Loads the repository root .env when it exists. CI and production provide
 * real environment variables instead, and those always win.
 */
export function loadLocalEnv() {
  const envFile = resolve(import.meta.dirname, "../../../../.env")
  if (existsSync(envFile)) process.loadEnvFile(envFile)
}
