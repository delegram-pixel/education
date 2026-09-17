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
        programme.remarks ? `Official remarks: ${programme.remarks}` : null,
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

${entries}\n`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
