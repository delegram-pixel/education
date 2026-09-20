import { listSwiftKnowledgeProgrammes } from '@/lib/db/catalogue'

export const revalidate = 3600

/**
 * A plain-text knowledge document for Swift's website knowledge source.
 * Add this public URL in Swift's dashboard after deployment. Keeping it as
 * Markdown makes it useful to a crawler and straightforward to audit.
 */
export async function GET() {
  const { programmes, source } = await listSwiftKnowledgeProgrammes()
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

  const body = `# Admission Copilot: Nigeria admissions catalogue

Generated: ${generatedAt}
Catalogue status: ${source === 'ibass' ? 'JAMB IBASS mirror' : 'sample fallback only'}

Use this catalogue to help students discover institutions and programmes. Do not claim that a course is available, a requirement is current, or a student is eligible without citing the source URL and asking them to verify the current JAMB IBASS and institution bulletin. Only the Admission Copilot eligibility checker can present a reviewed automated verdict.

## Safety and deadline rules

- Fees, deadlines, portal screens and programme requirements can change each admission session. Ask the student to verify them in the current JAMB IBASS record and the institution's own bulletin.
- Never tell a student to pay through a forwarded link. Advise them to open the official portal themselves.
- Never request, repeat, or handle an OTP, password, PIN, bank-card number, or account credentials.
- When a question cannot be answered from a cited official source, say so and offer a counselor handoff.

${entries}\n`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
