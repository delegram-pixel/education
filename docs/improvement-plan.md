# Improvement Plan — Admission Copilot

Version 1 · 19 October 2026

This document collects the changes worth making to the application and to the
Catalogue API (`/api/v1`). It is ordered by risk first, then by the value a
student or an integrator gets. Every item names the file that owns the current
behaviour, so it can be picked up without re-discovering the code.

Priority key:

- **P0** — fix before real traffic. Cost, abuse, privacy, or a likely outage.
- **P1** — next iteration. The things that make the product dependable.
- **P2** — growth and product quality.
- **P3** — later, or only when a partner asks.

Effort is a rough size, not an estimate: **S** (hours), **M** (a day or two),
**L** (a week or more).

---

## 1. Where the code stands

These are genuinely good and should not be disturbed while making the changes
below:

- The eligibility engine and the rule parser are pure, exhaustively tested, and
  deliberately refuse to repair a half-read requirement
  ([`../lib/eligibility/engine.ts`](../lib/eligibility/engine.ts),
  [`../lib/rules/reader.ts`](../lib/rules/reader.ts)).
- "No database" and "no model key" are first-class states with static
  fallbacks, not error paths
  ([`../lib/db/index.ts`](../lib/db/index.ts),
  [`../lib/db/rules.ts`](../lib/db/rules.ts)).
- The API has one envelope, one error shape, cursor pagination with a real
  `total`, constant-time key auth, and an OpenAPI document generated from the
  same contract the handlers enforce ([`../lib/api/contract.ts`](../lib/api/contract.ts)).
- Reduced-motion handling and a skip link are already in place
  ([`../components/shared/reveal.tsx`](../components/shared/reveal.tsx),
  [`../app/layout.tsx`](../app/layout.tsx)).

---

## 2. Cost, abuse and privacy (P0)

### 2.1 Rate-limit the Server Actions, especially the rule reader

- [x] **P0 · M** Add a limiter to `readCourseRule` and the other actions.

Every `'use server'` export is a public HTTP endpoint reachable by anyone who
can load the app. There is no rate limiting in the app layer today — the only
limiter in the repository belongs to `/api/v1`
([`../lib/api/rate-limit.ts`](../lib/api/rate-limit.ts)).

