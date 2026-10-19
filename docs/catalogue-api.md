# Admission Copilot — Catalogue API v1

Version 1 · 18 October 2026

> Live version: `/docs/catalogue-api` on the app. This file is a snapshot; when
> the two disagree, the page is what the API does.

A read-only JSON API over the Nigerian admissions catalogue behind Admission
Copilot: institutions, their programmes, the UTME subject combinations and
requirement prose JAMB's IBASS e-brochure publishes, and the subject and grade
vocabulary this catalogue uses.

Everything here is already public; the API holds no student data and has no route
that reads any.

Base URL:

```
https://<your-domain>/api/v1
```

OpenAPI 3.1 document: `GET /api/v1/openapi.json` — generate a client from it
rather than transcribing this page.

---

## What this API is not

**It returns no verdict.** There is no endpoint that takes a student's grades and
answers "eligible" or "not eligible". Requirements are returned as the brochure's
own words, quoted, with the URL they came from — never as a decision.

Where Admission Copilot's checker holds a reviewed course for a programme, the
programme carries a `checkerUrl` pointing into it. That is the link to hand a
student. Automated eligibility decisions are produced only by the in-app checker,
because only it can say which rule set it decided from.

Two consequences worth building around:

- Do not compute eligibility from `olevelRequirements`. It is prose, in the
  brochure's words, and it changes between sessions.
- Do not treat a programme's absence as evidence. A filtered page is a page; read
  `pagination.total` before saying anything about the whole catalogue.

---

## Authentication

Every request needs a key. Send it either way:

```
Authorization: Bearer <your-key>
x-api-key: <your-key>
```

`Authorization` wins if both are present. Keys are issued by Admission Copilot —
ask for one; they are not self-service.

A missing or wrong key is `401 unauthorized`. If the server has no keys
configured at all it answers `503 unavailable` instead, which is a fault on our
side rather than a problem with your key.

The key is server-side. Do not put it in a browser bundle, a mobile app, or a
public repository — anything a user can read is a key given away.

---

## The envelope

Every successful response is the same shape:

```json
{
  "data": [],
  "pagination": { "limit": 25, "nextCursor": "eyJ2IjoxLCJvIjoyNX0", "total": 3412 },
  "meta": {
    "source": "ibass",
    "generatedAt": "2026-10-15T09:12:44.108Z",
    "apiVersion": "1",
    "disclaimer": "Catalogue presence is not an offer of admission, ..."
  }
}
```

Every failure is the same shape:

```json
{ "error": { "code": "not_found", "message": "No programme in the catalogue has the id `59:9999`." } }
```

One unwrapper and one error handler covers the whole API.

### `meta.source`

| Value | Meaning |
|---|---|
| `ibass` | The JAMB IBASS mirror answered. This is the full catalogue. |
| `sample` | The mirror was unreachable and a small built-in sample answered instead. **A degraded read.** Fewer institutions than the national catalogue, and not representative. Do not present it as the catalogue. |
| `built-in` | The answer did not come from the catalogue at all — the subject and grade vocabulary is compiled into the app. Appears on `/subjects` and `/openapi.json` only. |

`sample` is not an error: the request succeeded, and the data is real. It is a
statement about coverage.

### `meta.disclaimer`

A fixed sentence, carried on every response so you never have to compose your own:

> Catalogue presence is not an offer of admission, and a programme count is what
> this catalogue holds rather than what an institution offers. Requirements, fees
> and deadlines change each session — verify them in the current JAMB IBASS record
> and the institution's own bulletin.

Render it where you display catalogue data.

---

## Pagination

Every list endpoint takes `limit` and `cursor`.

| Parameter | Default | Range |
|---|---|---|
| `limit` | 25 | 1–100 |
| `cursor` | — | `pagination.nextCursor` from the previous page |

`limit` is **clamped, not refused**: `limit=1000` returns 100 and says so in
`pagination.limit`. `limit=lots` is a `400`, because a non-numeric limit is a bug
in your code and answering it with 25 would leave you wondering why paging never
ends.

`cursor` is opaque. Pass back exactly what you were given; do not construct one,
parse one, or increment anything inside it. `nextCursor` is `null` on the last
page — that is the signal to stop, not an empty page.

`pagination.total` is the number of rows matching your filters **across every
page**. It is the only thing that distinguishes "these are all the schools in
Lagos" from "these are the first 25 of 62".

Walking the whole catalogue:

```bash
cursor=''
while :; do
  page=$(curl -s -H "Authorization: Bearer $KEY" \
    "https://<your-domain>/api/v1/programmes?limit=100&cursor=$cursor")
  echo "$page" | jq -r '.data[].id'
  cursor=$(echo "$page" | jq -r '.pagination.nextCursor')
  [ "$cursor" = "null" ] && break
done
```

