import "reflect-metadata"

import { loadLocalEnv } from "../src/config/load-env.js"
import { testDatabaseUrl } from "./helpers/test-database.js"

loadLocalEnv()

process.env.DATABASE_URL = testDatabaseUrl(process.env.DATABASE_URL)
process.env.NODE_ENV = "test"
process.env.APP_URL = "http://localhost:5173"
process.env.BETTER_AUTH_SECRET =
  "test-secret-for-automated-checks-only-0123456789"
process.env.AUTH_IDENTITY_FIXTURE = "true"
// Automated tests never call Google.
delete process.env.GOOGLE_CLIENT_ID
delete process.env.GOOGLE_CLIENT_SECRET
