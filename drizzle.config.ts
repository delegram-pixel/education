import type { Config } from 'drizzle-kit'

import { loadEnvLocal } from './lib/db/load-env'

// Drizzle Kit runs outside Next.js, so it does not automatically load the
// database URL from the project's local environment files.
loadEnvLocal()

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  verbose: true,
  strict: true,
} satisfies Config
