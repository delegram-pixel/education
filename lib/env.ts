/**
 * One schema for the environment.
 *
 * Variables used to be read ad hoc at each call site, which meant a typo in a
 * deployment was discovered by whichever feature happened to reach that line
 * first — often as a quiet fallback rather than an error. Parsing them in one
 * place makes a malformed value a startup failure with the variable named, and
 * makes the optional ones explicit instead of merely absent.
 *
 * Everything here is server-side. None of these names carries a `NEXT_PUBLIC_`
 * prefix, and none should: that prefix inlines the value into the browser
 * bundle at build time.
 *
 * The schema is deliberately permissive about *presence* — the app is designed
 * to run with no database and no model key — and strict about *shape*. A blank
 * string is treated as unset, because `.env.local` documents optional values
 * that way.
 */

import { z } from 'zod'

const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value

const optionalText = z.preprocess(blankToUndefined, z.string().trim().min(1).optional())

const optionalUrl = z.preprocess(blankToUndefined, z.string().trim().url().optional())

const positiveInteger = z.preprocess(
  blankToUndefined,
  z.coerce.number().int().min(0).max(100_000).default(200),
)

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /** Postgres/Neon connection string. Absent means "serve static data". */
  DATABASE_URL: optionalText,

  /** Groq key for reading brochure prose. Absent means the reader is off. */
  GROQ_API_KEY: optionalText,

  /**
   * Hard ceiling on fresh model reads per UTC day, across every instance.
   * Zero disables fresh reads without unsetting the key.
   */
  GROQ_DAILY_CALL_LIMIT: positiveInteger,

  SWIFT_COMPANY_ID: optionalText,
  SWIFT_API_KEY: optionalText,

  /** Comma-separated keys for the catalogue API. Absent fails closed. */
  CATALOGUE_API_KEYS: optionalText,

  /** Public origin used to build links in API payloads. */
  APP_BASE_URL: optionalUrl,
})

export type Env = z.infer<typeof envSchema>

/**
 * Parse a source object, throwing with every problem it found.
 *
 * Exported separately from `getEnv` so the tests can exercise malformed input
 * without mutating `process.env`.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(source)
  if (parsed.success) return parsed.data

  const problems = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ')

  throw new Error(`Invalid environment configuration — ${problems}`)
}

let cached: Env | null = null

/**
 * The validated environment.
 *
 * Cached because the schema runs on every read otherwise, and because the
 * values cannot change while a process is serving requests.
 */
export function getEnv(): Env {
  cached ??= parseEnv(process.env)
  return cached
}

/**
 * Validate now, at startup, rather than at the first request that happens to
 * touch a variable.
 *
 * Called from `instrumentation.ts`. It also gives the deployment a line in the
 * logs that says which optional features are actually on — otherwise "the
 * model reader is off" and "the model reader is broken" look the same from the
 * outside.
 */
export function assertEnv(): Env {
  const env = getEnv()

  if (env.NODE_ENV === 'production') {
    console.info(
      `[env] database=${env.DATABASE_URL ? 'configured' : 'absent'} ` +
        `rule-reader=${env.GROQ_API_KEY && !env.GROQ_API_KEY.startsWith('your_') ? 'on' : 'off'} ` +
        `daily-rule-budget=${env.GROQ_DAILY_CALL_LIMIT} ` +
        `catalogue-api=${env.CATALOGUE_API_KEYS ? 'configured' : 'unconfigured'} ` +
        `swift=${env.SWIFT_COMPANY_ID && env.SWIFT_API_KEY ? 'configured' : 'absent'}`,
    )
  }

  return env
}
