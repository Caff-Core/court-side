import { z } from "zod"

const flag = z
  .enum(["true", "false", ""])
  .optional()
  .transform((value) => value === "true")

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    PORT: z.coerce.number().int().positive().default(3000),
    APP_URL: z.url().default("http://localhost:5173"),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    AUTH_IDENTITY_FIXTURE: flag,
  })
  .refine(
    (env) => !(env.NODE_ENV === "production" && env.AUTH_IDENTITY_FIXTURE),
    {
      message: "AUTH_IDENTITY_FIXTURE must stay off in production",
      path: ["AUTH_IDENTITY_FIXTURE"],
    }
  )

export type Env = z.infer<typeof envSchema>

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(result.error)}`
    )
  }
  return result.data
}

export function googleCredentials(env: Env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  }
}
