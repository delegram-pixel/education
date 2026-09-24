# Admission Copilot

Admission Copilot is a Next.js application that helps prospective students understand course eligibility, navigate the application journey, and ask admission-related questions with guided support.

It includes:
- course and subject eligibility checks
- guided walkthroughs for admission steps
- student quiz and recommendation flow
- support ticket flow for unresolved cases
- a lightweight database-backed data layer with graceful fallback behavior

## Tech stack
- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Drizzle ORM
- Neon database support
- Vitest for tests

## Prerequisites
Before you begin, make sure you have:
- Git installed
- Node.js 20 or newer
- Yarn installed

## Clone the repository
Open a terminal and run:

```bash
git clone <repository-url>
cd education
```

If you are cloning from GitHub, it usually looks like this:

```bash
git clone https://github.com/your-username/education.git
cd education
```

## Install dependencies
From the project root, install the app dependencies:

```bash
yarn install
```

## Environment variables
This project supports local environment configuration through `.env.local`.

Create a `.env.local` file in the project root if you want to provide your own database settings:

```bash
DATABASE_URL=your_neon_or_postgres_connection_string

# Swift Agents widget credentials. Read by the server at request time, so they
# can be rotated without a rebuild; they are not inlined into the bundle.
# Replace with your real values from the Swift dashboard.
SWIFT_COMPANY_ID="your_swift_company_id"
SWIFT_API_KEY="your_swift_api_key"

# Reading eligibility rules out of the IBASS brochure — see "Reading rules out
# of the brochure" below. A free Groq key from https://console.groq.com/keys;
# no credit card, and the free tier is permanent. Leave it empty and the
# feature is off.
#
# Do NOT prefix this with NEXT_PUBLIC_. It is read on the server at request
# time, and a NEXT_PUBLIC_ variable is inlined into the browser bundle.
GROQ_API_KEY=""
```

Note: the app is designed to work without a database configured as well. If `DATABASE_URL` is missing, it falls back to static data in many flows.

## Run the application in development mode
Start the app locally:

```bash
yarn dev
```

Then open:

```text
http://localhost:3000
```

## Production build
To create a production build:

```bash
yarn build
```

To run the production server:

```bash
yarn start
```

## Useful project scripts

```bash
yarn lint
yarn typecheck
yarn test
yarn db:push
yarn db:studio
yarn db:seed
yarn catalogue:prepare
yarn catalogue:sync
yarn catalogue:status
```

## Nigeria-wide catalogue for Swift Agents

The app keeps two catalogue layers separate:

- `courses` contains reviewed courses that can produce an in-app eligibility verdict.
- the JAMB IBASS mirror contains the full discovery catalogue for Swift and must never be presented as a guaranteed eligibility decision.

To import the official JAMB IBASS institution and programme catalogue, run:

```bash
yarn catalogue:prepare
yarn catalogue:sync
yarn catalogue:status
```

The full import takes hours and can be stopped and restarted at any point. Three environment
variables control it:

