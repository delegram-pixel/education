'use client'

import { RotateCcw } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error('[admission-copilot]', error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-16 text-center sm:px-6">
      <h1 className="text-[1.75rem]">Something went wrong at our end</h1>
      <p className="mt-3 text-[1.0625rem] leading-relaxed text-muted">
        Nothing you entered was lost or sent anywhere. Trying again usually works — and if it
        doesn&rsquo;t, a counselor can take your question directly.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>
          <RotateCcw aria-hidden className="size-4" />
          Try again
        </Button>
        <Button asChild variant="secondary">
          <Link href="/tickets/new">Ask a counselor instead</Link>
        </Button>
      </div>
      {error.digest ? (
        <p className="mt-6 text-[0.8125rem] text-muted">Reference: {error.digest}</p>
      ) : null}
    </div>
  )
}
