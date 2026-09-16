/**
 * Minimal .env.local loader.
 *
 * Next.js loads .env.local automatically, but the seed script and drizzle-kit
 * run outside Next and do not. Rather than depend on dotenv or on a CLI flag
 * that differs between node, tsx and drizzle-kit, this reads the file directly.
 *
 * Existing environment variables always win, so a value exported in the shell
 * or injected by a deployment platform is never overwritten by the file.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function loadEnvLocal(): void {
  for (const filename of ['.env.local', '.env']) {
    const path = resolve(process.cwd(), filename)
    if (!existsSync(path)) continue

    for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue

      const eq = line.indexOf('=')
      if (eq === -1) continue

      const key = line.slice(0, eq).trim()
      if (process.env[key] !== undefined) continue

      let value = line.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      process.env[key] = value
    }
  }
}