| Variable | Effect |
| --- | --- |
| `RESUME=1` | Skip schools already imported in full. A school holding fewer programmes than IBASS reports is re-imported, so a run that was interrupted partway repairs itself instead of staying partial. |
| `REFRESH=1` | Resume, but re-import any school holding a programme with an empty UTME subject list. Use it to repair rows an older import wrote with the wrong field shape — see below. |
| `TYPE=<id or name>` | Import one institution type only — `TYPE=4`, or `TYPE=degree`. Matches on the type's id or its title. |
| `SCHOOL=<names>` | Import only the schools named, comma-separated — `SCHOOL="university of lagos, rivers state"`. Names are matched loosely (case, hyphens and doubled spaces fold away, and JAMB's numeric id works), so one name can match several institutions; the run reports how many each name matched. |

**Run it per type, and check `catalogue:status` between runs.** IBASS lists its types in a fixed
order with degree-awarding institutions last, so a run that is stopped partway loses exactly the
schools most students are looking for. The mirror once reached 839 institutions without a single
university that way: the types ahead of it succeeded, so the run looked healthy.

```bash
RESUME=1 TYPE=degree yarn catalogue:sync                    # all 529 degree institutions
SCHOOL="university of lagos, rivers state" TYPE=degree yarn catalogue:sync   # just these
yarn catalogue:status                                        # confirm the count moved
```

Universities are imported before colleges and seminaries within a type, so the schools a student is
most likely to search for are complete early rather than at the end of a multi-hour run.

`catalogue:status` groups by institution type for that reason, and reports any institution with no
programmes and when the mirror was last written. A run that imports nothing for a type it was asked
for says so outright rather than reporting a healthy total.

<small>Measured 2026-09-22: the programme pass costs roughly 3s per IBASS page, which is the floor
per school. Batching the database writes cut the per-school time from about 5 minutes to about 20
seconds; the remaining cost is upstream latency, not the mirror.</small>

### Repairing an import that wrote the wrong shape

The sync reads two kinds of field. Some arrive as a JSON array of strings; others arrive as one
comma-separated sentence in a plain string. An earlier version of `stringList` returned `[]` for
anything that was not already an array — so `utme_subjects` imported empty for the entire country
while the O'level prose beside it, read through a different helper, imported fine. The mirror
looked complete and every subject combination in it was missing.

Fixing the helper only changes what the *next* sweep captures. Rows already written keep the empty
list they were written with, so they have to be fetched again:

```bash
REFRESH=1 TYPE=degree yarn catalogue:sync
```

`REFRESH=1` resumes as usual and additionally re-imports every school holding a programme with an
empty subject list. It over-selects on purpose: a programme that genuinely carries no subjects is
indistinguishable from a damaged one in the mirror, so one empty list re-imports the institution.
The run says how many schools it re-read, because a repair that matched nothing and one that fixed
everything otherwise look the same from the outside.

## Reading rules out of the brochure

A verdict needs a **structured** rule — `{ minCredits: 5, mandatory: ['ENG','MTH',...] }` — and the
only ones written by hand live in `lib/db/courses.data.ts`, which is three courses at one
university. IBASS publishes the same information as **prose**. `lib/rules/` closes the gap: when a
student picks a course nobody has read yet, a model reads that programme's requirement sentence,
the reading is validated into the structured rule the eligibility engine already understands, and
it is stored. The first student at a course waits a few seconds; every student after them reads one
row and gets an instant verdict.

Coverage therefore grows exactly where students actually go and nowhere else. This is not a bulk job
over twenty thousand programmes — a course nobody picks is never read.

**The provider is Groq, on its free tier.** No credit card, and the free tier is permanent rather
than a trial. Two things make that fit: Groq is the fastest of the free providers, which matters
because a student is sitting in front of the panel while the call runs, and the architecture makes
the quota a non-issue — a rule is read once per *programme* and stored forever, so total calls are
bounded by how many distinct courses students pick, not by how many students pick them. It is one
POST to `https://api.groq.com/openai/v1/chat/completions` with `response_format` set to a strict
`json_schema`, which is why `lib/rules/model.ts` needs no SDK: an OpenAI-shaped endpoint and a
static body are `fetch` and `JSON.parse`, and a dependency here would be a liability rather than a
convenience.

Swapping providers means editing that one file and nothing else — the prompt, the validation, the
storage and the UI are all provider-agnostic. A `429` from a spent quota is treated like any other
failed read: nothing is stored, the student sees the ordinary unreviewed panel, and the next request
tries again.

**It is off unless you turn it on.** With `GROQ_API_KEY` empty the whole feature short-circuits
in `lib/db/rules.ts` before it touches the database, and the app behaves exactly as it did before it
existed: unreviewed courses stay on the "we have not reviewed this" panel, and nothing is read or
written. The same goes for `DATABASE_URL` — with no database there is nowhere to cache a reading, so
every request would re-read the same sentence and re-charge for it.

**Nothing here is verified by a person.** A stored rule records the `source_text` it was read from,
a hash of it, the `confidence` the model reported and the `model` that produced it — enough to
audit a reading and to find every rule that went stale when IBASS reworded something. It does not
make the reading correct, and the UI says so rather than labelling a machine reading "reviewed".

| File | What it is |
| --- | --- |
| `lib/rules/reader.ts` | Pure. HTML to text, the prompt, and the validation. Knows nothing about any provider, so all of it is unit-tested. |
| `lib/rules/model.ts` | The only file that talks to a provider, and the only one that would change to swap providers. Raw `fetch` to Groq's OpenAI-shaped endpoint, no SDK. |
| `lib/db/rules.ts` | Reading, storing and reusing a rule. Cache first, then an in-flight guard, then the model. |
| `lib/db/schema.ts` | `programme_rules` — deliberately a table of its own. `catalogue_programmes` is a faithful mirror of what IBASS said; a rule is our derivation from it and must not be able to masquerade as IBASS's own words. |

A reading is stored **only** when the model is sure what it read, and what gets stored depends on
which of three things it reports. This distinction is the whole contract, and it used to be missing:
`"rule": null` was the only way for the model to say either *"this sentence states no requirement"*
or *"I could not read this sentence"*, and those two have opposite remedies. Collapsing them meant a
sentence the model merely found awkward was written down as a permanent "nothing to read here" and
the course could never be asked about again — which is exactly what the first live read did.

| The model reports | Stored as | Why |
| --- | --- | --- |
| `rule` | `ready` | A requirement was read. |
| `none`, **and** it is sure | `no-source` | There is genuinely nothing to read here. Costs one row and saves a model call per student forever. |
| `none`, but unsure | *nothing* | A guess written down becomes a course nobody is ever offered a check on. Retried instead. |
| `unreadable` | *nothing* | The sentence states a requirement the reader cannot return faithfully. Retrying is the point — a failed read must never become a permanent fact. |

A programme whose requirement text is empty never reaches a model at all: `no-source` is recorded
locally without a call. That is the common case — 6958 of the 21096 programmes in the mirror have no
requirement text.

**Subjects the brochure names but we have no code for.** "Business Management", "Data Processing",
"Basic Electricity", "Typewriting" — 2489 of the 21096 programmes name at least one. What happens to
one depends on where it appears, and the two cases are not the same:

- Required **in its own right**, it cannot be dropped without making the requirement weaker than it
  is, so the reading is refused outright.
- One **choice among several** ("any two of Geography, Business Management, Biology") can be dropped,
  because the group is then narrower than the brochure and never wider. The reading is kept, the name
  is recorded on the rule as `unmapped`, and the verdict says so on screen.

Dropping a choice can only ever produce a *false negative* — it cannot make someone eligible who is
not — so a "you qualify" verdict is unaffected, and the disclosure matters only to a student who is
being told they miss a group they might actually meet.

**The free tier binds on tokens per minute, not requests.** Groq's limit for `openai/gpt-oss-120b` is
8000 TPM, and one read costs roughly 2000 tokens including the subject list in the prompt — so a
burst of *distinct* courses is rate-limited after about four calls in a minute. That is why the
architecture reads once per programme and stores forever: total calls are bounded by how many
distinct courses students pick, not by how many students pick them. A `429` is treated like any other
failed read — nothing is stored, the student sees the ordinary unreviewed panel, and the next request
tries again.

Run the sync on a scheduled server job to keep the mirror fresh. Once deployed, add this URL as a **website knowledge source** in the Swift Agents dashboard:

```text
https://your-domain.example/api/swift/knowledge
```

The endpoint is plain Markdown, carries the source link for each programme it lists, and labels the fallback sample data if the national catalogue has not been imported. Because the national catalogue runs past twelve thousand programmes, the programme section is capped at the first 500 and says so in the document itself — Swift is told that a programme missing from it is outside the sample, not evidence that an institution does not offer it. The institution list is complete. JAMB identifies IBASS as the official e-brochure and eligibility source; students should still verify the current session in IBASS and the institution's own bulletin.

## Project structure
- `app/` — Next.js routes and application pages
- `components/` — reusable UI and feature components
- `lib/` — core logic, scoring, database helpers, and validation
- `drizzle.config.ts` — Drizzle configuration
- `vitest.config.ts` — test configuration

## Troubleshooting
- If dependencies are not installed, run `yarn install` again.
- If the app does not start, make sure you are using a supported Node.js version.
- If you are using a database, confirm your `DATABASE_URL` is valid.
- For local script support, keep environment variables in `.env.local` rather than exporting them in the shell only.

## License
This project does not currently define a license in the repository. If needed, add one before distributing or publishing the code.
