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
