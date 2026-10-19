import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { CodeBlock } from '@/components/docs/code-block'
import { Badge } from '@/components/ui/badge'
import {
  API_PATH,
  API_VERSION,
  CATALOGUE_DISCLAIMER,
  DEFAULT_PAGE_SIZE,
  ENDPOINTS,
  ERROR_CODES,
  ERROR_STATUS,
  MAX_PAGE_SIZE,
  RATE_LIMIT,
  type EndpointSpec,
  type ErrorCode,
} from '@/lib/api/contract'

export const metadata: Metadata = {
  title: `Catalogue API v${API_VERSION}`,
  description:
    'Reference for the read-only Admissions Catalogue API: authentication, the response envelope, endpoints, pagination, errors, rate limits and caching.',
}

/**
 * The human-facing reference for the catalogue API.
 *
 * Every number, status code and path on this page is imported from
 * `lib/api/contract.ts` — the same module the OpenAPI document and the handlers
 * read. That is deliberate: the prose can fall behind, but a page that states a
 * page size the API does not serve, or a status a code never carries, is a lie
 * rather than a typo. Only the sentences are hand-written here.
 */

const TOC = [
  { id: 'not', label: 'What this is not' },
  { id: 'auth', label: 'Authentication' },
  { id: 'envelope', label: 'The envelope' },
  { id: 'paging', label: 'Pagination' },
  { id: 'endpoints', label: 'Endpoints' },
  { id: 'errors', label: 'Errors' },
  { id: 'rate-limits', label: 'Rate limits' },
  { id: 'caching', label: 'Freshness and caching' },
  { id: 'versioning', label: 'Versioning' },
  { id: 'known-limits', label: 'Known limits' },
  { id: 'quick-start', label: 'Quick start' },
] as const

/** Resolve an endpoint from the contract, so a path here cannot be invented. */
function endpoint(path: string): EndpointSpec {
  const found = ENDPOINTS.find((e) => e.path === path)
  if (!found) throw new Error(`No endpoint ${path} in the API contract`)
  return found
}

/**
 * The "Cause" column of the error table. Kept here rather than in the contract
 * because it is prose, not a fact the handlers use — the status and the code are
 * the contract, the explanation is documentation.
 */
const ERROR_CAUSE: Record<ErrorCode, string> = {
  unauthorized: 'No key, or one this deployment does not accept.',
  bad_request:
    'A parameter could not be read — a non-numeric limit, a cursor we did not issue, a subject that is not a code.',
  not_found: 'No such institution or programme.',
  rate_limited: 'Over the rate limit. Honour Retry-After.',
  unavailable:
    'Either no keyring is configured on the server (ours to fix), or a read failed.',
}

const ERROR_ROWS = [...ERROR_CODES].sort((a, b) => ERROR_STATUS[a] - ERROR_STATUS[b])

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-sm bg-sunken px-1.5 py-0.5 font-mono text-[0.875em]">{children}</code>
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-14 scroll-mt-24">
      <h2 className="text-[1.5rem]">{title}</h2>
      <div className="mt-4 space-y-4 text-[1rem] leading-relaxed">{children}</div>
    </section>
  )
}

