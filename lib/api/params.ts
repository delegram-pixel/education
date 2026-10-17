/**
 * Query-parameter parsing for the list endpoints.
 *
 * Every list endpoint accepts the same `limit` / `cursor` pair and a subset of
 * the same filters, so the parsing lives here rather than five times over. What
 * a client sends is a string; what a reader needs is a number and some trimmed
 * strings or nothing at all. That translation is the whole job, and keeping it
 * in one place is what stops `?state=` meaning "no filter" on one endpoint and
 * "the empty state" on another.
 */

import { SUBJECT_CODES, type SubjectCode } from '@/lib/types'

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './contract'
import { decodeCursor } from './paging'

export type ParamResult<T> = { ok: true; value: T } | { ok: false; message: string }

export type ListParams = {
  limit: number
  offset: number
  /** Free text, trimmed. Empty string when absent — never null. */
  q: string
  state?: string
  type?: string
  category?: string
  institutionId?: string
  /** A subject code this catalogue publishes. An unknown one is refused. */
  subject?: SubjectCode
}

/** One parameter's value, or undefined if absent or blank. */
function filter(params: URLSearchParams, name: string): string | undefined {
  const value = params.get(name)?.trim()
  return value || undefined
}

/**
 * A page size a client asked for.
 *
 * Out of range is clamped, a non-number is refused. The distinction is which
 * mistake the client made: `limit=1000` is a reasonable request for more than we
 * serve, and answering it with the most we will give is more useful than an
 * error; `limit=lots` is a bug in their code that would otherwise be silently
 * answered with 25 and leave them wondering why paging never ends.
 */
function pageSize(params: URLSearchParams): ParamResult<number> {
  const raw = params.get('limit')?.trim()
  if (!raw) return { ok: true, value: DEFAULT_PAGE_SIZE }

  if (!/^\d+$/.test(raw)) {
    return { ok: false, message: '`limit` must be a whole number.' }
  }

  return { ok: true, value: Math.min(Math.max(Number(raw), 1), MAX_PAGE_SIZE) }
}

/**
 * Position, from the cursor.
 *
 * An absent cursor is the first page. A present but unreadable one is refused
 * with the decoder's own reason — see `decodeCursor`, which explains why it is
 * not silently treated as the first page.
 */
function position(params: URLSearchParams): ParamResult<number> {
  const raw = params.get('cursor')?.trim()
  if (!raw) return { ok: true, value: 0 }

  const decoded = decodeCursor(raw)
  return decoded.ok ? { ok: true, value: decoded.offset } : { ok: false, message: decoded.reason }
}

/**
 * A subject code, checked against the vocabulary this API publishes.
 *
 * Refused rather than passed through, because the two failures are different.
 * `?subject=BIO` is a real code and a real question; `?subject=biology` is a
 * client that skipped `/subjects`, and answering it with an empty list would
 * look to them like a catalogue with no Biology in it. The message names the
 * endpoint that holds the codes, so the fix is one request away.
 */
function subjectCode(params: URLSearchParams): ParamResult<SubjectCode | undefined> {
  const raw = filter(params, 'subject')
  if (!raw) return { ok: true, value: undefined }

  const code = raw.toUpperCase()
  if (!(SUBJECT_CODES as string[]).includes(code)) {
    return {
      ok: false,
      message: `\`${raw}\` is not a subject code this catalogue uses. \`GET /subjects\` lists them — they are codes like \`BIO\`, not names.`,
    }
  }

  return { ok: true, value: code as SubjectCode }
}

export function parseListParams(params: URLSearchParams): ParamResult<ListParams> {
  const size = pageSize(params)
  if (!size.ok) return size

  const cursor = position(params)
  if (!cursor.ok) return cursor

  const subject = subjectCode(params)
  if (!subject.ok) return subject

  return {
    ok: true,
    value: {
      limit: size.value,
      offset: cursor.value,
      q: params.get('q')?.trim() ?? '',
      state: filter(params, 'state'),
      type: filter(params, 'type'),
      category: filter(params, 'category'),
      institutionId: filter(params, 'institutionId'),
      subject: subject.value,
    },
  }
}
