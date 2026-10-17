import { listInstitutions, listSwiftKnowledgeProgrammes } from '@/lib/db/catalogue'
import { groupByState } from '@/lib/institutions'

export const revalidate = 3600

/**
 * How many programme records the document carries.
 *
 * The Institutions section below is complete — 466 schools is tens of kilobytes
 * — and answers most school-level questions on its own. Programme detail is the
 * part that does not scale, so it is sampled. Depth belongs in the app, where
 * the catalogue is queried one school at a time instead of shipped whole.
 */
const MAX_PROGRAMME_ENTRIES = 500

/**
 * The name the document is saved under.
 *
 * Swift's knowledge base ingests FILES, so the ordinary path for this endpoint
 * is: fetch it, save it, upload it. Without a filename the browser names the
 * saved file after the last path segment — `knowledge`, with no extension — and
 * the person doing the upload has nothing to tell one snapshot from the next.
 * Naming it here keeps that in one place rather than in whoever's clipboard.
 */
const KNOWLEDGE_FILENAME = 'admission-copilot-catalogue.md'

/**
 * The knowledge document, generated on demand from the catalogue.
 *
 * Swift's knowledge base ingests this as an uploaded FILE rather than by
 * crawling a URL, so this endpoint's job is to produce a current snapshot:
 * fetch it, save it, upload it. That makes staleness the operator's problem
 * rather than the crawler's, which is why the document carries its own
 * `Generated:` timestamp — the uploaded copy has no other way to say how old it
 * is. Markdown keeps it readable by whatever consumes it and easy to audit.
 */
export async function GET(request: Request) {
  // A browser renders `text/markdown` inline, which is right for reading the
  // document and right for a crawler, but wrong for the upload step: it leaves
  // the operator with a rendered page and no file. `?download=1` asks for the
  // save instead. The default stays inline so the URL remains readable in a tab.
  const download = new URL(request.url).searchParams.get('download') === '1'

  const [{ programmes, source }, { institutions }] = await Promise.all([
    // The one caller that renders the brochure's prose, so the one caller that
    // asks for it. Everything else reads the listing columns alone.
    listSwiftKnowledgeProgrammes({ prose: true }),
    listInstitutions(),
  ])
  const generatedAt = new Date().toISOString()

  // The national catalogue runs past twelve thousand programmes. Rendered in
  // full that is megabytes of Markdown, and an oversized document does not
  // degrade gracefully — the crawler rejects the whole thing and Swift is left
  // with nothing. Capping keeps it indexable and states plainly what is missing,
  // so a gap is never mistaken for an answer.
  const listed = programmes.slice(0, MAX_PROGRAMME_ENTRIES)

  const programmeNote =
    programmes.length > listed.length
      ? `The first ${listed.length} of ${programmes.length} programmes in the catalogue, ordered by institution. This is a sample, not the complete list: a programme absent from here is outside the sample, NOT evidence that the institution does not offer it. Never tell a student a school does not offer a programme because it is missing from this document.\n\n`
      : ''

  const entries = listed
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

${programmeNote}${entries}\n`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      // `inline` on the default path is not decoration: it is what tells the
      // browser the filename to offer if the operator saves the page they are
      // already reading, so both routes out of here land on the same name.
      'Content-Disposition': `${
        download ? 'attachment' : 'inline'
      }; filename="${KNOWLEDGE_FILENAME}"`,
    },
  })
}
