/**
 * Tests use their own database next to the development one, so resetting
 * accounts never touches demo data. The name gains a _test suffix.
 */
export function testDatabaseUrl(databaseUrl: string | undefined) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required for tests")
  const url = new URL(databaseUrl)
  const name = url.pathname.replace(/^\//, "")
  if (!name.endsWith("_test")) url.pathname = `/${name}_test`
  return url.toString()
}
