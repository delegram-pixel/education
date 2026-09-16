import Link from 'next/link'

import { Arrow, Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-16 text-center sm:px-6">
      <p className="font-display text-[3.5rem] font-bold leading-none text-primary/15">404</p>
      <h1 className="mt-4 text-[1.75rem]">We couldn&rsquo;t find that page</h1>
      <p className="mt-3 text-[1.0625rem] leading-relaxed text-muted">
        The link may be old, or the result it pointed to may have expired. Starting a fresh check
        takes about two minutes.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button asChild className="group">
          <Link href="/check">
            Check my eligibility
            <Arrow />
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">Go to the homepage</Link>
        </Button>
      </div>
    </div>
  )
}
