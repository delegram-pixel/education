/**
 * Seed the catalogue tables from the static constants.
 *
 * Idempotent by design: every write is an upsert, so this can be run any number
 * of times, against a fresh or a half-populated database, without duplicating a
 * row or wiping a record. That matters because a demo must never depend on
 * anyone remembering to reset the database first.
 *
 *   npm run db:seed
 *
 * With no DATABASE_URL set it exits cleanly and says so — the application reads
 * from these same constants when the database is absent, so an unseeded
 * environment is a supported state, not a broken one.
 */

import { loadEnvLocal } from './load-env'

loadEnvLocal()

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'

import { COURSES } from './courses.data'
import { WALKTHROUGHS } from './walkthroughs.data'
import { courses, steps, walkthroughs } from './schema'

async function main() {
  const url = process.env.DATABASE_URL

  if (!url) {
    console.log('No DATABASE_URL set — nothing to seed.')
    console.log('The app reads course and walkthrough data from lib/db/*.data.ts in that case,')
    console.log('so every flow still works. Add a Neon URL to .env.local to enable persistence.')
    return
  }

  const db = drizzle(neon(url))

  /* --- Courses --------------------------------------------------------- */

  for (const course of COURSES) {
    const row = {
      id: course.id,
      name: course.name,
      institution: course.institution,
      institutionShort: course.institutionShort,
      faculty: course.faculty,
      durationYears: course.durationYears,
      utmeCutoff: course.utmeCutoff,
      blurb: course.blurb,
      reality: course.reality,
      olevelRule: course.olevelRule,
      utmeRule: course.utmeRule,
      personaProfile: course.personaProfile,
    }

    await db.insert(courses).values(row).onConflictDoUpdate({ target: courses.id, set: row })
  }

  console.log(`Seeded ${COURSES.length} courses.`)

  /* --- Walkthroughs and steps ------------------------------------------ */

  let stepCount = 0

  for (const walkthrough of WALKTHROUGHS) {
    const row = {
      id: walkthrough.id,
      title: walkthrough.title,
      description: walkthrough.description,
      estimatedMinutes: walkthrough.estimatedMinutes,
      bringWithYou: walkthrough.bringWithYou,
    }

    await db
      .insert(walkthroughs)
      .values(row)
      .onConflictDoUpdate({ target: walkthroughs.id, set: row })

    for (const step of walkthrough.steps) {
      const stepRow = {
        id: step.id,
        walkthroughId: walkthrough.id,
        order: step.order,
        title: step.title,
        instruction: step.instruction,
        screenshotUrl: step.screenshotUrl,
        hotspot: step.hotspot,
        tip: step.tip,
        defines: step.defines ?? null,
      }

      await db.insert(steps).values(stepRow).onConflictDoUpdate({ target: steps.id, set: stepRow })
      stepCount += 1
    }
  }

  console.log(`Seeded ${WALKTHROUGHS.length} walkthroughs and ${stepCount} steps.`)
  console.log('Done. Re-running this is safe.')
}

main().catch((error) => {
  console.error('Seeding failed:', error)
  process.exit(1)
})
