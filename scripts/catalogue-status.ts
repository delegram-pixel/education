/**
 * Report how much of the IBASS catalogue has landed.
 *
 * The sync prints nothing until it finishes. That keeps its output readable, but
 * it also makes a healthy multi-minute import indistinguishable from a hung one
 * — the only thing it emits mid-run is a retry warning when something goes
 * wrong, so silence is ambiguous.
 *
 * This answers "is it still working?" in two round trips, which means it can be
 * run repeatedly in a second terminal while a sync is in flight. Read-only: it
 * counts rows and changes nothing, so it is safe to run at any time, including
 * against a partially imported catalogue.
 *
 *   yarn catalogue:status
 *
 * WHY IT BREAKS THE COUNT DOWN BY TYPE: a single total hid a real gap for a
 * while. The mirror held 784 institutions and looked healthy, while holding no
 * universities at all — the number could not say so, and neither could the sync,
 * which reports one total for the run. IBASS publishes its types in order and
 * the sync imports them in that order, so the type at the end of the list is the
 * one that is missing whenever a run is cut short. Grouping by type makes "are
 * there universities?" a line of output rather than a query someone has to think
 * to run.
 */

import { loadEnvLocal } from '../lib/db/load-env'

loadEnvLocal()

import { count, desc, isNotNull, sql } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'

import { catalogueInstitutions, catalogueProgrammes } from '../lib/db/schema'

async function main() {
  const url = process.env.DATABASE_URL

  if (!url) {
    console.log('No DATABASE_URL set — nothing to report.')
    return
  }

  const db = drizzle(neon(url))

  const [institutions] = await db
    .select({ total: count(catalogueInstitutions.id) })
    .from(catalogueInstitutions)
  const [programmes] = await db
    .select({ total: count(catalogueProgrammes.id) })
    .from(catalogueProgrammes)

  // A missing row means the table does not exist yet, which is a real state
  // rather than an error: `catalogue:prepare` has not been run.
  if (institutions === undefined) {
    console.log('The catalogue tables are not present. Run `yarn catalogue:prepare` first.')
    return
  }

  console.log(`Institutions: ${institutions.total}`)
  console.log(`Programmes:   ${programmes?.total ?? 0}`)

  // The load-bearing line. A type that IBASS advertises but that is absent here
  // is a truncated import, and it should be visible rather than inferred.
  const byType = await db
    .select({
      institutionType: catalogueInstitutions.institutionType,
      total: count(catalogueInstitutions.id),
    })
    .from(catalogueInstitutions)
    .groupBy(catalogueInstitutions.institutionType)
    .orderBy(desc(count(catalogueInstitutions.id)))

  console.log('\nBy institution type:')
  for (const row of byType) {
    console.log(`  ${row.institutionType ?? '(none recorded)'}: ${row.total}`)
  }

  // Institutions the mirror knows about but holds no programmes for. Not an
  // error — the LEFT join in `listInstitutions` exists for exactly these — but a
  // large number means the programme import is behind the institution import.
  const [withoutProgrammes] = await db
    .select({ total: count(catalogueInstitutions.id) })
    .from(catalogueInstitutions)
    .leftJoin(
      catalogueProgrammes,
      sql`${catalogueProgrammes.institutionId} = ${catalogueInstitutions.id}`,
    )
    .where(sql`${catalogueProgrammes.id} is null`)

  console.log(`\nInstitutions with no programmes: ${withoutProgrammes?.total ?? 0}`)

  // When a sync is running this is the current minute; a stale value means the
  // mirror is not being refreshed.
  const [latest] = await db
    .select({ at: sql<string | null>`max(${catalogueInstitutions.sourceUpdatedAt})` })
    .from(catalogueInstitutions)
    .where(isNotNull(catalogueInstitutions.sourceUpdatedAt))

  console.log(`Last import: ${latest?.at ?? 'never'}`)
}

main().catch((error) => {
  console.error('Could not read the catalogue:', error)
  process.exit(1)
})
