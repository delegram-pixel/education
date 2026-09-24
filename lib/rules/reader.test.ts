import { describe, expect, it } from 'vitest'

import { buildRulePrompt, htmlToText, parseRuleResponse, sourceHash } from '@/lib/rules/reader'

/**
 * Real sentences from the IBASS mirror, Word markup and all.
 *
 * Copied rather than invented because the interesting failures are all in the
 * markup: the brochure is written in Word-and-pasted HTML whose tags are
 * unclosed, nested three deep, and interleaved with `<o:p>` elements that no
 * browser would ever emit.
 */
const ISLAMIC_STUDIES = [
  '<p class="nas1" style="line-height:10.0pt"><span lang="EN-GB">Five (5) SSC credit\r\n',
  'passes in English Language, Mathematics, Islamic Studies and any two (2) of<o:p></o:p></span></p>',
  '<p class="nas1" style="line-height:10.0pt"><span lang="EN-GB">1. Economics<o:p></o:p></span></p>',
  '<p class="nas1" style="line-height:10.0pt"><span lang="EN-GB">2. Government/History<o:p></o:p></span></p>',
].join('')

const SOCIAL_STUDIES_HISTORY = [
  '<table class="MsoTableGrid" border="1" cellspacing="0" cellpadding="0" style="border: none;">\r\n',
  ' <tbody><tr>\r\n  <td width="315" valign="top" style="width:236.25pt;border:solid black 1.0pt;">\r\n',
  '  <p class="nas" style="text-align:justify;line-height:10.0pt"><span lang="EN-GB" ',
  'style="color:windowtext">Five (5) SSC\r\n  credit passes in English Language, ',
  'Mathematics, History and any two (2) of\r\n  Geography, Government, Economics and ',
  'Christian Religious Studies/Islamic\r\n  Studies.<o:p></o:p></span></p>\r\n  </td>\r\n',
  ' </tr>\r\n</tbody></table>',
].join('')

describe('htmlToText', () => {
  it('reads the requirement out of the brochure markup', () => {
    expect(htmlToText(ISLAMIC_STUDIES)).toBe(
      'Five (5) SSC credit passes in English Language, Mathematics, Islamic Studies and any two (2) of 1. Economics 2. Government/History',
    )
  })

  it('keeps two <p> blocks from running together', () => {
    // The bug this guards: strip the tags with nothing in their place and the
    // sentence ends "...any two (2) of" immediately followed by "1. Economics",
    // which reads as a subject called "of1. Economics".
    const text = htmlToText(ISLAMIC_STUDIES)

    expect(text).not.toContain('of1.')
    expect(text).toContain('of 1. Economics')
  })

  it('reads a requirement out of a table cell', () => {
    expect(htmlToText(SOCIAL_STUDIES_HISTORY)).toBe(
      'Five (5) SSC credit passes in English Language, Mathematics, History and any two (2) of Geography, Government, Economics and Christian Religious Studies/Islamic Studies.',
    )
  })

  it('collapses the newlines Word leaves mid-sentence', () => {
    expect(htmlToText('<p>Five (5) SSC credit\r\npasses in Biology</p>')).toBe(
      'Five (5) SSC credit passes in Biology',
    )
  })

  it('decodes the entities the brochure uses', () => {
    expect(htmlToText('<p>Physics &amp; Chemistry&nbsp;&mdash; 5 credits</p>')).toBe(
      'Physics & Chemistry — 5 credits',
    )
  })

  it('decodes numeric escapes, in both bases', () => {
    expect(htmlToText('<p>O&#39;level &#x26; SSC</p>')).toBe("O'level & SSC")
  })

  it('leaves an escaped tag as text rather than reading it as markup', () => {
    // Tags are stripped before entities are decoded, so a literal &lt;p&gt; is
    // never given a second chance to be mistaken for a paragraph break.
    expect(htmlToText('<p>Use &lt;p&gt; for breaks</p>')).toBe('Use <p> for breaks')
  })

  it('drops a script block rather than reading it as a requirement', () => {
    expect(htmlToText('<p>Five credits</p><script>var x = 1;</script>')).toBe('Five credits')
  })

  it('returns an empty string for markup with no text in it', () => {
    expect(htmlToText('<p class="nas1"><span></span></p>')).toBe('')
    expect(htmlToText('')).toBe('')
  })
})

