'use client'

import { Maximize2 } from 'lucide-react'
import * as React from 'react'

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import type { Hotspot } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * A screenshot with the thing you are meant to click marked on it.
 *
 * The annotation is drawn from percentage coordinates rather than baked into
 * the image, which means a replaced screenshot keeps its annotation and a new
 * step needs no design work — only four numbers.
 *
 * The dimming is one element, not four: a box-shadow with a 9999px spread
 * darkens everything outside the hotspot rectangle in a single paint, so the
 * "hole" stays perfectly aligned with the ring at any size.
 *
 * A plain <img> is used rather than next/image because these are SVG wireframe
 * placeholders, and routing SVG through the image optimiser needs a global
 * `dangerouslyAllowSVG`. The aspect-ratio box below reserves the space, so
 * there is no layout shift either way, and swapping in real PNG captures later
 * is a one-line change.
 */
export function AnnotatedShot({
  src,
  alt,
  hotspot,
  stepNumber,
}: {
  src: string
  alt: string
  hotspot: Hotspot | null
  stepNumber: number
}) {
  const [loaded, setLoaded] = React.useState(false)
  const [failed, setFailed] = React.useState(false)

  const wireframe = <IllustrativeWireframe label={alt} />

  const figure = (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-md border border-border bg-sunken">
      {!loaded && !failed ? <div className="skeleton absolute inset-0" /> : null}

      {failed ? (
        wireframe
      ) : (
        <img
          src={src}
          alt={alt}
          width={1280}
          height={800}
          loading={stepNumber === 1 ? 'eager' : 'lazy'}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setFailed(true)
            setLoaded(true)
          }}
          className={cn(
            'size-full object-cover transition-opacity duration-500',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}

      {hotspot ? (
        <div
          aria-hidden
          className={cn(
            'animate-halo absolute rounded-[0.35rem] border-2 border-accent',
            'transition-opacity duration-700',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
          style={{
            left: `${hotspot.x}%`,
            top: `${hotspot.y}%`,
            width: `${hotspot.w}%`,
            height: `${hotspot.h}%`,
            // Everything outside this rectangle is dimmed by the spread.
            boxShadow: '0 0 0 9999px rgb(28 25 23 / 0.42)',
          }}
        />
      ) : null}
    </div>
  )

  return (
    <Dialog>
      <div className="group relative">
        {figure}
        <DialogTrigger
          className={cn(
            'absolute right-3 top-3 flex items-center gap-1.5 rounded-sm',
            'bg-foreground/70 px-2.5 py-1.5 text-[0.8125rem] text-background backdrop-blur-sm',
            'opacity-0 transition-opacity duration-200 focus-visible:opacity-100 group-hover:opacity-100',
          )}
        >
          <Maximize2 aria-hidden className="size-3.5" />
          Enlarge
        </DialogTrigger>
      </div>

      <DialogContent bare>
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-lifted">
          <div className="relative">
            {failed ? wireframe : <img src={src} alt={alt} width={1280} height={800} className="w-full" />}
            {hotspot ? (
              <div
                aria-hidden
                className="animate-halo absolute rounded-[0.35rem] border-2 border-accent"
                style={{
                  left: `${hotspot.x}%`,
                  top: `${hotspot.y}%`,
                  width: `${hotspot.w}%`,
                  height: `${hotspot.h}%`,
                  boxShadow: '0 0 0 9999px rgb(28 25 23 / 0.5)',
                }}
              />
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * A graceful local replacement for a guide image that has not been supplied
 * yet. It prevents a broken-image icon from becoming part of the student
 * experience while still making it unmistakable that this is an illustration,
 * not the live admissions portal.
 */
function IllustrativeWireframe({ label }: { label: string }) {
  const title = label.replace(/^Step \d+: /, '')

  return (
    <div
      role="img"
      aria-label={label}
      className="grid size-full place-items-center bg-[#f5f5f0] p-[8%] text-[#242a18]"
    >
      <div className="w-full overflow-hidden rounded-lg border border-[#d9d9d1] bg-white shadow-sm">
        <div className="flex h-10 items-center gap-2 border-b border-[#d9d9d1] bg-[#fafaf6] px-4">
          <span className="size-2 rounded-full bg-[#d6d6cf]" />
          <span className="size-2 rounded-full bg-[#d6d6cf]" />
          <span className="size-2 rounded-full bg-[#d6d6cf]" />
          <span className="ml-3 rounded bg-[#eeeeE8] px-3 py-1 text-[0.625rem] text-[#77776f]">
            Illustrative registration screen
          </span>
        </div>
        <div className="bg-[#242a18] px-7 py-4 text-sm font-semibold text-white">Registration</div>
        <div className="p-7 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#77776f]">Current step</p>
          <h3 className="mt-2 text-xl font-semibold sm:text-2xl">{title}</h3>
          <div className="mt-6 rounded-md border border-[#cbc889] bg-[#f7f5da] p-4 sm:p-5">
            <p className="text-sm font-semibold">Follow the instruction shown on the official portal.</p>
            <p className="mt-2 text-xs leading-relaxed text-[#5f5f58]">
              This illustrative panel marks the part of the screen to check before continuing.
            </p>
          </div>
          <div className="mt-6 h-10 w-36 rounded-md bg-[#242a18]" />
        </div>
      </div>
    </div>
  )
}
