/**
 * Cursor pagination over a page of already-read rows.
 *
 * The cursor is an opaque base64url token, not a numbered `page` parameter, and
 * the reason is that a page number invites a client to build one — `?page=2`
 * looks like arithmetic they can do themselves, and the moment they do, changing
 * how paging works underneath becomes a breaking change. An opaque token can be
 * redefined later without touching their code.
 *
 * It is opaque, NOT secret and NOT signed: it carries an offset into a public
 * catalogue, so a client that decodes it learns nothing they could not already
 * fetch. The `v` field is there so a future cursor shape can be told apart from
 * this one rather than misread as one.
 */

/** The only cursor shape version 1 knows about. */
const CURSOR_VERSION = 1

export type Page<T> = {
  page: T[]
  /** Null on the last page — the signal to stop, rather than an empty page. */
  nextCursor: string | null
  /** Rows matched across every page, not just this one. */
  total: number
}

export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ v: CURSOR_VERSION, o: offset }), 'utf8').toString('base64url')
}

export type CursorResult = { ok: true; offset: number } | { ok: false; reason: string }

/**
 * Read a cursor a client passed back.
 *
 * Every failure mode is a `bad_request` rather than a silent restart from the
 * beginning. A client whose cursor is unreadable has a bug or is holding a token
 * from a different API version, and quietly serving them page one again would
 * look to them like an infinite list rather than a mistake.
 */
export function decodeCursor(raw: string): CursorResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
  } catch {
    return { ok: false, reason: 'The cursor is not a cursor this API issued.' }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, reason: 'The cursor is not a cursor this API issued.' }
  }

  const { v, o } = parsed as { v?: unknown; o?: unknown }

  if (v !== CURSOR_VERSION) {
    return {
      ok: false,
      reason: `The cursor was issued by a different version of this API. Omit \`cursor\` to start again.`,
    }
  }

  if (typeof o !== 'number' || !Number.isSafeInteger(o) || o < 0) {
    return { ok: false, reason: 'The cursor is not a cursor this API issued.' }
  }

  return { ok: true, offset: o }
}

/**
 * The cursor for the page after this one, or null at the end.
 *
 * Split out because there are two ways to reach a page here and both must
 * compute this the same way. `paginate` slices a set it holds, so it knows how
 * many rows there are; SQL-paged readers hand back a page and a `total` and never
 * hold the rest. One implementation means the two cannot disagree about when a
 * list has ended — which a client experiences as either a page fetched for
 * nothing or a page it never knows to ask for.
 */
export function cursorFor(offset: number, returned: number, total: number): string | null {
  const next = offset + returned
  return next < total ? encodeCursor(next) : null
}

/**
 * Take one page off a fully-read result set.
 *
 * `rows` is expected to be in the endpoint's documented order — the catalogue
 * readers sort by institution then programme — because a cursor that encodes a
 * position is only meaningful against a stable order. Slicing happens here
 * rather than in the caller so `total` and `nextCursor` are computed in one
 * place and cannot disagree with the page they describe.
 */
export function paginate<T>(rows: T[], offset: number, limit: number): Page<T> {
  const page = rows.slice(offset, offset + limit)

  return {
    page,
    // Null when this page reached the end. Returning a cursor for an empty page
    // would make a client fetch one more time to learn what it already knows.
    nextCursor: cursorFor(offset, page.length, rows.length),
    total: rows.length,
  }
}