`readCourseRule` is the dangerous one: a cache miss calls Groq
([`../app/schools/actions.ts`](../app/schools/actions.ts),
[`../lib/db/rules.ts`](../lib/db/rules.ts)). An attacker who walks programme ids
can turn that into one model call per id, and a *failing* read is deliberately
not stored ([`../lib/db/rules.ts:250-263`](../lib/db/rules.ts#L250-L263)), so the
same id can be made to call again.

Suggested shape, cheapest first:

1. **Global daily budget.** A small Postgres counter (one row per day) that is
   incremented only on a *fresh* read. That bounds total spend regardless of how
   many serverless instances exist. This is the backstop that matters; per-
   instance counters cannot bound a bill.
2. **Per-session limits.** e.g. 1 fresh read per programme per 10 minutes, and
   20 fresh reads per hour per session. Reject with an honest "we have not
   reviewed this yet" panel rather than an error.
3. **Negative backoff.** Remember failures for a short window (in-process is
   enough) so one bad programme cannot be hammered.
4. `submitTicket`, `runCheck`, `savePersona` and `discoverCourses` need a much
   looser per-session limit — enough to stop a loop, not a student.

Keep the existing `inFlight` dedupe: it stops concurrent duplicate calls on one
instance but does not replace a limiter.

**Implemented:** per-session limits and a short negative backoff live in
`lib/action-limits.ts`; the shared daily counter is `model_call_budget` in
`lib/db/schema.ts` and is claimed atomically in `lib/db/budget.ts`. The ceiling
is `GROQ_DAILY_CALL_LIMIT` (default 200). Run `yarn db:push` so the table exists;
the counter fails closed if it cannot be written.

### 2.2 Tickets are readable by anyone holding the URL

- [x] **P0 · S** Enforce session ownership on `/tickets/[id]`.

`findTicket(id)` looks up by id alone and the page renders the thread
([`../lib/db/queries.ts:259`](../lib/db/queries.ts#L259),
[`../app/tickets/[id]/page.tsx`](../app/tickets/[id]/page.tsx)). Ticket ids are
`AC-` plus five random characters — chosen to be speakable, which also means
enumerable with enough attempts
([`../lib/utils.ts:14`](../lib/utils.ts#L14),
[`../lib/db/schema.ts:192`](../lib/db/schema.ts#L192)).

The fix is small: compare `ticket.sessionId` with the current session and
`notFound()` on mismatch. Keep the short id for reading aloud; it is still the
right id for a counselor. Also add `robots: { index: false }` to this page's
metadata (the shared-result page already does it).

### 2.3 Retention and deletion

- [x] **P0 · M** Define and enforce a retention policy for student data.

`eligibility_checks`, `persona_results`, `tickets` and `ticket_messages` hold
O'level results and free text, tied to an anonymous cookie
([`../lib/db/schema.ts:161-228`](../lib/db/schema.ts#L161-L228)). Nothing expires
them today, and there is no "delete my data" path.

- Store a `retain_until` (or compute from `created_at`) and add a scheduled
  prune. Suggested: 90 days for checks and persona results, 1 year for tickets.
- Add a `DELETE /api/me`-style server action that deletes by session id, and
  surface it on the site.
- Publish the retention periods in a privacy page. Do not log grades or ticket
  bodies.
- Give shared result links an expiry; keep the existing `noindex`
  ([`../app/r/[id]/page.tsx:11`](../app/r/[id]/page.tsx#L11)).

**Implemented:** periods live in `lib/retention.ts`; `yarn data:prune` deletes
old rows; `/privacy` publishes the periods and deletes everything for the
current browser session. Schedule the prune job on the platform — the script is
the enforcement, not the policy alone.

### 2.4 The Swift knowledge route is public and expensive

- [x] **P0 · S** Decide whether it stays public.
  Decision: it stays public, with a per-IP rate limit in the route and the existing hour cache.

`GET /api/swift/knowledge` renders the whole institution list and up to 500
programmes with prose, then caches for an hour
([`../app/api/swift/knowledge/route.ts`](../app/api/swift/knowledge/route.ts)).
It is the most expensive read in the app and has no key. If it only exists to
produce an upload for Swift, pre-generate the file during the catalogue sync and
serve the static artefact, or require a token. If it must stay public, rate-limit
it at the edge.

---

## 3. Reliability and performance (P1)

### 3.1 Cache the catalogue reads

- [ ] **P1 · M** Add a small, explicit cache layer for slow-moving data.

There is no caching at the data layer. `SwiftRuntime` awaits `connection()` in
the root layout ([`../components/swift/swift-runtime.tsx`](../components/swift/swift-runtime.tsx)),
which opts every route into dynamic rendering, so this is paid on every request:

- `listCourses()` reads the courses table on every page and every programme
  listing ([`../lib/db/queries.ts:43`](../lib/db/queries.ts#L43)).
- `catalogueStats()` runs three counts per `/meta` request
  ([`../lib/db/catalogue.ts:734`](../lib/db/catalogue.ts#L734)).
- `listInstitutions()` groups the whole table on every `/schools` view
  ([`../lib/db/catalogue.ts:631`](../lib/db/catalogue.ts#L631)).
- `resolveReviewedCourses` rebuilds the reviewed-course index per call
  ([`../lib/db/catalogue.ts:707`](../lib/db/catalogue.ts#L707)).

Use `unstable_cache`/`revalidateTag` with a `catalogue` tag, or a small in-process
TTL (30–60s). Invalidate the tag from the sync script. Courses can be cached for
the life of the instance; the catalogue can be cached for a minute because it
only moves on sync. No new dependency is needed.

### 3.2 Discovery reads the whole catalogue per search

- [ ] **P1 · L** Move subject matching into SQL.

`searchProgrammes` calls `listSwiftKnowledgeProgrammes()` with no limit and
filters in memory ([`../lib/db/discovery.ts:30`](../lib/db/discovery.ts#L30),
[`../lib/db/catalogue.ts:416`](../lib/db/catalogue.ts#L416)). Every subject
search transfers the national catalogue (21k+ rows) to answer with twelve
results.

The clean fix is also the fix for the API's `subject` filter: during import,
normalise the published UTME labels to subject codes in a new `utme_codes
text[]` column, add a GIN index, and query with array overlap (`&&`). Keep the
original label array for display. If that is too much now, cache the whole
programme document in-process for a few minutes as an interim step.

### 3.3 Database migrations

- [ ] **P1 · S** Commit migrations instead of relying on `db:push`.

There is no `drizzle/` directory; `db:push` applies the schema directly
([`../package.json`](../package.json)). Add `drizzle-kit generate` output to the
repository and a `db:migrate` script, and use `push` only for local work. This
is also where the new indexes below belong.

Indexes worth adding in the same migration:

- `catalogue_programmes.source_updated_at` — needed for incremental API sync.
- `catalogue_institutions.state` (or a lower-cased expression index) — filters.
- `utme_codes` GIN — discovery and `?subject=`.
- `eligibility_checks.created_at`, `persona_results.created_at` — retention
  pruning. (`checks_session_idx` already exists.)

Only `catalogue_programmes.institution_id` is indexed today
([`../lib/db/schema.ts:88`](../lib/db/schema.ts#L88)).

### 3.4 Error reporting and structured logs

- [ ] **P1 · M** Make production failures visible.

Today failures are `console.warn`/`console.error` only
([`../lib/db/index.ts:60`](../lib/db/index.ts#L60),
[`../app/error.tsx`](../app/error.tsx)). Add:

- structured JSON logs on stdout for `source: 'sample'` fallbacks, failed rule
  reads, DB timeouts and server-action rejections — the platform can collect
  these without adding a runtime dependency;
- an alert on those logs when the sample fallback serves production traffic,
  because that means the mirror or the database is down;
- a hosted error reporter (Sentry or equivalent) wired into `app/error.tsx` and
  `app/global-error.tsx` (the latter does not exist yet) only if adding a client
  library is acceptable; it is a runtime dependency, and the logs above cover
  most of the value without one.

### 3.5 Health check and uptime monitoring

- [ ] **P1 · S** Add `GET /api/health`.

Return a cheap `SELECT 1`, whether `DATABASE_URL`/`GROQ_API_KEY` are configured,
and the age of the last successful sync. Do not count 21k rows, and do not
require an API key. Point the uptime monitor at it.

### 3.6 Precompute the Swift knowledge document

- [ ] **P1 · S** Generate it at sync time.

The route builds the document on demand and relies on the CDN for the hour
between requests. Pre-generating it during `catalogue:sync` (and keeping the
route as a thin reader of that artefact) removes the expensive cold path and
makes the uploaded file's age explicit.

---

## 4. Security and configuration (P0/P1)

### 4.1 Security headers and CSP

- [x] **P0 · M** Add headers in `next.config.ts`.

There are no security headers today ([`../next.config.ts`](../next.config.ts)).
Add `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'`, and set
`poweredByHeader: false`.

A Content-Security-Policy is the important one, because the session cookie is
deliberately readable by JavaScript (`httpOnly: false`,
[`../lib/session.ts:36`](../lib/session.ts#L36)) so a shared result can be
recognised as one's own. Stage it: ship `Content-Security-Policy-Report-Only`
first, allow the Swift widget's origin and the inline theme script, then
enforce. Once CSP is in place, consider `httpOnly: true` plus a server-side
ownership check for the "this is my result" case.

### 4.2 Validate configuration at startup

- [x] **P0 · S** Add an env schema and a `.env.example`.

Environment variables are read ad hoc at their call sites. Add one module that
parses them with `zod`, fails loudly on a malformed value, and documents which
are optional. Export a matching `.env.example` (the README block is a good
starting point). Keep every secret server-side; no `NEXT_PUBLIC_` prefix.

### 4.3 Pick one package manager

- [ ] **P1 · S** Remove the duplicate lockfile.

Both `package-lock.json` and `yarn.lock` are committed, while the README
documents `yarn`. Choose one, delete the other, and make CI install with
`--frozen-lockfile` from the surviving file. Divergent installs are a slow,
confusing class of bug.

---

## 5. Testing and engineering process (P1)

### 5.1 CI

- [ ] **P1 · S** Add a GitHub Actions workflow.

There is no `.github/` directory. On every pull request run:

1. `yarn typecheck`
2. `yarn test`
3. `yarn build` (catches route and server/client boundary errors)
4. OpenAPI lint on the generated document
   (`npx @redocly/cli lint`), which the API docs already recommend to
   integrators but nothing enforces;
5. a dependency audit.

### 5.2 Test the parts students actually touch

- [ ] **P1 · M** Add component and end-to-end coverage.

Vitest is configured for `lib/**/*.test.ts` only
([`../vitest.config.ts`](../vitest.config.ts)). The pure engine is well covered;
the flows are not. Add:

- component tests for `check-flow`, `olevel-form`, `school-browser` and
  `ticket-form` (Testing Library + jsdom — dev dependencies only);
- one Playwright journey: home → check → result → share link, and
  schools → programme → check;
- route-handler integration tests for `/api/v1` against a test server, not only
  the unit tests that exist today;
- an automated accessibility check (axe) on the four main pages.

### 5.3 Error boundaries and loading states

- [ ] **P1 · S** Complete the App Router shell.

Add `app/global-error.tsx` (the root layout has no fallback if the layout itself
throws), and `loading.tsx` for `/schools`, `/tickets`, `/quiz` and `/docs`.
`/check` and `/guide` already have them.

---

## 6. Product and growth (P2)

### 6.1 Indexable institution and programme pages

- [ ] **P2 · L** Add SEO landing pages.

Students search "UNILAG nursing requirements", and today only `/`, `/check`,
`/schools` and `/guide` are indexable. Add server-rendered routes such as
`/schools/[institution]` and `/schools/[institution]/[programme]` that quote the
brochure with its source URL and link into the checker where a reviewed course
exists. This is likely the largest organic-acquisition lever in the product.

Supporting work:

- `metadataBase` and OpenGraph/Twitter metadata in
  [`../app/layout.tsx`](../app/layout.tsx);
- `app/robots.ts` and `app/sitemap.ts`; exclude `/tickets`, `/r`, `/api`;
- JSON-LD for `EducationalOrganization`/`WebPage` — not `Course`, and never a
  claim of availability or eligibility;
- keep the disclaimer on every generated page;
- mark pages `noindex` while `source === 'sample'`, because a degraded catalogue
  should not become the canonical record for a school.

### 6.2 Privacy-safe analytics

- [ ] **P2 · M** Measure the funnel.

There is no analytics. Add events that contain no grades and no free text:
`check_started`, `check_completed` (verdict bucket only), `discovery_searched`
(subject count), `rule_read_wait_ms`, `ticket_created`, `guide_step_viewed`,
`swift_opened`. A small Postgres events table is enough and avoids a third-party
processor; if a third party is used, get consent first.

### 6.3 Make the support handoff real

- [ ] **P2 · M** Notify a human.

The counselor's reply is currently a scripted string
([`../app/tickets/actions.ts:39`](../app/tickets/actions.ts#L39)). That is fine
for a demo and misleading in production. Add ticket notification (email or a
team channel), assignment and an SLA, and remove the simulation from the live
path.

### 6.4 Rule-review queue

- [ ] **P2 · M** Review what the model read.

Rules are stored with a confidence and a source hash
([`../lib/db/schema.ts:101`](../lib/db/schema.ts#L101)). Failures are logged but
not stored, and low-confidence reads are served like any other. Build a small
internal queue for low-confidence, `no-source`, and repeated-failure programmes,
and let a human confirm or override a rule with recorded provenance. Add a
one-click "this verdict is wrong" path from the verdict card into the existing
`eligibility_dispute` ticket category.

### 6.5 Clarify the language selector

- [ ] **P2 · S** Set expectations, or localise.

The selector currently changes only the instruction sent to Swift
([`../components/shared/language-preference.tsx`](../components/shared/language-preference.tsx)).
The label "Preferred language" implies the whole UI will translate. Either
localise the UI strings or label it "Language for the assistant" so the
behaviour is not surprising.

### 6.6 Accessibility audit

- [ ] **P2 · M** Audit and test.

The foundations are good (skip link, semantic `main`, reduced-motion handling,
Radix primitives). Verify focus order in dialogs, error announcement in forms,
colour contrast in both themes, and keyboard access in `school-combobox`. Wire
the axe check from §5.2 into CI so it stays true.

### 6.7 Optional: offline resilience

- [ ] **P3 · M** Consider a service worker.

The audience is on mobile networks. Caching `/guide/*` and the last completed
check would make the app usable when the network drops. Do not cache live
catalogue reads without a freshness label.

---

## 7. Catalogue API (v1)

The API surface is in good shape. The gaps are mostly in what an integrator
mirroring the catalogue needs, plus a few ergonomics. Full detail remains in
[`catalogue-api.md`](catalogue-api.md).

### 7.1 Fix change semantics before adding `updatedSince` (P0/P1 · M)

The sync writes every row with the same run timestamp and never prunes rows that
left IBASS ([`../scripts/sync-ibass-catalogue.ts:224`](../scripts/sync-ibass-catalogue.ts#L224),
[`:454`](../scripts/sync-ibass-catalogue.ts#L454),
[`:522`](../scripts/sync-ibass-catalogue.ts#L522)). `sourceUpdatedAt` therefore
means "when the importer last wrote this row", not "when this row changed".

1. Leave `sourceUpdatedAt` unchanged when the content is identical.
2. Record removals in a `catalogue_deletions` table (or soft-delete with
   `deleted_at`).
3. Add `updatedSince` to `/institutions` and `/programmes`, and a `deletedSince`
   signal; index `source_updated_at`.
4. Consider `GET /changes?since=` to return both in one walk.

Without step 1, `updatedSince` would return the entire catalogue after every
sync. A mirroring client currently re-walks ~214 pages for 21k programmes
(about four minutes per sync at 60 req/min).

### 7.2 Batch lookup (P1 · S)

`GET /programmes?ids=a,b,c`, capped at ~20–50. A shortlist of fifteen
programmes is currently fifteen requests against a 60/min limit.

### 7.3 Facets (P1 · S)

`GET /facets`, or `?facets=true`, returning states, types and categories with
counts. `institutionFacets()` already exists and is filter-aware
([`../lib/institutions.ts:276`](../lib/institutions.ts#L276)). Today a client
pages all 466 institutions to build a filter dropdown.

### 7.4 Filter ergonomics (P1 · S)

- Multi-value filters: `state=Lagos,Oyo`, `category=University,Polytechnic`,
  `institutionId=a,b`. [`filter()`](../lib/api/params.ts#L33) currently uses
  `URLSearchParams.get()`, so only the first value is seen.
- `sort=name|updated` on programmes.
- `error.param` on `bad_request`, and a length cap on `q` (e.g. 200 chars).
- Decide what unknown query parameters do; they are silently ignored today.

### 7.5 HTTP correctness (P1 · S)

- `ETag` + `If-None-Match` → `304` for `/meta`, `/institutions` and `/subjects`.
  The catalogue only moves on sync.
- `Vary: Authorization, x-api-key` on every response, since responses are
  key-gated.
- `X-API-Version` on errors too; today the version exists only in `meta`.

### 7.6 Caching and payload (P1 · S)

- `checkerUrl` on programme summaries, not only detail
  ([`../lib/api/views.ts:209`](../lib/api/views.ts#L209)); thread `baseUrl` into
  `programmeSummary`.
- Cache the counts behind `/meta` and the reviewed-course index; both are
  recomputed per request today.
- If a partner mirrors the whole catalogue, add a streamed NDJSON export rather
  than expecting 214 paged requests.

### 7.7 Operations (P1/P2 · M)

- Structured request logs: `keyId`, path, status, duration, `source`.
- Per-key usage and last-seen, so abuse and adoption are visible.
- `X-Request-Id` on responses for support.
- Move keys from `CATALOGUE_API_KEYS` to an `api_keys` table when there is more
  than one integrator: hash, label, `revoked_at`, `last_used_at`, optional
  per-key limit. Revocation is a redeploy today
  ([`../lib/api/auth.ts:54`](../lib/api/auth.ts#L54)).
- The in-memory rate limiter is honestly documented as a runaway guard
  ([`../lib/api/rate-limit.ts`](../lib/api/rate-limit.ts)). Replace it with
  shared state only if you promise a quota; prefer platform or Postgres over a
  new runtime dependency.

### 7.8 Not worth adding yet (P3)

- CORS/`OPTIONS` — the docs correctly say server-side only.
- Sparse fieldsets (`fields=`) — low value at this payload size.
- A verdict endpoint — deliberately out of scope; link into the checker instead.

---

## 8. Suggested sequence

### Phase 0 — before real traffic (this week)

1. Rate-limit server actions and put a global daily budget on Groq (§2.1).
2. Enforce ticket ownership and add `noindex` (§2.2).
3. Decide the fate of the public knowledge route (§2.4).
4. Security headers, starting with the non-CSP set (§4.1).
5. Env validation, `.env.example`, one lockfile (§4.2, §4.3).
6. CI: typecheck, tests, build, OpenAPI lint (§5.1).

### Phase 1 — dependable (next 2–3 weeks)

1. Retention policy and delete path (§2.3).
2. Catalogue cache and course-index cache (§3.1).
3. Migrations plus the new indexes (§3.3).
4. Error reporting, structured logs, health check (§3.4, §3.5).
5. API change semantics, `updatedSince`, deletions, batch lookup and facets
   (§7.1–§7.3).

### Phase 2 — growth (weeks 4–8)

1. Discovery matching in SQL, with normalised `utme_codes` (§3.2).
2. SEO landing pages, sitemap, OG metadata (§6.1).
3. Privacy-safe funnel analytics (§6.2).
4. Component/E2E tests and axe in CI (§5.2).
5. Rule-review queue and a real support handoff (§6.3, §6.4).

### Phase 3 — only when the need is real

1. Bulk NDJSON export, shared rate limiting, CORS, PWA/offline, UI
   localisation (§7.6–§7.8, §6.5, §6.7).

---

## 9. How we will know it worked

| Measure | Target |
| --- | --- |
| Groq model calls per day | Bounded, and visible on a dashboard |
| Fresh rule reads | p95 under 10s; failure rate under 5% |
| Catalogue source in production | `sample` rate at or near zero, and alerted |
| App read latency | p95 stable after caching; no per-request full-table reads |
| Check funnel | `check_started` → `check_completed` measured and improving |
| Tickets | First human response measured; no unowned ticket older than the SLA |
| API | 429 rate low; `source=sample` ratio low; sync duration recorded |
| CI | Every PR green on typecheck, tests, build and OpenAPI lint |
| Documentation | `docs/catalogue-api.md`, `/docs/catalogue-api` and the OpenAPI document agree |

---

## 10. Open questions

1. Is `/api/swift/knowledge` meant to be public, or is it only an upload
   artefact? The answer decides §2.4.
2. Do tickets need to survive the MVP as a real support channel, or are they a
   demonstration? The answer decides §6.3 and the retention period.
3. How much are we willing to spend on Groq per month? A number turns §2.1 from
   a policy into a configuration value.
4. Should the catalogue's institution and programme pages be public and
   indexable, given they quote IBASS verbatim? If yes, §6.1 is the highest-value
   item in this document.