describe('sourceHash', () => {
  it('is stable for the same wording', () => {
    expect(sourceHash('Five credits')).toBe(sourceHash('Five credits'))
  })

  it('changes when the requirement is reworded', () => {
    expect(sourceHash('Five credits')).not.toBe(sourceHash('Six credits'))
  })

  it('does not change when only the markup changes', () => {
    // The hash is taken over the extracted text, so a Word re-export with new
    // styling does not invalidate every rule built from the old markup.
    const a = htmlToText('<p class="nas1"><span>Five credits</span></p>')
    const b = htmlToText('<p class="nas2" style="line-height:12pt"><b>Five credits</b></p>')

    expect(sourceHash(a)).toBe(sourceHash(b))
  })
})

describe('parseRuleResponse', () => {
  const rule = {
    minCredits: 5,
    mandatory: ['ENG', 'MTH', 'BIO'],
    anyOf: [{ subjects: ['CHM', 'PHY', 'AGR'], count: 2, label: 'science subjects' }],
    maxSittings: 2,
  }

  /** A reply that read a requirement, which is the shape the model mostly sends. */
  const read = (value: Record<string, unknown>) =>
    parseRuleResponse({ outcome: 'rule', ...value })

  /**
   * Why a reply was refused, or null when it was accepted.
   *
   * The reason is the point of these assertions now. Every refusal used to be
   * the same bare null, and the remedies are not the same: a reply we could not
   * parse is our problem, a sentence the model could not read is the brochure's,
   * and an uncertain "nothing here" is a guess we declined to write down.
   */
  function refusal(value: unknown): string | null {
    const outcome = parseRuleResponse(value)
    return outcome.status === 'failed' ? outcome.reason : null
  }

  it('accepts a well-formed rule', () => {
    expect(read({ confidence: 'high', rule })).toEqual({
      status: 'ready',
      confidence: 'high',
      rule,
    })
  })

  it('defaults maxSittings to 2 when the sentence is silent', () => {
    const { maxSittings, ...without } = rule
    const result = read({ confidence: 'high', rule: without })

    expect(result).toMatchObject({ status: 'ready', rule: { maxSittings: 2 } })
  })

  it('omits anyOf entirely when there are no groups', () => {
    const result = read({
      confidence: 'high',
      rule: { minCredits: 5, mandatory: ['ENG', 'MTH', 'BIO', 'CHM', 'PHY'] },
    })

    expect(result).toMatchObject({ status: 'ready' })
    expect(result && result.status === 'ready' && 'anyOf' in result.rule).toBe(false)
  })

  it('deduplicates a subject the model listed twice', () => {
    const result = read({
      confidence: 'low',
      rule: { minCredits: 5, mandatory: ['ENG', 'MTH', 'BIO'], anyOf: [{ subjects: ['CHM', 'CHM', 'PHY'], count: 2, label: 'sciences' }] },
    })

    expect(result).toMatchObject({ rule: { anyOf: [{ subjects: ['CHM', 'PHY'] }] } })
  })

  it('records a low-confidence reading rather than discarding it', () => {
    // The whole point of the confidence field: an uncertain read is still worth
    // storing, because a wrong rule someone can find later beats no rule.
    const result = read({ confidence: 'low', rule })

    expect(result).toMatchObject({ status: 'ready', confidence: 'low' })
  })

  /* --- The three outcomes, which used to be one overloaded null. ----------- */

  it('reports no-source only when the model is sure there is no requirement', () => {
    expect(parseRuleResponse({ confidence: 'high', outcome: 'none', rule: null })).toEqual({
      status: 'no-source',
      rule: null,
      confidence: 'high',
    })
  })

  it('treats a low-confidence "none" as a failed read, not a permanent fact', () => {
    // The bug this exists to stop: a *guess* that a sentence states nothing was
    // stored forever, and the course could never be asked about again. The first
    // live read did exactly that — two of seven group subjects had no code, the
    // model answered "nothing here", and the row said so permanently.
    expect(refusal({ confidence: 'low', outcome: 'none', rule: null })).toBe('model-uncertain')
  })

  it('treats "unreadable" as a failed read, so the programme stays retryable', () => {
    expect(refusal({ confidence: 'high', outcome: 'unreadable', rule: null })).toBe('model-unreadable')
    expect(refusal({ confidence: 'low', outcome: 'unreadable', rule: null })).toBe('model-unreadable')
  })

  it('refuses an outcome of "none" that still carries a rule', () => {
    expect(refusal({ confidence: 'high', outcome: 'none', rule })).toBe('model-uncertain')
  })

  it('refuses an outcome of "rule" that carries no rule', () => {
    expect(refusal({ confidence: 'high', outcome: 'rule', rule: null })).toBe('rule-missing')
  })

  /* --- Subjects the brochure names but we have no code for. ---------------- */

  it('keeps a reading that dropped a choice it could not code, and names it', () => {
    // "any two of Geography, Business Management, Biology" — Business Management
    // has no code. Dropping it makes the group narrower than the brochure, which
    // is the safe direction, and the name is kept so the verdict can say so.
    const result = read({
      confidence: 'high',
      rule: { ...rule, unmapped: ['Business Management'] },
    })

    expect(result).toMatchObject({
      status: 'ready',
      rule: { unmapped: ['Business Management'] },
    })
  })

  it('forces confidence low when a reading had to leave something out', () => {
    // The prompt asks for "low" here; enforcing it means a partial reading is
    // findable later even if the model reports otherwise. That is the only
    // reason confidence is stored at all.
    const result = read({
      confidence: 'high',
      rule: { ...rule, unmapped: ['Data Processing/Computer Studies'] },
    })

    expect(result).toMatchObject({ status: 'ready', confidence: 'low' })
  })

  it('omits unmapped entirely on a complete reading', () => {
    const result = read({ confidence: 'high', rule: { ...rule, unmapped: [] } })

    expect(result && result.status === 'ready' && 'unmapped' in result.rule).toBe(false)
  })

  /* --- The refusals. Each of these would otherwise become a wrong verdict. -- */

  it('refuses a subject code that is not real', () => {
    expect(
      refusal({
        outcome: 'rule',
        confidence: 'high',
        rule: { minCredits: 5, mandatory: ['ENG', 'MTH', 'COMPUTER SCIENCE'] },
      }),
    ).toBe('schema-rejected')
  })

  it('refuses a course that needs more credits than a student can enter', () => {
    expect(
      refusal({ outcome: 'rule', confidence: 'high', rule: { minCredits: 12, mandatory: ['ENG'] } }),
    ).toBe('schema-rejected')
  })

  it('refuses more mandatory subjects than credits', () => {
    // "5 credits including English, Maths, Biology, Chemistry, Physics, Further
    // Maths" cannot be what the sentence meant — six subjects is six credits.
    expect(
      refusal({
        outcome: 'rule',
        confidence: 'high',
        rule: { minCredits: 5, mandatory: ['ENG', 'MTH', 'BIO', 'CHM', 'PHY', 'FMA'] },
      }),
    ).toBe('schema-rejected')
  })

  it('refuses a group whose subjects are all already mandatory', () => {
    // The engine counts a group only over the subjects that are not mandatory,
    // so this group would have nothing left to count and could never be met.
    expect(
      refusal({
        outcome: 'rule',
        confidence: 'high',
        rule: {
          minCredits: 5,
          mandatory: ['ENG', 'MTH', 'BIO'],
          anyOf: [{ subjects: ['BIO', 'ENG'], count: 1, label: 'sciences' }],
        },
      }),
    ).toBe('schema-rejected')
  })

  it('refuses a group asking for more subjects than it offers', () => {
    expect(
      refusal({
        outcome: 'rule',
        confidence: 'high',
        rule: {
          minCredits: 5,
          mandatory: ['ENG', 'MTH', 'BIO'],
          anyOf: [{ subjects: ['CHM'], count: 3, label: 'sciences' }],
        },
      }),
    ).toBe('schema-rejected')
  })

  it('refuses a rule with no mandatory subjects', () => {
    expect(
      refusal({ outcome: 'rule', confidence: 'high', rule: { minCredits: 5, mandatory: [] } }),
    ).toBe('schema-rejected')
  })

  /* --- Malformed replies, which are retryable rather than final. ----------- */

  it('refuses a reply with no usable confidence', () => {
    // Distinct from 'no-source': this read failed, so the programme must stay
    // retryable rather than be marked unreadable forever.
    expect(refusal({ outcome: 'rule', rule })).toBe('malformed-reply')
    expect(refusal({ confidence: 'certain', outcome: 'rule', rule })).toBe('malformed-reply')
  })

  it('refuses a reply with no usable outcome', () => {
    // The whole point of naming the outcome: a reply that does not say which of
    // the three it is cannot be stored as any of them.
    expect(refusal({ confidence: 'high', rule })).toBe('malformed-reply')
    expect(refusal({ confidence: 'high', outcome: 'maybe', rule: null })).toBe('malformed-reply')
  })

  it('refuses anything that is not an object', () => {
    expect(refusal(null)).toBe('malformed-reply')
    expect(refusal('{"confidence":"high"}')).toBe('malformed-reply')
    expect(refusal(undefined)).toBe('malformed-reply')
  })

  it('names the field a rejected reading broke on', () => {
    // The part that makes a reason actionable without re-running the read: this
    // detail is what `yarn rules:read` prints beside the course, and it is the
    // difference between "the model is wrong" and "our validator is".
    const outcome = parseRuleResponse({
      confidence: 'high',
      outcome: 'rule',
      rule: { minCredits: 5, mandatory: ['ENG', 'MTH', 'BIO', 'CHM', 'PHY', 'FMA'] },
    })

    expect(outcome).toMatchObject({
      status: 'failed',
      reason: 'schema-rejected',
      detail: expect.stringContaining('mandatory'),
    })
  })
})

