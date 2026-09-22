import type { Metadata } from 'next'

import { SchoolBrowser } from '@/components/schools/school-browser'
import { AdmissionSafetyNotice } from '@/components/shared/admission-safety-notice'
import { Reveal } from '@/components/shared/reveal'
import { Badge } from '@/components/ui/badge'
import { listInstitutions } from '@/lib/db/catalogue'
import { listCourses } from '@/lib/db/queries'
import { programmeTotal, reviewedInstitutionKeys } from '@/lib/institutions'

export const metadata: Metadata = {
  title: 'Browse schools',
  description:
    'Browse the institutions in the JAMB IBASS catalogue, see which programmes each one lists, and go straight to the official record.',
}

/**
 * The national catalogue, browsable by school.
 *
 * The counterpart to the eligibility picker: that one offers the few courses we
 * have reviewed well enough to decide on, and this one offers the country. The
 * two must stay visibly different — nothing on this page can produce a verdict,
 * and the header says so before the list starts.
 */
export default async function SchoolsPage() {
  const [{ institutions, source }, { data: courses }] = await Promise.all([
    listInstitutions(),
    listCourses(),
  ])
  const programmes = programmeTotal(institutions)

  // Which schools the checker can actually decide on. Sent as an array because a
  // Set does not survive the server-to-client boundary; the browser rebuilds it.
  const reviewedKeys = [...reviewedInstitutionKeys(courses)]

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={source === 'ibass' ? 'success' : 'outline'}>
            {source === 'ibass' ? 'JAMB IBASS mirror' : 'Sample catalogue'}
          </Badge>
          <span className="text-[0.8125rem] text-muted">
            {institutions.length} institution{institutions.length === 1 ? '' : 's'} &middot;{' '}
            {programmes} programme{programmes === 1 ? '' : 's'} listed
          </span>
        </div>

        <h1 className="mt-4 text-[2rem] sm:text-[2.5rem]">Browse schools</h1>
        <p className="mt-3 max-w-2xl text-[1.0625rem] leading-relaxed text-muted">
          Search any institution in the catalogue by name, or narrow by state, award level or
          category, then pick one to see the programmes it lists. Schools the eligibility checker
          has a reviewed course at are marked and listed first; everywhere else links out to the
          official record. This is a listing; it does not say whether you qualify for anything.
        </p>
      </Reveal>

      <Reveal>
        <AdmissionSafetyNotice className="mt-6" />
      </Reveal>

      <Reveal>
        <SchoolBrowser institutions={institutions} reviewedKeys={reviewedKeys} />
      </Reveal>

      {source === 'sample' ? (
        <p className="mt-8 text-center text-[0.8125rem] leading-relaxed text-muted">
          Showing the built-in sample catalogue. The national IBASS catalogue has not been imported
          on this deployment, so this is not the full set of Nigerian institutions &mdash; see the
          README for the import steps.
        </p>
      ) : null}
    </div>
  )
}