function Endpoint({ spec, id, children }: { spec: EndpointSpec; id: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-24 border-t border-border pt-8">
      <div className="flex flex-wrap items-center gap-2.5">
        <Badge tone="primary" className="font-mono text-[0.75rem] tracking-wider">
          GET
        </Badge>
        <code className="break-all font-mono text-[1rem] font-medium">
          {API_PATH}
          {spec.path}
        </code>
      </div>
      <p className="mt-2 text-[0.9375rem] text-muted">{spec.summary}</p>
      <div className="mt-4 space-y-4 text-[1rem] leading-relaxed">{children}</div>
    </section>
  )
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-136 text-left text-[0.9375rem]">
        <thead className="bg-sunken text-[0.75rem] tracking-wider text-muted uppercase">
          <tr>
            {head.map((label) => (
              <th key={label} scope="col" className="px-4 py-2.5 font-semibold">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function ParamsTable({ rows }: { rows: { name: string; description: ReactNode }[] }) {
  return (
    <Table head={['Parameter', 'Description']}>
      {rows.map((row) => (
        <tr key={row.name} className="border-t border-border align-top">
          <td className="px-4 py-2.5 font-mono text-[0.875rem] whitespace-nowrap">{row.name}</td>
          <td className="px-4 py-2.5 text-muted">{row.description}</td>
        </tr>
      ))}
    </Table>
  )
}

export default function CatalogueApiPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start lg:gap-12">
        <article className="min-w-0 max-w-3xl">
          <header>
            <Badge tone="accent" className="text-[0.75rem] font-semibold tracking-wider uppercase">
              API reference
            </Badge>
            <h1 className="mt-4 text-[2rem] sm:text-[2.75rem]">Catalogue API v{API_VERSION}</h1>
            <p className="mt-2 text-[0.8125rem] font-medium tracking-wider text-muted uppercase">
              Version {API_VERSION} · 18 October 2026
            </p>

            <p className="mt-4 text-[1.0625rem] leading-relaxed">
              A read-only JSON API over the Nigerian admissions catalogue behind Admission
              Copilot: institutions, their programmes, the UTME subject combinations and
              requirement prose JAMB&rsquo;s IBASS e-brochure publishes, and the subject and grade
              vocabulary this catalogue uses.
            </p>
            <p className="mt-3 text-[1.0625rem] leading-relaxed text-muted">
              The catalogue is compiled from JAMB&rsquo;s IBASS e-brochure and each
              institution&rsquo;s own bulletin, so everything here is already public. The API holds
              no student data and has no route that reads any.
            </p>

            <CodeBlock label="Base URL" code={`https://<your-domain>${API_PATH}`} />

            <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
              OpenAPI 3.1 document: <Code>GET {API_PATH}/openapi.json</Code> — generate a client
              from it rather than transcribing this page.
            </p>
          </header>

          <Section id="not" title="What this API is not">
            <div className="rounded-lg border border-border bg-accent-subtle p-5">
              <p className="font-semibold text-foreground">It returns no verdict.</p>
              <p className="mt-2">
                There is no endpoint that takes a student&rsquo;s grades and answers
                &ldquo;eligible&rdquo; or &ldquo;not eligible&rdquo;. Requirements are returned as
                the brochure&rsquo;s own words, quoted, with the URL they came from — never as a
                decision.
              </p>
              <p className="mt-3">
                Where Admission Copilot&rsquo;s checker holds a reviewed course for a programme,
                the programme&rsquo;s detail read carries a <Code>checkerUrl</Code> pointing into
                it. That is the link to hand a student. Automated eligibility decisions are
                produced only by the in-app checker, because only it can say which rule set it
                decided from.
              </p>
            </div>

            <p>Two consequences worth building around:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Do not compute eligibility from <Code>olevelRequirements</Code>. It is prose, in
                the brochure&rsquo;s words, and it changes between sessions.
              </li>
              <li>
                Do not treat a programme&rsquo;s absence as evidence. A filtered page is a page;
                read <Code>pagination.total</Code> before saying anything about the whole
                catalogue.
              </li>
            </ul>
          </Section>

          <Section id="auth" title="Authentication">
            <p>Every request needs a key. Send it either way:</p>

            <CodeBlock
              label="Request headers"
              code={`Authorization: Bearer <your-key>
x-api-key: <your-key>`}
            />

            <p>
              <Code>Authorization</Code> wins if both are present. Keys are issued by Admission
              Copilot — ask for one; they are not self-service.
            </p>
            <p>
              A missing or wrong key is <Code>401 unauthorized</Code>. If the server has no keys
              configured at all it answers <Code>503 unavailable</Code> instead, which is a fault
              on our side rather than a problem with your key.
            </p>
            <p>
              The key is server-side. Do not put it in a browser bundle, a mobile app, or a public
              repository — anything a user can read is a key given away.
            </p>
          </Section>

          <Section id="envelope" title="The envelope">
            <p>Every successful response is the same shape:</p>

            <CodeBlock
              label="200 OK"
              code={`{
  "data": [],
  "pagination": { "limit": ${DEFAULT_PAGE_SIZE}, "nextCursor": "eyJ2IjoxLCJvIjoyNX0", "total": 3412 },
  "meta": {
    "source": "ibass",
    "generatedAt": "2026-10-15T09:12:44.108Z",
    "apiVersion": "${API_VERSION}",
    "disclaimer": "Catalogue presence is not an offer of admission, ..."
  }
}`}
            />

            <p>Every failure is the same shape:</p>

            <CodeBlock
              label="404 Not Found"
              code={`{ "error": { "code": "not_found", "message": "No programme in the catalogue has the id \`59:9999\`." } }`}
            />

            <p>One unwrapper and one error handler covers the whole API.</p>

            <h3 className="pt-2 text-[1.0625rem]">
              <Code>meta.source</Code>
            </h3>
            <Table head={['Value', 'Meaning']}>
              <tr className="border-t border-border align-top">
                <td className="px-4 py-2.5 font-mono text-[0.875rem] whitespace-nowrap">ibass</td>
                <td className="px-4 py-2.5 text-muted">
                  The JAMB IBASS mirror answered. This is the full catalogue.
                </td>
              </tr>
              <tr className="border-t border-border align-top">
                <td className="px-4 py-2.5 font-mono text-[0.875rem] whitespace-nowrap">sample</td>
                <td className="px-4 py-2.5 text-muted">
                  The mirror was unreachable and a small built-in sample answered instead.{' '}
                  <strong className="font-semibold text-foreground">A degraded read.</strong>{' '}
                  Fewer institutions than the national catalogue, and not representative. Do not
                  present it as the catalogue.
                </td>
              </tr>
              <tr className="border-t border-border align-top">
                <td className="px-4 py-2.5 font-mono text-[0.875rem] whitespace-nowrap">
                  built-in
                </td>
                <td className="px-4 py-2.5 text-muted">
                  The answer did not come from the catalogue at all — the subject and grade
                  vocabulary is compiled into the app. Appears on <Code>/subjects</Code> and{' '}
                  <Code>/openapi.json</Code> only.
                </td>
              </tr>
            </Table>

            <p>
              <Code>sample</Code> is not an error: the request succeeded, and the data is real. It
              is a statement about coverage.
            </p>

            <h3 className="pt-2 text-[1.0625rem]">
              <Code>meta.disclaimer</Code>
            </h3>
            <p>
              A fixed sentence, carried on every response so you never have to compose your own:
            </p>
            <blockquote className="border-l-2 border-primary bg-sunken px-4 py-3 text-[0.9375rem] text-muted">
              {CATALOGUE_DISCLAIMER}
            </blockquote>
            <p>Render it where you display catalogue data.</p>
          </Section>

          <Section id="paging" title="Pagination">
            <p>Every list endpoint takes limit and cursor.</p>

            <Table head={['Parameter', 'Default', 'Range']}>
              <tr className="border-t border-border align-top">
                <td className="px-4 py-2.5 font-mono text-[0.875rem]">limit</td>
                <td className="px-4 py-2.5 tabular">{DEFAULT_PAGE_SIZE}</td>
                <td className="px-4 py-2.5 tabular">
                  1–{MAX_PAGE_SIZE}
                </td>
              </tr>
              <tr className="border-t border-border align-top">
                <td className="px-4 py-2.5 font-mono text-[0.875rem]">cursor</td>
                <td className="px-4 py-2.5">—</td>
                <td className="px-4 py-2.5">
                  <Code>pagination.nextCursor</Code> from the previous page
                </td>
              </tr>
            </Table>

            <p>
              <Code>limit</Code> is <strong className="font-semibold">clamped, not refused</strong>
              : <Code>limit=1000</Code> returns {MAX_PAGE_SIZE} and says so in{' '}
              <Code>pagination.limit</Code>. <Code>limit=lots</Code> is a <Code>400</Code>,
              because a non-numeric limit is a bug in your code and answering it with{' '}
              {DEFAULT_PAGE_SIZE} would leave you wondering why paging never ends.
            </p>
            <p>
              <Code>cursor</Code> is opaque. Pass back exactly what you were given; do not
              construct one, parse one, or increment anything inside it. <Code>nextCursor</Code>{' '}
              is <Code>null</Code> on the last page — that is the signal to stop, not an empty
              page.
            </p>
            <p>
              <Code>pagination.total</Code> is the number of rows matching your filters{' '}
              <strong className="font-semibold">across every page</strong>. It is the only thing
              that distinguishes &ldquo;these are all the schools in Lagos&rdquo; from &ldquo;these
              are the first {DEFAULT_PAGE_SIZE} of 62&rdquo;.
            </p>

            <p>Walking the whole catalogue:</p>

            <CodeBlock
              label="Walk every page"
              code={`cursor=''
while :; do
  page=$(curl -s -H "Authorization: Bearer $KEY" \\
    "https://<your-domain>${API_PATH}/programmes?limit=100&cursor=$cursor")
  echo "$page" | jq -r '.data[].id'
  cursor=$(echo "$page" | jq -r '.pagination.nextCursor')
  [ "$cursor" = "null" ] && break
done`}
            />
          </Section>

          <section id="endpoints" className="mt-14 scroll-mt-24">
            <h2 className="text-[1.5rem]">Endpoints</h2>
            <p className="mt-4 text-[1rem] leading-relaxed">
              Seven routes, all <Code>GET</Code>, all under{' '}
              <Code>
                {API_PATH}
              </Code>
              . The paths and summaries below are read from the same contract the OpenAPI
              document is built from.
            </p>

            <Endpoint spec={endpoint('/meta')} id="endpoint-meta">
              <CodeBlock
                label="200 OK"
                code={`{
  "data": {
    "institutions": 466,
    "programmes": 21384,
    "lastUpdatedAt": "2026-10-13T02:00:11.000Z",
    "disclaimer": "Catalogue presence is not an offer of admission, ..."
  },
  "meta": { "source": "ibass", ... }
}`}
              />

              <p>
                <Code>lastUpdatedAt</Code> is when the mirror was last taken from IBASS — not when
                this response was built (<Code>meta.generatedAt</Code> is that) and not when any
                requirement was last reviewed. It is <Code>null</Code> on the sample path.
              </p>
              <p>
                Use it to size your copy: &ldquo;3,412 programmes across 466 institutions&rdquo;
                is a better sentence than implying your first page is everything.
              </p>
            </Endpoint>

            <Endpoint spec={endpoint('/institutions')} id="endpoint-institutions">
              <ParamsTable
                rows={[
                  { name: 'state', description: 'State name, e.g. Lagos. Case-insensitive.' },
                  {
                    name: 'type',
                    description: 'Institution type, e.g. Federal University. Case-insensitive.',
                  },
                  {
                    name: 'category',
                    description:
                      'University, Polytechnic, College of Education and similar. Case-insensitive.',
                  },
                  {
                    name: 'q',
                    description: 'Free text over the name, the state and the institution type.',
                  },
                  {
                    name: 'limit, cursor',
                    description: (
                      <a href="#paging" className="font-medium text-primary underline underline-offset-2">
                        See Pagination
                      </a>
                    ),
                  },
                ]}
              />

              <CodeBlock
                label="Request"
                code={`curl -s -H "Authorization: Bearer $KEY" \\
  'https://<your-domain>${API_PATH}/institutions?state=Lagos&limit=3'`}
              />

              <CodeBlock
                label="200 OK"
                code={`{
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
}`}
              />

              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <Code>id</Code> is JAMB&rsquo;s own identifier and is stable across a
                  re-import. Hold it.
                </li>
                <li>
                  <Code>name</Code> is what the brochure prints — often{' '}
                  <Code>NAME, CITY, STATE</Code>. <Code>shortName</Code> is the same institution
                  as a sentence refers to it; use that when composing prose, because
                  &ldquo;does UNIVERSITY OF LAGOS, AKOKA, LAGOS STATE offer Nursing?&rdquo; is
                  not a sentence anybody writes.
                </li>
                <li>
                  <Code>programmeCount</Code> is what this catalogue holds,{' '}
                  <strong className="font-semibold">not</strong> what the institution offers.
                  Never repeat it as the latter.
                </li>
                <li>
                  <Code>state</Code>, <Code>type</Code> and <Code>category</Code> are{' '}
                  <Code>null</Code> when the catalogue records none. That is not a state named{' '}
                  <Code>&quot;&quot;</Code>.
                </li>
              </ul>
            </Endpoint>

            <Endpoint spec={endpoint('/institutions/{id}')} id="endpoint-institution">
              <ParamsTable
                rows={[
                  {
                    name: 'limit, cursor',
                    description: (
                      <>
                        Page the <strong className="font-semibold">programmes</strong>, not the
                        institution
                      </>
                    ),
                  },
                ]}
              />

              <CodeBlock
                label="200 OK"
                code={`{
  "data": {
    "institution": { "id": "<institution-id>", "name": "...", "programmeCount": 62, ... },
    "programmes": [ { "id": "<programme-id>", "name": "Nursing Science", ... } ]
  },
  "pagination": { "limit": ${DEFAULT_PAGE_SIZE}, "nextCursor": "...", "total": 62 },
  "meta": { "source": "ibass", ... }
}`}
              />

              <p>
                The <Code>{'{id}'}</Code> accepts either the institution&rsquo;s{' '}
                <Code>id</Code> or the exact <Code>name</Code> the brochure prints. Prefer the id.
              </p>
              <p>
                An unknown id is <Code>404</Code>. An institution the catalogue knows about but
                holds no programmes for is <strong className="font-semibold">not</strong> a 404 —
                it is returned with <Code>programmeCount: 0</Code> and an empty programme list,
                because those are different facts and the API keeps them apart.
              </p>
              <p>
                Programmes here are summaries. For requirement prose, fetch{' '}
                <Code>/programmes/{'{id}'}</Code> for the one you are about to quote.
              </p>
            </Endpoint>

            <Endpoint spec={endpoint('/programmes')} id="endpoint-programmes">
              <ParamsTable
                rows={[
                  {
                    name: 'institutionId',
                    description: (
                      <>
                        An <Code>id</Code> from <Code>/institutions</Code>.
                      </>
                    ),
                  },
                  { name: 'state', description: 'Programmes at institutions in that state.' },
                  {
                    name: 'q',
                    description: (
                      <>
                        One contiguous, case-insensitive substring, matched against the programme
                        name <strong className="font-semibold">and</strong> the institution&rsquo;s
                        name. It is not tokenised: <Code>q=University of Lagos</Code> narrows to
                        that school and <Code>q=nursing</Code> finds Nursing programmes, but{' '}
                        <Code>q=UNILAG nursing</Code> matches nothing. Combine filters with
                        separate parameters — <Code>q=nursing&amp;state=Lagos</Code>.
                      </>
                    ),
                  },
                  {
                    name: 'subject',
                    description: (
                      <>
                        A subject <strong className="font-semibold">code</strong> from{' '}
                        <Code>/subjects</Code>, e.g. <Code>BIO</Code>. Not a name:{' '}
                        <Code>subject=Biology</Code> is a <Code>400</Code>.
                      </>
                    ),
                  },
                  {
                    name: 'limit, cursor',
                    description: (
                      <a href="#paging" className="font-medium text-primary underline underline-offset-2">
                        See Pagination
                      </a>
                    ),
                  },
                ]}
              />

              <CodeBlock
                label="Request"
                code={`curl -s -H "Authorization: Bearer $KEY" \\
  'https://<your-domain>${API_PATH}/programmes?institutionId=<institution-id>&subject=BIO&limit=5'`}
              />

              <CodeBlock
                label="200 OK"
                code={`{
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
}`}
              />

              <p>
                <Code>utmeSubjects</Code> is{' '}
                <strong className="font-semibold">as the brochure publishes it</strong> — names,
                not codes, and not mapped to the <Code>/subjects</Code> vocabulary. The brochure
                writes entries such as <Code>Government/History</Code> and{' '}
                <Code>Data Processing/Computer Studies</Code>, which have no code; folding the
                rest into codes would silently turn a four-subject combination into a
                three-subject one. Match on the labels loosely, or use the <Code>subject</Code>{' '}
                filter and let us do it.
              </p>
              <p>
                No requirement prose in a listing. That is deliberate: the prose is roughly 15KB
                of HTML per programme and a page of 30 search results renders none of it.
              </p>
              <p>
                <Code>reviewedCourseId</Code> is set only where the checker holds a reviewed
                course for the programme. That is rare — a handful of courses against twenty
                thousand programmes — so <Code>null</Code> is the ordinary case.{' '}
                <Code>ruleStatus</Code> says whether a requirement has been read: <Code>ready</Code>
                , <Code>no-source</Code> (reading was done and the brochure states none), or{' '}
                <Code>null</Code> (nobody has looked yet).
              </p>
            </Endpoint>

            <Endpoint spec={endpoint('/programmes/{id}')} id="endpoint-programme">
              <CodeBlock
                label="200 OK"
                code={`{
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
}`}
              />

              <p>
                Every prose field is the brochure&rsquo;s own words, quoted. <Code>sourceUrl</Code>{' '}
                is where they came from; cite it.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <Code>olevelRequirements: null</Code> means the brochure states none. It does{' '}
                  <strong className="font-semibold">not</strong> mean a requirement of nothing,
                  and it says nothing about any student.
                </li>
                <li>
                  <Code>checkerUrl</Code> is non-null only where the checker holds a reviewed
                  course. This is the correct next step to offer: quote the requirements, then
                  link here.
                </li>
                <li>
                  The id is stable and opaque: JAMB&rsquo;s own identifier for the programme,
                  namespaced with the institution&rsquo;s (
                  <Code>{'<institution-id>:<programme-id>'}</Code>). Take it from a response and
                  pass it back verbatim — do not construct one.
                </li>
              </ul>
            </Endpoint>

            <Endpoint spec={endpoint('/subjects')} id="endpoint-subjects">
              <p>The vocabulary, so you map what a student types the way this catalogue does.</p>

              <CodeBlock
                label="200 OK"
                code={`{
  "data": {
    "subjects": [
      { "code": "ENG", "name": "English Language" },
      { "code": "MTH", "name": "Mathematics" }
    ],
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
}`}
              />

              <p>
                <strong className="font-semibold">
                  Serve the grade table; do not infer your own.
                </strong>{' '}
                The rule that matters is <Code>credit</Code>:
              </p>

              <Table head={['Grades', 'Meaning']}>
                <tr className="border-t border-border align-top">
                  <td className="px-4 py-2.5 font-mono text-[0.875rem] whitespace-nowrap">
                    A1, B2, B3, C4, C5, C6
                  </td>
                  <td className="px-4 py-2.5 text-muted">
                    Credits — they satisfy a subject requirement
                  </td>
                </tr>
                <tr className="border-t border-border align-top">
                  <td className="px-4 py-2.5 font-mono text-[0.875rem] whitespace-nowrap">
                    D7, E8
                  </td>
                  <td className="px-4 py-2.5 text-muted">
                    Passes. <strong className="font-semibold text-foreground">They satisfy nothing.</strong>
                  </td>
                </tr>
                <tr className="border-t border-border align-top">
                  <td className="px-4 py-2.5 font-mono text-[0.875rem] whitespace-nowrap">F9</td>
                  <td className="px-4 py-2.5 text-muted">Fail</td>
                </tr>
              </Table>

              <p>
                Every eligibility mistake in this domain comes from treating a D7 or an E8 as a
                credit. <Code>credit</Code> here is the same function the eligibility engine
                decides with, so what you render and what the checker applies cannot come apart.
              </p>
              <p>
                <Code>alwaysRequired</Code> is English Language and Mathematics — the subjects no
                programme lets a student drop.
              </p>
              <p>
                Call this once at startup and cache it. It changes only when the app is deployed.
              </p>
            </Endpoint>

            <Endpoint spec={endpoint('/openapi.json')} id="endpoint-openapi">
              <p>
                The contract as an OpenAPI 3.1 document, with <Code>servers</Code> set to the
                address you reached it at.
              </p>

              <CodeBlock
                label="Generate a client"
                code={`curl -s -H "Authorization: Bearer $KEY" \\
  'https://<your-domain>${API_PATH}/openapi.json' > openapi.json
npx @redocly/cli lint openapi.json
npx openapi-typescript openapi.json -o ./catalogue.d.ts`}
              />
            </Endpoint>
          </section>

          <Section id="errors" title="Errors">
            <Table head={['Code', 'Status', 'Cause']}>
              {ERROR_ROWS.map((code) => (
                <tr key={code} className="border-t border-border align-top">
                  <td className="px-4 py-2.5 font-mono text-[0.875rem] whitespace-nowrap">
                    {code}
                  </td>
                  <td className="px-4 py-2.5 tabular">{ERROR_STATUS[code]}</td>
                  <td className="px-4 py-2.5 text-muted">{ERROR_CAUSE[code]}</td>
                </tr>
              ))}
            </Table>

            <p>
              <Code>unavailable</Code> is not a code to treat as fatal — the next request may well
              succeed.
            </p>
            <p>
              Messages are written for you, not for a student. Do not display them to a user;
              switch on <Code>code</Code> and write your own copy.
            </p>
            <p>
              The mapping is fixed API-wide, so <Code>bad_request</Code> never means 400 on one
              endpoint and 422 on another. A client switching on the code can rely on the status,
              and one switching on the status can rely on the code.
            </p>
          </Section>

          <Section id="rate-limits" title="Rate limits">
            <p>
              <strong className="font-semibold">
                {RATE_LIMIT.requests} requests per key per minute.
              </strong>
            </p>
            <p>
              Every authenticated response carries, so you can pace yourself instead of discovering
              the ceiling by being refused:
            </p>

            <CodeBlock
              label="Response headers"
              code={`X-RateLimit-Limit: ${RATE_LIMIT.requests}
X-RateLimit-Remaining: ${RATE_LIMIT.requests - 2}
X-RateLimit-Reset: 1760522400     # Unix seconds`}
            />

            <p>
              A <Code>429</Code> also carries <Code>Retry-After</Code> in seconds. Cache{' '}
              <Code>/subjects</Code> rather than re-fetching it.
            </p>
            <p>
              <strong className="font-semibold">
                Read this honestly: the limit is a runaway guard, not a metered quota.
              </strong>{' '}
              The handlers run on serverless instances, so the window lives in one instance&rsquo;s
              memory. Ten instances serve ten windows, and a cold start serves a fresh one. A
              caller over the limit on one instance can be under it on the next.
            </p>
            <p>
              Responses are <Code>Cache-Control: private</Code>, so{' '}
              <strong className="font-semibold">
                no shared cache sits between you and the database
              </strong>
              : a request that is not already in your own client&rsquo;s cache reaches a reader.
              That is deliberate (see{' '}
              <a href="#caching" className="font-medium text-primary underline underline-offset-2">
                Freshness and caching
              </a>
              ), but it means the rate limit really is the only brake. If you genuinely need a
              higher rate or a hard guarantee, say so and we will arrange it rather than have you
              discover the limit&rsquo;s edges.
            </p>
          </Section>

          <Section id="caching" title="Freshness and caching">
            <Table head={['Header', 'Value']}>
              <tr className="border-t border-border align-top">
                <td className="px-4 py-2.5 font-mono text-[0.875rem] whitespace-nowrap">
                  Cache-Control
                </td>
                <td className="px-4 py-2.5 text-muted">
                  <Code>private, max-age=300</Code>
                </td>
              </tr>
              <tr className="border-t border-border align-top">
                <td className="px-4 py-2.5 font-mono text-[0.875rem] whitespace-nowrap">Errors</td>
                <td className="px-4 py-2.5 text-muted">
                  <Code>no-store</Code>, always
                </td>
              </tr>
              <tr className="border-t border-border align-top">
                <td className="px-4 py-2.5 font-mono text-[0.875rem] whitespace-nowrap">
                  meta.generatedAt
                </td>
                <td className="px-4 py-2.5 text-muted">When this response was built</td>
              </tr>
              <tr className="border-t border-border align-top">
                <td className="px-4 py-2.5 font-mono text-[0.875rem] whitespace-nowrap">
                  lastUpdatedAt (/meta)
                </td>
                <td className="px-4 py-2.5 text-muted">
                  When the mirror was last taken from IBASS
                </td>
              </tr>
            </Table>

            <p>
              The catalogue itself moves when the scheduled IBASS sync runs, not when you request
              it, so a five-minute client-side cache costs you nothing.
            </p>
            <p>
              The header is <Code>private</Code> rather than <Code>public</Code> because every
              endpoint here requires a key. A shared cache keys on the URL alone — it cannot tell
              a request that presented one from a request that did not — so a publicly cached
              response would be handed to callers who never authenticated. Caching the response in
              your own client is both safe and supported; caching it in a CDN on our behalf is not
              something the API opts into.
            </p>
          </Section>

          <Section id="versioning" title="Versioning">
            <p>
              The version is in the path (<Code>{API_PATH}</Code>) and echoed in{' '}
              <Code>meta.apiVersion</Code>.
            </p>
            <p>
              Within v{API_VERSION},{' '}
              <strong className="font-semibold">additive change is expected</strong>: new fields
              may appear on any response, and new optional query parameters may be accepted. Write
              your client to ignore what it does not read. A field is only removed or repurposed
              under a new version in the path.
            </p>
            <p>
              When a breaking change is unavoidable, we will tell you before it ships, using the
              contact you gave us. Nothing in v{API_VERSION} will stop working without that
              notice.
            </p>
          </Section>

          <Section id="known-limits" title="Known limits">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="font-semibold">No verdict endpoint.</strong> By design; see{' '}
                <a href="#not" className="font-medium text-primary underline underline-offset-2">
                  above
                </a>
                .
              </li>
              <li>
                <strong className="font-semibold">No fees, deadlines, or portal screens.</strong>{' '}
                Deliberately excluded — they change per session and the app routes students to the
                official source instead.
              </li>
              <li>
                <strong className="font-semibold">Requirement prose on detail reads only.</strong>{' '}
                A listing carries the subject combination, not the prose. One extra request per
                programme you quote.
              </li>
              <li>
                <strong className="font-semibold">
                  <Code>reviewedCourseId</Code> is usually <Code>null</Code>.
                </strong>{' '}
                The checker has reviewed a small number of courses against a catalogue of twenty
                thousand programmes. A checker link is the exception, not the rule — offer it
                where it exists, the brochure URL everywhere else.
              </li>
              <li>
                <strong className="font-semibold">
                  <Code>total</Code> counts what the catalogue holds.
                </strong>{' '}
                It is not a count of places anyone will be admitted to.
              </li>
            </ul>
          </Section>

          <Section id="quick-start" title="Quick start">
            <p>
              Five calls, in order. Ids are opaque, so the script takes them from a response
              rather than inventing them.
            </p>

            <CodeBlock
              label="Quick start"
              code={`KEY='the-key-we-issued-you'
BASE='https://<your-domain>${API_PATH}'

# 1. size the catalogue
curl -s -H "Authorization: Bearer $KEY" "$BASE/meta" | jq '.data'

# 2. find a school and hold its id — ids are opaque, so take them from a response
INSTITUTION=$(curl -s -H "Authorization: Bearer $KEY" \\
  "$BASE/institutions?state=Lagos&limit=1" | jq -r '.data[0].id')

# 3. that school's programmes
curl -s -H "Authorization: Bearer $KEY" "$BASE/programmes?institutionId=$INSTITUTION&limit=5" \\
  | jq '.data[] | {id, name}'

# 4. read one in full, using an id from the previous response
PROGRAMME=$(curl -s -H "Authorization: Bearer $KEY" \\
  "$BASE/programmes?institutionId=$INSTITUTION&limit=1" | jq -r '.data[0].id')
curl -s -H "Authorization: Bearer $KEY" "$BASE/programmes/$PROGRAMME" | jq '.data'

# 5. the grade table you must not invent
curl -s -H "Authorization: Bearer $KEY" "$BASE/subjects" | jq '.data.grades'`}
            />
          </Section>

          <p className="mt-14 border-t border-border pt-6 text-[0.9375rem] leading-relaxed text-muted">
            Questions about this reference, or a limit you need raised? Reply to the email that
            carried your key and tell us what you are building.
          </p>
        </article>

        <aside className="hidden lg:block">
          <nav aria-label="On this page" className="sticky top-24">
            <p className="text-[0.75rem] font-semibold tracking-wider text-muted uppercase">
              On this page
            </p>
            <ul className="mt-3 space-y-1.5 border-l border-border">
              {TOC.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="-ml-px block border-l border-transparent py-0.5 pl-3 text-[0.875rem] text-muted transition-colors hover:border-primary hover:text-foreground"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </div>
  )
}
