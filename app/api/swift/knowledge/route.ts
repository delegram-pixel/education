import { listInstitutions, listSwiftKnowledgeProgrammes } from '@/lib/db/catalogue'
import { groupByState } from '@/lib/institutions'

export const revalidate = 3600

/**
 * A plain-text knowledge document for Swift's website knowledge source.
 * Add this public URL in Swift's dashboard after deployment. Keeping it as
 * Markdown makes it useful to a crawler and straightforward to audit.
 */
export async function GET() {
  const [{ programmes, source }, { institutions }] = await Promise.all([
    listSwiftKnowledgeProgrammes(),
    listInstitutions(),
  ])
  const generatedAt = new Date().toISOString()

  const entries = programmes
    .map((programme) => {
      const details = [
        programme.department ? `Department: ${programme.department}` : null,
        programme.status ? `Status: ${programme.status}` : null,
        programme.utmeSubjects.length ? `UTME subjects: ${programme.utmeSubjects.join(', ')}` : null,
        programme.olevelRequirements ? `O-level requirements: ${programme.olevelRequirements}` : null,
        programme.directEntryRequirements ? `Direct Entry requirements: ${programme.directEntryRequirements}` : null,
        programme.remarks
          ? // Only a mirrored IBASS row's remarks are IBASS's own words. Labelling
            // the sample fallback's note "Official" would credit it to JAMB.
            `${source === 'ibass' ? 'Official remarks' : 'Note'}: ${programme.remarks}`
          : null,
        `Source: ${programme.sourceUrl}`,
      ]
        .filter(Boolean)
        .join('\n')

      return `## ${programme.programme} — ${programme.institution}\n${details}`
    })
    .join('\n\n')

  // Swift answers school-level questions — "which universities are in Lagos?",
  // "does UNILAG offer Nursing?" — from this list, so it carries the state and a
  // count. The count is what the catalogue holds, and the section says so: left
  // unqualified it reads as what the institution offers.
  const institutionEntries = groupByState(institutions)
    .map((group) => {
      const rows = group.institutions
        .map(
          (institution) =>
            `- ${institution.name}${
              institution.institutionType ? ` (${institution.institutionType})` : ''
            } — ${institution.programmeCount} programme${
              institution.programmeCount === 1 ? '' : 's'
            } listed`,
        )
        .join('\n')

      return `### ${group.state ?? 'State not recorded'}\n${rows}`
    })
    .join('\n\n')

  const body = `# Admission Copilot: Nigeria admissions catalogue

Generated: ${generatedAt}
Catalogue status: ${source === 'ibass' ? 'JAMB IBASS mirror' : 'sample fallback only'}

Use this catalogue to help students discover institutions and programmes. Do not claim that a course is available, a requirement is current, or a student is eligible without citing the source URL and asking them to verify the current JAMB IBASS and institution bulletin. Only the Admission Copilot eligibility checker can present a reviewed automated verdict.

The Institutions section below lists every institution held and how many programmes the catalogue currently records for it. Use it for school-level questions — which institutions are in a given state, or whether a named school appears at all. A programme count is what this catalogue holds and must never be repeated back as what the institution offers.

## Safety and deadline rules

- Fees, deadlines, portal screens and programme requirements can change each admission session. Ask the student to verify them in the current JAMB IBASS record and the institution's own bulletin.
- Never tell a student to pay through a forwarded link. Advise them to open the official portal themselves.
- Never request, repeat, or handle an OTP, password, PIN, bank-card number, or account credentials.
- When a question cannot be answered from a cited official source, say so and offer a counselor handoff.

## Institutions

Every institution held, by state, with how many programmes the catalogue currently lists for it. That count is what this catalogue holds — not how many the school offers, and not a statement that any of them will admit anyone. An institution shown with no programmes is one we hold no detail for, not one that offers nothing.

${institutionEntries}

## Programmes

${entries}\n`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
