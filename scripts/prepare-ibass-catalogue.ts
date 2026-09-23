/** Creates only the additive tables used by the JAMB IBASS mirror. */
import { loadEnvLocal } from '../lib/db/load-env'

loadEnvLocal()

import { neon } from '@neondatabase/serverless'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required for catalogue:prepare.')

  const db = drizzle(neon(url))
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS catalogue_institutions (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      institution_type text,
      category text,
      state text,
      source_url text NOT NULL,
      source_updated_at timestamp with time zone NOT NULL
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS catalogue_programmes (
      id text PRIMARY KEY NOT NULL,
      institution_id text NOT NULL REFERENCES catalogue_institutions(id) ON DELETE CASCADE,
      name text NOT NULL,
      department text,
      status text,
      utme_subjects jsonb NOT NULL DEFAULT '[]'::jsonb,
      olevel_requirements text,
      direct_entry_requirements text,
      remarks text,
      source_url text NOT NULL,
      source_updated_at timestamp with time zone NOT NULL
    )
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS catalogue_programmes_institution_idx
    ON catalogue_programmes (institution_id)
  `)
  console.log('IBASS catalogue tables are ready.')
}

main().catch((error) => {
  console.error('Could not prepare IBASS catalogue tables:', error)
  process.exit(1)
})
