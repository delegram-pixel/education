import { ExternalLink, Info, Lock, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { EpinPurchase, Money, PurchaseChannel, Verification } from '@/lib/epin/types'
import { cn } from '@/lib/utils'

/**
 * Where to buy a JAMB e-PIN, and how much of each claim we are prepared to stand
 * behind.
 *
 * THE ENTIRE POINT OF THIS FILE IS `VerificationNote`. Every figure on this
 * panel came from somewhere we did not control and cannot vouch for — a price
 * set by JAMB, a shortcode set by JAMB, addresses owned by other people. The
 * data carries each one's confidence as a `Verification` value (see
 * `lib/epin/types.ts`), and the switch below renders that state *with* the
 * value, every time. There is deliberately no path that renders the amount
 * without the marker: the `never` check at the bottom makes adding a new
 * verification state a compile error rather than a silent omission.
 *
 * WHY THE ADDRESS IS SHOWN AS TEXT AS WELL AS A LINK. A lookalike domain is the
 * most common shape of this particular scam, and it defeats a hyperlink
 * completely — the link text can say anything while the target is
 * `jamb-epin-pay.com`. Printing the address next to the link, and telling the
 * student to compare it with their address bar, is the only part of that defence
 * a UI can actually offer.
 *
 * THIS COMPONENT COLLECTS NOTHING. No form, no field, no card number, no e-PIN.
 * That is not an oversight in the design — see the `neverAsk` list it renders,
 * which is a promise to the student rather than a policy note.
 */
export function PurchaseChannels({ purchase }: { purchase: EpinPurchase }) {
  return (
    <section
      aria-labelledby="purchase-heading"
      className="mt-6 rounded-lg border border-border bg-surface p-5 shadow-card sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 id="purchase-heading" className="text-[1.25rem]">
          Where to buy your e-PIN
        </h2>
        <Badge tone="warning">Unverified figures — confirm before you pay</Badge>
      </div>

      <p className="mt-2.5 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">
        You buy the e-PIN yourself, on the official channel, with your own card. This app takes no
        payment, holds no card details and never sees your PIN.
      </p>

      {/* Price and the other drifting facts, each rendered through its own state. */}
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <FactRow label="JAMB e-PIN price" value={formatMoney(purchase.price)} verification={purchase.price.verification} />
        {purchase.facts.map((fact) => (
          <FactRow key={fact.id} label={fact.label} value={fact.value} verification={fact.verification} />
        ))}
      </dl>

      {/* Channels */}
      <h3 className="mt-7 text-[1.0625rem] font-semibold">Channels</h3>
      <p className="mt-1.5 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">
        Open the channel yourself — type the address or use the link here. Never use a link that
        arrived by message, whatever it says it is.
      </p>

      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {purchase.channels.map((channel) => (
          <ChannelCard key={channel.id} channel={channel} />
        ))}
      </ul>

      {/* The promise. Worth its own visual weight: it is the thing a student can
          hold us to if something asks them for more than they expected. */}
      <div className="mt-7 rounded-lg border border-border bg-sunken px-5 py-4">
        <h3 className="flex items-center gap-2 text-[0.9375rem] font-semibold">
          <Lock aria-hidden className="size-4 shrink-0 text-primary" />
          What we will never ask you for
        </h3>
        <ul className="mt-2.5 space-y-1.5 text-[0.875rem] leading-relaxed text-muted">
          {purchase.neverAsk.map((item) => (
            <li key={item} className="flex gap-2.5">
              <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */

function FactRow({
  label,
  value,
  verification,
}: {
  label: string
  value: string
  verification: Verification
}) {
  return (
    <div className="rounded-lg border border-border bg-sunken px-4 py-3">
      <dt className="text-[0.8125rem] text-muted">{label}</dt>
      <dd className="tabular mt-0.5 font-display text-[1.25rem] font-semibold tracking-tight">
        {verification.status === 'withheld' ? (
          <span className="text-[1rem] font-medium text-muted">Not stated</span>
        ) : (
          value
        )}
      </dd>
      <dd className="mt-2">
        <VerificationNote verification={verification} />
      </dd>
    </div>
  )
}

/**
 * The single place a verification state becomes words.
 *
 * Note what `withheld` does NOT render: `reason` is written for the next
 * developer ("the current bulletin could not be read"), and saying that to a
 * student would be an excuse rather than an answer. They get told the fact is not
 * stated and where to find it instead.
 */
function VerificationNote({ verification }: { verification: Verification }) {
  switch (verification.status) {
    case 'verified':
      return (
        <p className="flex flex-wrap items-center gap-1.5 text-[0.8125rem] leading-relaxed text-muted">
          <Badge tone="success" className="px-2 py-0.5 text-[0.6875rem]">
            Confirmed
          </Badge>
          <span>
            Read on {verification.checkedOn} at{' '}
            <a
              href={verification.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              the official source
            </a>
            .
          </span>
        </p>
      )

    case 'unverified':
      return (
        <p className="flex flex-wrap items-start gap-1.5 text-[0.8125rem] leading-relaxed text-muted">
          <Badge tone="warning" className="px-2 py-0.5 text-[0.6875rem]">
            Unverified
          </Badge>
          <span>{verification.note}</span>
        </p>
      )

    case 'withheld':
      return (
        <p className="flex flex-wrap items-center gap-1.5 text-[0.8125rem] leading-relaxed text-muted">
          <Badge tone="outline" className="px-2 py-0.5 text-[0.6875rem]">
            Not stated
          </Badge>
          <span>We do not publish a figure for this. Check it on the official channel.</span>
        </p>
      )

    default: {
      // If a new verification state is ever added to the union, this line stops
      // compiling — which is the behaviour we want, because the alternative is a
      // value rendered as though it were confirmed.
      const exhaustive: never = verification
      return exhaustive
    }
  }
}

function ChannelCard({ channel }: { channel: PurchaseChannel }) {
  return (
    <li className="flex flex-col rounded-lg border border-border bg-sunken p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-[1rem] font-semibold">{channel.name}</h4>
        <OfficialBadge official={channel.official} />
      </div>

      <p className="mt-1.5 flex items-start gap-1.5 text-[0.8125rem] leading-relaxed text-muted">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        <span>Operated by {channel.operator}.</span>
      </p>

      {/* The address as text, so it can be compared with the browser bar. */}
      <p className="tabular mt-3 break-all rounded-md border border-border bg-surface px-2.5 py-1.5 text-[0.8125rem] text-foreground">
        {channel.url}
      </p>

      <a
        href={channel.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'group mt-2 inline-flex items-center gap-1.5 self-start text-[0.875rem] font-medium',
          'text-primary underline-offset-4 hover:underline',
        )}
      >
        Open {channel.name}
        <ExternalLink aria-hidden className="size-3.5" />
      </a>

      <ul className="mt-3 space-y-1.5 text-[0.8125rem] leading-relaxed text-muted">
        {channel.notes.map((note) => (
          <li key={note} className="flex gap-2">
            <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" />
            <span>{note}</span>
          </li>
        ))}
      </ul>
    </li>
  )
}

/**
 * `official` is a three-state answer, and the middle one is the honest one here.
 * We know VTpass is a private company reselling the PIN; we do not know whether
 * JAMB names it. Collapsing that to a boolean would either accuse a legitimate
 * channel or vouch for one we have not checked.
 */
function OfficialBadge({ official }: { official: PurchaseChannel['official'] }) {
  if (official === true) {
    return (
      <Badge tone="success" className="px-2 py-0.5 text-[0.6875rem]">
        Named by JAMB
      </Badge>
    )
  }

  if (official === false) {
    return (
      <Badge tone="outline" className="px-2 py-0.5 text-[0.6875rem]">
        Not a JAMB service
      </Badge>
    )
  }

  return (
    <Badge tone="outline" className="px-2 py-0.5 text-[0.6875rem]">
      Reseller — not confirmed as a JAMB channel
    </Badge>
  )
}

function formatMoney(money: Money): string {
  return `₦${money.amountNaira.toLocaleString('en-NG')}`
}