describe('buildRulePrompt', () => {
  const prompt = buildRulePrompt({
    programme: 'ACCOUNTING',
    institution: 'UNIVERSITY OF CALABAR, CALABAR, CROSS RIVER STATE',
    sourceText: 'Five (5) SSC credit passes in English Language, Mathematics, Economics',
  })

  it('carries the sentence it is asking about', () => {
    expect(prompt).toContain('Five (5) SSC credit passes in English Language, Mathematics, Economics')
  })

  it('names the course and the school', () => {
    expect(prompt).toContain('ACCOUNTING')
    expect(prompt).toContain('UNIVERSITY OF CALABAR')
  })

  it('offers the codes the answer is allowed to use', () => {
    expect(prompt).toContain('ECO = Economics')
    expect(prompt).toContain('ENG = English Language')
  })

  it('tells the model that only A1-C6 counts', () => {
    expect(prompt).toContain('Only A1 to C6 is a credit')
  })

  it('separates "no requirement here" from "I could not read this"', () => {
    // These two used to be the same answer — `"rule": null` — and that is what
    // made a sentence the model merely found awkward get stored as a permanent
    // "nothing to read here". The prompt has to keep them apart.
    expect(prompt).toContain('"none" — the sentence states no O\'level credit requirement')
    expect(prompt).toContain('"unreadable" — the sentence states a requirement you cannot return')
    expect(prompt).toContain('a requirement you could not finish reading is "unreadable",')
  })

  it('says what to do with a subject that has no code', () => {
    // 2489 of the 21096 programmes in the mirror name at least one. The rule
    // differs by where the subject appears, and the prompt has to say so.
    expect(prompt).toContain('Business Management')
    expect(prompt).toContain('Return "unreadable"')
    expect(prompt).toContain('list its name in `unmapped`')
  })

  it('tells the model never to invent a code or guess from the name', () => {
    expect(prompt).toContain('Never invent a subject code, and never guess a requirement from the course')
  })
})