---

## Endpoints

### `GET /meta`

Which catalogue answered, how large it is, and how fresh.

```json
{
  "data": {
    "institutions": 466,
    "programmes": 21384,
    "lastUpdatedAt": "2026-10-13T02:00:11.000Z",
    "disclaimer": "Catalogue presence is not an offer of admission, ..."
  },
  "meta": { "source": "ibass", ... }
}
```

`lastUpdatedAt` is when the mirror was last taken from IBASS — not when this
response was built (`meta.generatedAt` is that) and not when any requirement was
last reviewed. It is `null` on the sample path.

Use it to size your copy: "3,412 programmes across 466 institutions" is a better
sentence than implying your first page is everything.

---

### `GET /institutions`

Institutions in the catalogue, with how many programmes each currently lists.

| Parameter | Description |
|---|---|
| `state` | State name, e.g. `Lagos`. Case-insensitive. |
| `type` | Institution type, e.g. `Federal University`. Case-insensitive. |
| `category` | `University`, `Polytechnic`, `College of Education` and similar. Case-insensitive. |
| `q` | Free text over the name, the state and the institution type. |
| `limit`, `cursor` | See [Pagination](#pagination) |

```bash
curl -s -H "Authorization: Bearer $KEY" \
  'https://<your-domain>/api/v1/institutions?state=Lagos&limit=3'
```

```json
{
  "data": [
    {
      "id": "<institution-id>",
      "name": "UNIVERSITY OF LAGOS, AKOKA, LAGOS STATE",
      "shortName": "UNIVERSITY OF LAGOS",
      "type": "Federal University",
      "category": "University",
      "state": "Lagos",
      "programmeCount": 62,
      "sourceUrl": "https://ibass.jamb.gov.ng/brochure-by-institution",
      "sourceUpdatedAt": "2026-10-13T02:00:11.000Z"
    }
  ],
  "pagination": { "limit": 3, "nextCursor": "eyJ2IjoxLCJvIjozfQ", "total": 12 },
  "meta": { "source": "ibass", ... }
}
```

- `id` is JAMB's own identifier and is stable across a re-import. Hold it.
- `name` is what the brochure prints — often `NAME, CITY, STATE`. `shortName` is
  the same institution as a sentence refers to it; use that when composing prose,
  because "does UNIVERSITY OF LAGOS, AKOKA, LAGOS STATE offer Nursing?" is not a
  sentence anybody writes.
- `programmeCount` is what this catalogue holds, **not** what the institution
  offers. Never repeat it as the latter.
- `state`, `type` and `category` are `null` when the catalogue records none.
  That is not a state named `""`.

---

### `GET /institutions/{id}`

One institution, with its programmes paged.

| Parameter | Description |
|---|---|
| `limit`, `cursor` | Page the **programmes**, not the institution |

```json
{
  "data": {
    "institution": { "id": "<institution-id>", "name": "...", "programmeCount": 62, ... },
    "programmes": [ { "id": "<programme-id>", "name": "Nursing Science", ... } ]
  },
  "pagination": { "limit": 25, "nextCursor": "...", "total": 62 },
  "meta": { "source": "ibass", ... }
}
```

The `{id}` accepts either the institution's `id` or the exact `name` the brochure
prints. Prefer the id.

An unknown id is `404`. An institution the catalogue knows about but holds no
programmes for is **not** a 404 — it is returned with `programmeCount: 0` and an
empty programme list, because those are different facts and the API keeps them
apart.

Programmes here are summaries. For requirement prose, fetch
`/programmes/{id}` for the one you are about to quote.

---

### `GET /programmes`

Programmes, filtered and paged.

| Parameter | Description |
|---|---|
| `institutionId` | An `id` from `/institutions`. |
| `state` | Programmes at institutions in that state. |
| `q` | One contiguous, case-insensitive substring, matched against the programme name **and** the institution's name. It is not tokenised: `q=University of Lagos` narrows to that school and `q=nursing` finds Nursing programmes, but `q=UNILAG nursing` matches nothing. Combine filters with separate parameters — `q=nursing&state=Lagos`. |
| `subject` | A subject **code** from `/subjects`, e.g. `BIO`. Not a name: `subject=Biology` is a `400`. |
| `limit`, `cursor` | See [Pagination](#pagination) |

```bash
curl -s -H "Authorization: Bearer $KEY" \
  'https://<your-domain>/api/v1/programmes?institutionId=<institution-id>&subject=BIO&limit=5'
```

```json
{
  "data": [
    {
      "id": "<programme-id>",
      "institutionId": "<institution-id>",
      "institution": "UNIVERSITY OF LAGOS, AKOKA, LAGOS STATE",
      "institutionShort": "UNIVERSITY OF LAGOS",
      "name": "Nursing Science",
      "department": "Nursing",
      "status": "Available",
      "utmeSubjects": ["English Language", "Biology", "Chemistry", "Physics"],
      "sourceUrl": "https://ibass.jamb.gov.ng/brochure-by-institution",
      "sourceUpdatedAt": "2026-10-13T02:00:11.000Z",
      "reviewedCourseId": "unilag-nursing",
      "ruleStatus": "ready"
    }
  ],
  "pagination": { "limit": 5, "nextCursor": null, "total": 4 },
  "meta": { "source": "ibass", ... }
}
```

`utmeSubjects` is **as the brochure publishes it** — names, not codes, and not
mapped to the `/subjects` vocabulary. The brochure writes entries such as
`Government/History` and `Data Processing/Computer Studies`, which have no code;
folding the rest into codes would silently turn a four-subject combination into a
three-subject one. Match on the labels loosely, or use the `subject` filter and
let us do it.

No requirement prose in a listing. That is deliberate: the prose is roughly 15KB
of HTML per programme and a page of 30 search results renders none of it.

`reviewedCourseId` is set only where the checker holds a reviewed course for the
programme. That is rare — a handful of courses against twenty thousand
programmes — so `null` is the ordinary case. `ruleStatus` says whether a
requirement has been read: `ready`, `no-source` (reading was done and the brochure
states none), or `null` (nobody has looked yet).

---

### `GET /programmes/{id}`

One programme, with its full requirement prose.

```json
{
  "data": {
    "id": "<programme-id>",
    "name": "Nursing Science",
    "utmeSubjects": ["English Language", "Biology", "Chemistry", "Physics"],
    "olevelRequirements": "Five credits including English Language, Mathematics, Biology and Chemistry.",
    "directEntryRequirements": null,
    "remarks": "...",
    "sourceUrl": "https://ibass.jamb.gov.ng/brochure-by-institution",
    "checkerUrl": "https://<your-domain>/check?course=unilag-nursing",
    "reviewedCourseId": "unilag-nursing",
    "ruleStatus": "ready"
  },
  "meta": { "source": "ibass", ... }
}
```

Every prose field is the brochure's own words, quoted. `sourceUrl` is where they
came from; cite it.

- `olevelRequirements: null` means the brochure states none. It does **not** mean
  a requirement of nothing, and it says nothing about any student.
- `checkerUrl` is non-null only where the checker holds a reviewed course. This is
  the correct next step to offer: quote the requirements, then link here.
- The id is stable and opaque: JAMB's own identifier for the programme,
  namespaced with the institution's (`<institution-id>:<programme-id>`). Take it
  from a response and pass it back verbatim — do not construct one.

---

### `GET /subjects`

The vocabulary, so you map what a student types the way this catalogue does.

```json
{
  "data": {
    "subjects": [ { "code": "ENG", "name": "English Language" }, { "code": "MTH", "name": "Mathematics" } ],
    "grades": [
      { "code": "A1", "credit": true,  "meaning": "..." },
      { "code": "C6", "credit": true,  "meaning": "..." },
      { "code": "D7", "credit": false, "meaning": "..." },
      { "code": "E8", "credit": false, "meaning": "..." },
      { "code": "F9", "credit": false, "meaning": "..." }
    ],
    "alwaysRequired": ["ENG", "MTH"]
  },
  "meta": { "source": "built-in", ... }
}
```

**Serve the grade table; do not infer your own.** The rule that matters is
`credit`:

| Grades | Meaning |
|---|---|
| A1, B2, B3, C4, C5, C6 | Credits — they satisfy a subject requirement |
| D7, E8 | Passes. **They satisfy nothing.** |
| F9 | Fail |

Every eligibility mistake in this domain comes from treating a D7 or an E8 as a
credit. `credit` here is the same function the eligibility engine decides
with, so what you render and what the checker applies cannot come apart.

`alwaysRequired` is English Language and Mathematics — the subjects no programme
lets a student drop.

Call this once at startup and cache it. It changes only when the app is deployed.

---

### `GET /openapi.json`

The contract as an OpenAPI 3.1 document, with `servers` set to the address you
reached it at.

```bash
curl -s -H "Authorization: Bearer $KEY" \
  'https://<your-domain>/api/v1/openapi.json' > openapi.json
npx @redocly/cli lint openapi.json
npx openapi-typescript openapi.json -o ./catalogue.d.ts
```

---

## Errors

| Code | Status | Cause |
|---|---|---|
| `unauthorized` | 401 | No key, or one this deployment does not accept. |
| `bad_request` | 400 | A parameter could not be read — a non-numeric `limit`, a cursor we did not issue, a subject that is not a code. |
| `not_found` | 404 | No such institution or programme. |
| `rate_limited` | 429 | Over the rate limit. Honour `Retry-After`. |
| `unavailable` | 503 | Either no keyring is configured on the server (ours to fix), or a read failed. |

`unavailable` is not a code to treat as fatal — the next request may well succeed.

Messages are written for you, not for a student. Do not display them to a user;
switch on `code` and write your own copy.

### Status codes per code

The mapping is fixed API-wide, so `bad_request` never means 400 on one endpoint
and 422 on another. A client switching on the code can rely on the status, and
one switching on the status can rely on the code.

---

## Rate limits

**60 requests per key per minute.**

Every response carries:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1760522400     # Unix seconds
```

A `429` also carries `Retry-After` in seconds. Cache `/subjects` rather than
re-fetching it.

**Read this honestly: the limit is a runaway guard, not a metered quota.** The
handlers run on serverless instances, so the window lives in one instance's
memory. Ten instances serve ten windows, and a cold start serves a fresh one. A
caller over the limit on one instance can be under it on the next.

Responses are `Cache-Control: private`, so **no shared cache sits between you and
the database**: a request that is not already in your own client's cache reaches
a reader. That is deliberate (see *Freshness and caching*), but it means the
rate limit really is the only brake. If you genuinely need a higher rate or a
hard guarantee, say so and we will arrange it rather than have you discover the
limit's edges.

---

## Freshness and caching

| | |
|---|---|
| `Cache-Control` | `private, max-age=300` |
| Errors | `no-store`, always |
| `meta.generatedAt` | When this response was built |
| `lastUpdatedAt` (`/meta`) | When the mirror was last taken from IBASS |

The catalogue itself moves when the scheduled IBASS sync runs, not when you
request it, so a five-minute client-side cache costs you nothing.

The header is `private` rather than `public` because every endpoint here
requires a key. A shared cache keys on the URL alone — it cannot tell a request
that presented one from a request that did not — so a publicly cached response
would be handed to callers who never authenticated. Caching the response in your
own client is both safe and supported; caching it in a CDN on our behalf is not
something the API opts into.

---

## Versioning

The version is in the path (`/api/v1`) and echoed in `meta.apiVersion`.

Within v1, **additive change is expected**: new fields may appear on any response,
and new optional query parameters may be accepted. Write your client to ignore
what it does not read. A field is only removed or repurposed under a new version
in the path.

When a breaking change is unavoidable, we will tell you before it ships, using
the contact you gave us. Nothing in v1 will stop working without that notice.

---

## Known limits

- **No verdict endpoint.** By design; see [above](#what-this-api-is-not).
- **No fees, deadlines, or portal screens.** Deliberately excluded — they change
  per session and the app routes students to the official source instead.
- **Requirement prose on detail reads only.** A listing carries the subject
  combination, not the prose. One extra request per programme you quote.
- **`reviewedCourseId` is usually `null`.** The checker has reviewed a small
  number of courses against a catalogue of twenty thousand programmes. A checker
  link is the exception, not the rule — offer it where it exists, the brochure URL
  everywhere else.
- **`total` counts what the catalogue holds.** It is not a count of places anyone
  will be admitted to.

---

## Quick start

```bash
KEY='the-key-we-issued-you'
BASE='https://<your-domain>/api/v1'

# 1. size the catalogue
curl -s -H "Authorization: Bearer $KEY" "$BASE/meta" | jq '.data'

# 2. find a school and hold its id — ids are opaque, so take them from a response
INSTITUTION=$(curl -s -H "Authorization: Bearer $KEY" \
  "$BASE/institutions?state=Lagos&limit=1" | jq -r '.data[0].id')

# 3. that school's programmes
curl -s -H "Authorization: Bearer $KEY" "$BASE/programmes?institutionId=$INSTITUTION&limit=5" \
  | jq '.data[] | {id, name}'

# 4. read one in full, using an id from the previous response
PROGRAMME=$(curl -s -H "Authorization: Bearer $KEY" \
  "$BASE/programmes?institutionId=$INSTITUTION&limit=1" | jq -r '.data[0].id')
curl -s -H "Authorization: Bearer $KEY" "$BASE/programmes/$PROGRAMME" | jq '.data'

# 5. the grade table you must not invent
curl -s -H "Authorization: Bearer $KEY" "$BASE/subjects" | jq '.data.grades'
```
