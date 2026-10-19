# Swift Knowledge API

Public, unauthenticated endpoint that renders the Admission Copilot admissions
catalogue as a single Markdown document, for upload to the Swift Agents
**knowledge base**.

Swift's knowledge base ingests files, not URLs, so this endpoint exists to
produce the file: fetch it, save it, upload it. Each fetch is generated from the
live catalogue, so the fresh copy is always one request away.

## Endpoint

```
GET https://<your-domain>/api/swift/knowledge            # view in a browser
GET https://<your-domain>/api/swift/knowledge?download=1 # save as a file
```

| | |
|---|---|
| Method | `GET` |
| Authentication | None — public by design |
| Query parameters | `download` (optional) — `1` forces a save as a file |
| Request body | None |
| Saved filename | `admission-copilot-catalogue.md` |

Without `download=1` the response renders in the browser, which is what you want
for reading it or checking what an upload will contain. With `download=1` the
browser saves it instead. Both routes produce the same document and offer the
same filename.

It is public deliberately. Everything it returns is already public admissions
information, sourced from the JAMB IBASS e-brochure and each institution's own
bulletin. There is no student data, no session data, and no credential of any
kind in the response.

## Response

`200 OK`, body is a single UTF-8 Markdown document.

```
Content-Type: text/markdown; charset=utf-8
Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400
Content-Disposition: inline; filename="admission-copilot-catalogue.md"
```

The `Content-Disposition` header is `attachment` instead of `inline` when
`download=1` is passed. The filename is the same either way.

## Document structure

The document has four parts, in this order:

1. **Header** — generation timestamp and catalogue status
2. **Usage and safety rules** — constraints the agent is instructed to follow
3. **`## Institutions`** — every institution held, grouped under `### <State>`
4. **`## Programmes`** — programme records with their requirements

### Catalogue status line

The header states which catalogue backed the document:

- `Catalogue status: JAMB IBASS mirror` — the national catalogue was read
- `Catalogue status: sample fallback only` — the database was absent or
  unreachable, and a small local sample was served instead

**Treat `sample fallback only` as a degraded document.** The sample is a
handful of institutions, not a national list, and answers drawn from it are not
representative. It is served so the endpoint never fails outright, not because
it is a substitute for the mirror.

### Institutions section — complete

Every institution in the catalogue appears, under a `### <State>` heading:

```
### Lagos
- University of Lagos (Federal University) — 62 programmes listed
- Lagos State University (State University) — 48 programmes listed
```

Complete by design. An institution with no programme detail still appears — the
underlying query is a LEFT join, so a school the catalogue knows about but holds
no programmes for is listed with a count of `0` rather than omitted.

### Programmes section — sampled, and the document says so

The programme section is **capped at 500 entries**. When the catalogue exceeds
that, the document states this in its own text and instructs the reader:

> a programme absent from here is outside the sample, NOT evidence that the
> institution does not offer it. Never tell a student a school does not offer a
> programme because it is missing from this document.

Each entry carries its own source link:

```
## Nursing Science — University of Lagos
Department: Nursing
Status: ...
UTME subjects: ...
O-level requirements: ...
Direct Entry requirements: ...
Official remarks: ...        (mirror rows) | Note: ...   (sample rows)
Source: https://...
```

The `Official remarks` / `Note` label is not cosmetic. Only a mirrored IBASS row
carries IBASS's own words; labelling the local sample's note "Official" would
credit it to JAMB, so the two are distinguished.

## Freshness

| | |
|---|---|
| Route revalidation | 3600s |
| Edge cache | `s-maxage=3600`, `stale-while-revalidate=86400` |
| Authority | the `Generated:` timestamp inside the document |

Use the `Generated:` timestamp rather than the time of the crawl. The response
may be served stale for up to 24 hours while revalidating, and a cached body
keeps its original timestamp, so the timestamp is the honest answer to "how old
is this".

The catalogue itself is refreshed by a separate scheduled IBASS sync job, which
is what moves the `Generated:` timestamp forward.

## Safety rules carried in the document

The document instructs the agent to:

- Cite the source URL for any programme requirement, and never claim a course is
  available or a requirement current without it
- Direct students to verify fees, deadlines and portal screens in the current
  JAMB IBASS record and the institution's own bulletin
- Never tell a student to pay through a forwarded link — always the official
  portal, opened by the student
- Never request, repeat, or handle an OTP, password, PIN, card number, or
  account credential
- Say so when a question cannot be answered from a cited official source, and
  offer a counselor handoff

**One verdict is deliberately out of scope.** Automated eligibility decisions
are produced only by the in-app eligibility checker, which works from reviewed
rules. The knowledge document states plainly that only that checker may present
a reviewed automated verdict. The agent should not read requirements out of this
document and then declare a student eligible or ineligible.

## Getting it into the knowledge base

Save a current copy:

```bash
curl -OJ 'https://<your-domain>/api/swift/knowledge?download=1'
```

`-OJ` takes the filename from `Content-Disposition`, so you get
`admission-copilot-catalogue.md`. Opening the same URL in a browser works too,
and without `?download=1` you can read it in a tab before uploading it.

Then upload that file to the Swift Agents knowledge base. Nothing pushes an
update: an uploaded file is a snapshot, and it stays exactly as uploaded until
somebody replaces it.

**Check the `Generated:` timestamp before you upload.** Because the upload is
manual, that line inside the document is the only thing that says how old the
knowledge is — a stale file is otherwise indistinguishable from a fresh one.

**Refresh cadence.** The catalogue moves when the scheduled IBASS sync runs.
Re-uploading after each sync keeps the knowledge base current; re-uploading
between syncs just fetches a byte-identical document.

### Does this endpoint need to be public?

Not necessarily, and that choice matters.

**If you do the upload yourself**, the endpoint can stay off the public internet
entirely — run it locally, or put it behind your normal authentication, and
upload the file you save. This is the safer arrangement: the endpoint queries
the database on every cache miss, so leaving it public means anyone can spend
that query. A file-based knowledge base does not require a reachable URL, only a
reachable *file*.

**If Swift does the integration**, they need a URL they can fetch — which means
public and unauthenticated, as documented above.

Decide which one this is before deploying. Adding authentication later is easy;
walking back a public endpoint that has been crawled and indexed is not.

## Known limits

- **500-programme cap.** School-level questions are answered completely;
  programme-level detail beyond the cap is not in the document.
- **No per-institution drill-down.** There is currently one endpoint. A
  `/api/swift/knowledge/<institution>` route returning that school's full
  programme list does not exist yet.
- **No fees, deadlines, or portal screens.** Deliberately excluded — they change
  per session and the document routes students to the official source instead.
- **Manual refresh.** Nothing pushes an updated document into the knowledge
  base. The uploaded file is a snapshot until somebody replaces it, so a stale
  upload serves stale answers, and the `Generated:` line is the only warning.
- **Markdown, not JSON.** Intentional: the knowledge base reads text, and a JSON
  body would present it with syntax rather than sentences. It also keeps the
  upload auditable — you can read exactly what the agent was given.
- **No rate limiting** on the endpoint. The hour-long edge cache absorbs this in
  practice, but a cache miss reaches the database.
