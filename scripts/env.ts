/**
 * `.env.local`, loaded before anything that reads it.
 *
 * This file exists to be the FIRST import in a script, and it is three lines
 * long on purpose. A bare `loadEnvLocal()` call sitting between two import
 * blocks does NOT work, however much it looks like it does — and every other
 * script in this directory is written that way and gets away with it only
 * because none of them import a module that reads the environment when it loads.
 *
 * WHY IT DOES NOT WORK: `tsx` runs on esbuild, and esbuild hoists every import
 * above the other statements in a module. So `import { db } from '../lib/db'`
 * is evaluated *before* the `loadEnvLocal()` call that appears above it in the
 * source, and `lib/db` — which reads `DATABASE_URL` at import time — finds
 * nothing and builds no client.
 *
 * The failure is quiet in the worst way: nothing throws. The client is simply
 * null, every read falls back to "no database", and the report reads as a
 * catalogue that was never imported rather than as an unset variable.
 *
 * Import order *among imports* is preserved, so being imported first is enough:
 *
 *   import './env'
 *   import { readRule } from '../lib/db/rules'
 */

import { loadEnvLocal } from '../lib/db/load-env'

loadEnvLocal()
