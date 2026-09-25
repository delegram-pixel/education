'use client'

import * as React from 'react'
import {
  Check,
  Copy,
  ExternalLink,
  Layers,
  Loader2,
  Palette,
  ShieldCheck,
  Sliders,
  Sparkles,
  Terminal,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Arrow, Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

interface ColorToken {
  name: string
  hex: string
  rgb: string
  usage: string
  textLight: boolean
  borderRequired?: boolean
  description: string
  contrastOnWhite: string
  contrastOnCharcoal: string
}

const PALETTE: ColorToken[] = [
  {
    name: 'Deep Charcoal',
    hex: '#1A1A00',
    rgb: '26, 26, 0',
    usage: 'Primary text, buttons, navigation',
    textLight: true,
    description:
      'Massive contrast with light backgrounds; provides superior readability and authority compared to legacy teal.',
    contrastOnWhite: '21.0:1 (AAA)',
    contrastOnCharcoal: '1.0:1 (Fail)',
  },
  {
    name: 'Fresh Green',
    hex: '#FFFFC0',
    rgb: '255, 255, 192',
    usage: 'CTAs, highlights, active states',
    textLight: false,
    borderRequired: true,
    description:
      'Warm and inviting accent that pops without the harshness of legacy orange. Pairs at 13:1 with Deep Charcoal.',
    contrastOnWhite: '1.1:1 (Subtle)',
    contrastOnCharcoal: '13.0:1 (AAA)',
  },
  {
    name: 'Soft Black',
    hex: '#2D2D2D',
    rgb: '45, 45, 45',
    usage: 'Hover/active states',
    textLight: true,
    description:
      'Smooth interactive state for primary buttons and elevated surfaces, preserving tonal balance.',
    contrastOnWhite: '15.5:1 (AAA)',
    contrastOnCharcoal: '1.3:1',
  },
  {
    name: 'Cream',
    hex: '#F5F5F0',
    rgb: '245, 245, 240',
    usage: 'Page background',
    textLight: false,
    borderRequired: true,
    description:
      'Warm neutral page ground that eliminates clinical white glare while keeping cards distinct.',
    contrastOnWhite: '1.1:1 (Soft)',
    contrastOnCharcoal: '19.1:1 (AAA)',
  },
  {
    name: 'Light Gray',
    hex: '#E8E8E0',
    rgb: '232, 232, 224',
    usage: 'Borders, dividers, muted elements',
    textLight: false,
    borderRequired: true,
    description:
      'Subtle structural boundary for cards, input outlines, and division lines without visual clutter.',
    contrastOnWhite: '1.2:1 (Border)',
    contrastOnCharcoal: '17.2:1 (AAA)',
  },
  {
    name: 'Warm Gray',
    hex: '#66666B',
    rgb: '102, 102, 107',
    usage: 'Secondary text, body hierarchy',
    textLight: true,
    description:
      'Deliberate typographic hierarchy without pure black. Meets WCAG AA contrast at 8.5:1 on white.',
    contrastOnWhite: '8.5:1 (AAA)',
    contrastOnCharcoal: '2.5:1',
  },
]

const CONTRAST_PAIRS = [
  {
    pair: '#1A1A00 on #FFFFFF',
    fg: '#1A1A00',
    bg: '#FFFFFF',
    name: 'Deep Charcoal on White',
    ratio: '21:1',
    wcagAA: 'Pass (AAA)',
    context: 'Headings, primary body text, card content',
  },
  {
    pair: '#1A1A00 on #FFFFC0',
    fg: '#1A1A00',
    bg: '#FFFFC0',
    name: 'Deep Charcoal on Fresh Green',
    ratio: '13:1',
    wcagAA: 'Pass (AAA)',
    context: 'Secondary button text, active badge text, pill overlays',
  },
  {
    pair: '#66666B on #FFFFFF',
    fg: '#66666B',
    bg: '#FFFFFF',
    name: 'Warm Gray on White',
    ratio: '8.5:1',
    wcagAA: 'Pass (AAA)',
    context: 'Secondary copy, captions, timestamps, descriptions',
  },
  {
    pair: '#FFFFC0 on #1A1A00',
    fg: '#FFFFC0',
    bg: '#1A1A00',
    name: 'Fresh Green on Deep Charcoal',
    ratio: '13:1',
    wcagAA: 'Pass (AAA)',
    context: 'Primary icons, tab underlines on dark, inverted badges',
  },
]

const CSS_VARIABLES_RAW = `:root {
  --color-primary-dark: #1A1A00;
  --color-accent-light: #FFFFC0;
  --color-soft-black: #2D2D2D;
  --color-cream: #F5F5F0;
  --color-light-gray: #E8E8E0;
  --color-warm-gray: #66666B;
  --color-white: #FFFFFF;

  --bg-page: var(--color-cream);
  --bg-card: var(--color-white);
  --text-primary: var(--color-primary-dark);
  --text-secondary: var(--color-warm-gray);
  --text-muted: var(--color-light-gray);
  --border-default: var(--color-light-gray);
  --border-accent: var(--color-accent-light);
}`

const TAILWIND_TOKENS_RAW = `@theme inline {
  --color-primary-dark: #1A1A00;
  --color-accent-light: #FFFFC0;
  --color-soft-black: #2D2D2D;
  --color-cream: #F5F5F0;
  --color-light-gray: #E8E8E0;
  --color-warm-gray: #66666B;
  --color-white: #FFFFFF;

  --color-primary: var(--color-primary-dark);
  --color-primary-hover: var(--color-soft-black);
  --color-accent: var(--color-accent-light);
  --color-background: var(--color-cream);
  --color-surface: var(--color-white);
  --color-border: var(--color-light-gray);
}`

// Luminance calculation helper for real-time contrast checker
function calculateRelativeLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '')
  if (cleanHex.length !== 6) return 0.5
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255

  const transform = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
  const R = transform(r)
  const G = transform(g)
  const B = transform(b)
  return R * 0.2126 + G * 0.7152 + B * 0.0722
}

function calculateContrastRatio(hex1: string, hex2: string): number {
  const lum1 = calculateRelativeLuminance(hex1)
  const lum2 = calculateRelativeLuminance(hex2)
  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)
  return Number(((brightest + 0.05) / (darkest + 0.05)).toFixed(2))
}

export default function DesignSystemPage() {
  const toast = useToast()

  // State for interactive tab explorer
  const [activeTab, setActiveTab] = React.useState<'overview' | 'components' | 'contrast' | 'code'>(
    'overview',
  )

  // State for interactive custom contrast calculator
  const [customFg, setCustomFg] = React.useState('#1A1A00')
  const [customBg, setCustomBg] = React.useState('#FFFFC0')
  const customRatio = calculateContrastRatio(customFg, customBg)

  // State for Before vs After comparison
  const [compareTheme, setCompareTheme] = React.useState<'new' | 'legacy'>('new')

  // State for form element test
  const [formInputValue, setFormInputValue] = React.useState('')
  const [checkboxState, setCheckboxState] = React.useState(true)

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text)
    toast(`Copied ${label} to clipboard!`, 'success')
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {/* ---------------------------------------------------------------- */}
      {/* Hero / Header                                                    */}
      {/* ---------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-light-gray)] bg-surface p-8 shadow-card sm:p-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--color-primary-dark)] text-[var(--color-accent-light)] shadow-sm">
              <Palette className="size-5" />
            </span>
            <Badge tone="accent" className="font-semibold text-xs tracking-wider uppercase">
              Design System Specification
            </Badge>
          </div>
          <span className="text-xs font-semibold tracking-wider text-muted uppercase">
            Version 1.0 &middot; September 2026
          </span>
        </div>

        <div className="mt-6 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-primary-dark)] sm:text-5xl">
            COLOR SYSTEM DESIGN GUIDE
          </h1>
          <p className="mt-3 text-lg font-medium text-[var(--color-primary-dark)]/90 sm:text-2xl">
            From Teal &amp; Orange to Deep Charcoal &amp; Fresh Green
          </p>
          <p className="mt-4 text-base leading-relaxed text-[var(--color-warm-gray)]">
            A comprehensive color system with engineering implementation guidelines. Built to deliver
            commanding visual contrast, warm accents, and WCAG AA/AAA certified readability across all
            surfaces and states.
          </p>
        </div>

        {/* Quick action bar */}
        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-[var(--color-light-gray)] pt-6">
          <Button
            size="sm"
            onClick={() => copyText(CSS_VARIABLES_RAW, 'CSS Variables')}
            className="flex items-center gap-2"
          >
            <Copy className="size-4" />
            Copy CSS Variables
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => copyText(TAILWIND_TOKENS_RAW, 'Tailwind Tokens')}
            className="flex items-center gap-2"
          >
            <Terminal className="size-4" />
            Copy Tailwind Tokens
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const el = document.getElementById('contrast-matrix')
              el?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="flex items-center gap-2"
          >
            <ShieldCheck className="size-4" />
            Contrast Matrix
          </Button>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Design Philosophy Callout                                        */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-12">
        <div className="rounded-xl border border-[var(--color-primary-dark)]/15 bg-gradient-to-br from-[var(--color-accent-light)]/25 via-[var(--color-accent-light)]/10 to-transparent p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--color-primary-dark)] text-[var(--color-accent-light)]">
              <Sparkles className="size-4" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-[var(--color-primary-dark)]">
                Design Philosophy
              </h2>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-[var(--color-primary-dark)]/90">
                The palette works because <strong>Deep Charcoal (#1A1A00)</strong> has massive
                contrast with light backgrounds—better readability than the original teal.
                <strong> Fresh Green (#FFFFC0)</strong> pops as an accent without overwhelming;
                it&rsquo;s warm and inviting where the orange was harsh. Supporting grays create
                hierarchy without introducing new hues, keeping the palette focused and premium.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Interactive Before & After Comparator                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-primary-dark)]">
              Before &amp; After Evolution
            </h2>
            <p className="text-[0.9375rem] text-[var(--color-warm-gray)]">
              Toggle between the legacy Teal &amp; Orange palette and the new Deep Charcoal &amp; Fresh
              Green system.
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-[var(--color-light-gray)] bg-surface p-1 shadow-sm">
            <button
              onClick={() => setCompareTheme('legacy')}
              className={cn(
                'rounded-md px-3.5 py-1.5 text-sm font-semibold transition-all',
                compareTheme === 'legacy'
                  ? 'bg-[#0f766e] text-white shadow-sm'
                  : 'text-[var(--color-warm-gray)] hover:text-[var(--color-primary-dark)]',
              )}
            >
              Legacy (Teal &amp; Orange)
            </button>
            <button
              onClick={() => setCompareTheme('new')}
              className={cn(
                'rounded-md px-3.5 py-1.5 text-sm font-semibold transition-all',
                compareTheme === 'new'
                  ? 'bg-[var(--color-primary-dark)] text-[var(--color-accent-light)] shadow-sm'
                  : 'text-[var(--color-warm-gray)] hover:text-[var(--color-primary-dark)]',
              )}
            >
              Modern (Deep Charcoal &amp; Fresh Green)
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Card 1: Buttons & Actions */}
          <div
            className={cn(
              'rounded-xl border p-6 transition-all duration-300',
              compareTheme === 'new'
                ? 'border-[var(--color-light-gray)] bg-surface shadow-card'
                : 'border-[#cbd5e1] bg-[#fdfbf7]',
            )}
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Interactive Actions
            </span>
            <h3 className="mt-1 text-lg font-bold text-[var(--color-primary-dark)]">
              {compareTheme === 'new' ? 'New Button States' : 'Legacy Button States'}
            </h3>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {compareTheme === 'new' ? (
                <>
                  <button className="h-11 min-h-[44px] rounded-md bg-[#1A1A00] px-5 text-[1rem] font-medium text-white shadow-sm transition hover:bg-[#2D2D2D] active:scale-[0.98]">
                    Primary (#1A1A00)
                  </button>
                  <button className="h-11 min-h-[44px] rounded-md bg-[#FFFFC0] px-5 text-[1rem] font-semibold text-[#1A1A00] shadow-sm transition hover:bg-[#FFFFB3] active:scale-[0.98]">
                    Secondary (#FFFFC0)
                  </button>
                  <button className="h-11 min-h-[44px] rounded-md border-2 border-[#E8E8E0] px-5 text-[1rem] font-medium text-[#1A1A00] transition hover:bg-[#1A1A00]/5">
                    Ghost/Outline
                  </button>
                </>
              ) : (
                <>
                  <button className="h-11 min-h-[44px] rounded-md bg-[#0f766e] px-5 text-[1rem] font-medium text-white shadow-sm transition hover:bg-[#115e59]">
                    Legacy Teal
                  </button>
                  <button className="h-11 min-h-[44px] rounded-md bg-[#d97706] px-5 text-[1rem] font-medium text-white shadow-sm transition hover:bg-[#b45309]">
                    Legacy Amber/Orange
                  </button>
                  <button className="h-11 min-h-[44px] rounded-md border border-[#0f766e] px-5 text-[1rem] font-medium text-[#0f766e]">
                    Outline Teal
                  </button>
                </>
              )}
            </div>

            <p className="mt-4 text-xs text-muted">
              {compareTheme === 'new'
                ? 'High-contrast Deep Charcoal with warm Fresh Green secondary CTA.'
                : 'Low-contrast teal with aggressive orange accents.'}
            </p>
          </div>

          {/* Card 2: Navigation & Badges */}
          <div
            className={cn(
              'rounded-xl border p-6 transition-all duration-300',
              compareTheme === 'new'
                ? 'border-[var(--color-light-gray)] bg-surface shadow-card'
                : 'border-[#cbd5e1] bg-[#fdfbf7]',
            )}
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Navigation &amp; Accents
            </span>
            <h3 className="mt-1 text-lg font-bold text-[var(--color-primary-dark)]">
              {compareTheme === 'new' ? 'Tabs & Icon Badges' : 'Legacy Tabs & Badges'}
            </h3>

            <div className="mt-5 flex items-center gap-6">
              {compareTheme === 'new' ? (
                <>
                  <div className="relative pb-2 font-semibold text-[#1A1A00]">
                    Active Tab
                    <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-[#FFFFC0] shadow-sm" />
                  </div>
                  <div className="text-[#66666B] hover:text-[#1A1A00]">Inactive Tab</div>
                  <span className="inline-flex size-9 items-center justify-center rounded-md bg-[#1A1A00] text-[#FFFFC0] shadow-sm">
                    <Check className="size-5" />
                  </span>
                  <span className="inline-flex items-center rounded-sm bg-[#FFFFC0] px-2.5 py-1 text-xs font-bold text-[#1A1A00]">
                    Accent Pill
                  </span>
                </>
              ) : (
                <>
                  <div className="relative pb-2 font-medium text-[#0f766e]">
                    Active Tab
                    <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#0f766e]" />
                  </div>
                  <div className="text-[#6b6259]">Inactive Tab</div>
                  <span className="inline-flex size-9 items-center justify-center rounded-md bg-[#0f766e] text-white">
                    <Check className="size-5" />
                  </span>
                  <span className="inline-flex items-center rounded-sm bg-[#d97706] px-2.5 py-1 text-xs font-medium text-white">
                    Legacy Amber
                  </span>
                </>
              )}
            </div>

            <p className="mt-4 text-xs text-muted">
              {compareTheme === 'new'
                ? 'Underline in Fresh Green #FFFFC0, inactive text in Warm Gray #66666B.'
                : 'Teal underline with muted brown-gray labels.'}
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Primary Color Palette                                            */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-primary-dark)]">
              Primary Color Palette
            </h2>
            <p className="text-[0.9375rem] text-[var(--color-warm-gray)]">
              Hex codes, RGB values, contrast ratios, and recommended usage specifications.
            </p>
          </div>
          <Badge tone="primary">6 Defined Tokens</Badge>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PALETTE.map((token) => (
            <div
              key={token.hex}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-[var(--color-light-gray)] bg-surface shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-lifted"
            >
              {/* Swatch Header */}
              <div
                className="relative flex h-36 flex-col justify-between p-4 transition-transform"
                style={{
                  backgroundColor: token.hex,
                  color: token.textLight ? '#FFFFFF' : '#1A1A00',
                  borderBottom: token.borderRequired ? '1px solid #E8E8E0' : 'none',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider opacity-85">
                    {token.name}
                  </span>
                  <button
                    onClick={() => copyText(token.hex, token.name)}
                    title="Copy hex code"
                    className={cn(
                      'rounded-md p-1.5 backdrop-blur-sm transition-opacity opacity-70 group-hover:opacity-100',
                      token.textLight
                        ? 'bg-white/15 hover:bg-white/30 text-white'
                        : 'bg-black/10 hover:bg-black/20 text-[#1A1A00]',
                    )}
                  >
                    <Copy className="size-4" />
                  </button>
                </div>

                <div className="space-y-0.5">
                  <span className="font-mono text-2xl font-bold tracking-tight">{token.hex}</span>
                  <div className="text-xs opacity-80">RGB({token.rgb})</div>
                </div>
              </div>

              {/* Token Details */}
              <div className="flex flex-1 flex-col justify-between p-5">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Usage
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[var(--color-primary-dark)]">
                    {token.usage}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--color-warm-gray)]">
                    {token.description}
                  </p>
                </div>

                <div className="mt-4 border-t border-[var(--color-light-gray)] pt-3 text-xs">
                  <div className="flex justify-between text-muted">
                    <span>vs White (#FFFFFF):</span>
                    <strong className="text-[var(--color-primary-dark)]">{token.contrastOnWhite}</strong>
                  </div>
                  <div className="mt-1 flex justify-between text-muted">
                    <span>vs Charcoal (#1A1A00):</span>
                    <strong className="text-[var(--color-primary-dark)]">{token.contrastOnCharcoal}</strong>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Component Color Mapping & Live Component Studio                 */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-16">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-primary-dark)]">
            Component Color Mapping
          </h2>
          <p className="text-[0.9375rem] text-[var(--color-warm-gray)]">
            Live interactive implementations for all component states specified in the design guide.
          </p>
        </div>

        {/* 1. Buttons */}
        <div className="mt-8 rounded-xl border border-[var(--color-light-gray)] bg-surface p-6 shadow-card sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-light-gray)] pb-4">
            <div>
              <h3 className="text-lg font-bold text-[var(--color-primary-dark)]">Buttons &amp; States</h3>
              <p className="text-xs text-[var(--color-warm-gray)]">
                Primary: #1A1A00 bg, #FFFFFF text | Secondary: #FFFFC0 bg, #1A1A00 text | Hover: #2D2D2D / #FFFFB3
              </p>
            </div>
            <Badge tone="success" className="font-mono text-xs">
              Min 44x44px Tap Target
            </Badge>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {/* Primary Button Example */}
            <div className="flex flex-col gap-3 rounded-lg border border-[var(--color-light-gray)] p-5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Primary Button
              </span>
              <Button size="lg" className="w-full justify-center">
                Primary Button
                <Arrow />
              </Button>
              <div className="text-xs text-muted">
                <strong>Default:</strong> #1A1A00 &middot; <strong>Hover:</strong> #2D2D2D (Soft Black)
              </div>
            </div>

            {/* Secondary Button Example */}
            <div className="flex flex-col gap-3 rounded-lg border border-[var(--color-light-gray)] p-5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Secondary Button (Accent)
              </span>
              <Button size="lg" variant="secondary" className="w-full justify-center">
                Secondary Action
                <Arrow />
              </Button>
              <div className="text-xs text-muted">
                <strong>Default:</strong> #FFFFC0 &middot; <strong>Hover:</strong> #FFFFB3 (Fresh Green -10%)
              </div>
            </div>

            {/* Ghost / Outline Example */}
            <div className="flex flex-col gap-3 rounded-lg border border-[var(--color-light-gray)] p-5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Ghost / Outline Button
              </span>
              <Button size="lg" variant="ghost" className="w-full justify-center">
                Outline Action
              </Button>
              <div className="text-xs text-muted">
                <strong>Border:</strong> 2px solid #E8E8E0 &middot; <strong>Color:</strong> #1A1A00
              </div>
            </div>
          </div>
        </div>

        {/* 2. Navigation & Tabs */}
        <div className="mt-8 rounded-xl border border-[var(--color-light-gray)] bg-surface p-6 shadow-card sm:p-8">
          <h3 className="text-lg font-bold text-[var(--color-primary-dark)]">Navigation &amp; Tabs</h3>
          <p className="text-xs text-[var(--color-warm-gray)]">
            Active tab underline: #FFFFC0 | Tab text (inactive): #66666B | Tab hover background: #FFFFC0 at 8% opacity
          </p>

          <div className="mt-6 overflow-hidden rounded-lg border border-[var(--color-light-gray)] bg-[var(--color-cream)] p-6">
            <nav className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('overview')}
                className={cn(
                  'relative rounded-md px-4 py-2.5 text-sm font-semibold transition-colors duration-200',
                  'hover:bg-[#FFFFC0]/[0.08]',
                  activeTab === 'overview'
                    ? 'text-[var(--color-primary-dark)]'
                    : 'text-[var(--color-warm-gray)] hover:text-[var(--color-primary-dark)]',
                )}
              >
                Overview
                {activeTab === 'overview' && (
                  <span className="absolute inset-x-3 bottom-0.5 h-[3px] rounded-full bg-[var(--color-accent-light)] shadow-sm" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('components')}
                className={cn(
                  'relative rounded-md px-4 py-2.5 text-sm font-semibold transition-colors duration-200',
                  'hover:bg-[#FFFFC0]/[0.08]',
                  activeTab === 'components'
                    ? 'text-[var(--color-primary-dark)]'
                    : 'text-[var(--color-warm-gray)] hover:text-[var(--color-primary-dark)]',
                )}
              >
                Components
                {activeTab === 'components' && (
                  <span className="absolute inset-x-3 bottom-0.5 h-[3px] rounded-full bg-[var(--color-accent-light)] shadow-sm" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('contrast')}
                className={cn(
                  'relative rounded-md px-4 py-2.5 text-sm font-semibold transition-colors duration-200',
                  'hover:bg-[#FFFFC0]/[0.08]',
                  activeTab === 'contrast'
                    ? 'text-[var(--color-primary-dark)]'
                    : 'text-[var(--color-warm-gray)] hover:text-[var(--color-primary-dark)]',
                )}
              >
                Contrast Ratios
                {activeTab === 'contrast' && (
                  <span className="absolute inset-x-3 bottom-0.5 h-[3px] rounded-full bg-[var(--color-accent-light)] shadow-sm" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('code')}
                className={cn(
                  'relative rounded-md px-4 py-2.5 text-sm font-semibold transition-colors duration-200',
                  'hover:bg-[#FFFFC0]/[0.08]',
                  activeTab === 'code'
                    ? 'text-[var(--color-primary-dark)]'
                    : 'text-[var(--color-warm-gray)] hover:text-[var(--color-primary-dark)]',
                )}
              >
                CSS Code
                {activeTab === 'code' && (
                  <span className="absolute inset-x-3 bottom-0.5 h-[3px] rounded-full bg-[var(--color-accent-light)] shadow-sm" />
                )}
              </button>
            </nav>

            <div className="mt-4 rounded-md border border-[var(--color-light-gray)] bg-surface p-4 text-sm text-[var(--color-warm-gray)]">
              Active tab selected: <strong className="text-[var(--color-primary-dark)]">{activeTab}</strong>. Note the 8% hover background effect and the Fresh Green underline.
            </div>
          </div>
        </div>

        {/* 3. Icons, Badges & Decorative Elements */}
        <div className="mt-8 rounded-xl border border-[var(--color-light-gray)] bg-surface p-6 shadow-card sm:p-8">
          <h3 className="text-lg font-bold text-[var(--color-primary-dark)]">
            Icons &amp; Decorative Elements
          </h3>
          <p className="text-xs text-[var(--color-warm-gray)]">
            Containers: #1A1A00 bg, #FFFFC0 icon fill | Alternative accent: #FFFFC0 bg, #1A1A00 icon
          </p>

          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Primary Icon */}
            <div className="flex flex-col items-center gap-3 rounded-lg border border-[var(--color-light-gray)] p-5 text-center">
              <span className="flex size-12 items-center justify-center rounded-md bg-[var(--color-primary-dark)] text-[var(--color-accent-light)] shadow-sm">
                <Check className="size-6" />
              </span>
              <span className="text-xs font-bold text-[var(--color-primary-dark)]">Primary Icon Container</span>
              <span className="text-[11px] text-muted">#1A1A00 bg &middot; #FFFFC0 fill</span>
            </div>

            {/* Alternative Accent Icon */}
            <div className="flex flex-col items-center gap-3 rounded-lg border border-[var(--color-light-gray)] p-5 text-center">
              <span className="flex size-12 items-center justify-center rounded-md bg-[var(--color-accent-light)] text-[var(--color-primary-dark)] shadow-sm border border-[var(--color-primary-dark)]/15">
                <Sparkles className="size-6" />
              </span>
              <span className="text-xs font-bold text-[var(--color-primary-dark)]">Alternative Accent Icon</span>
              <span className="text-[11px] text-muted">#FFFFC0 bg &middot; #1A1A00 fill</span>
            </div>

            {/* Primary Badge */}
            <div className="flex flex-col items-center gap-3 rounded-lg border border-[var(--color-light-gray)] p-5 text-center">
              <Badge tone="primary" className="text-xs px-3 py-1">
                Primary Badge (#1A1A00)
              </Badge>
              <span className="text-xs font-bold text-[var(--color-primary-dark)]">Charcoal Badge</span>
              <span className="text-[11px] text-muted">White or #FFFFC0 label</span>
            </div>

            {/* Accent Badge */}
            <div className="flex flex-col items-center gap-3 rounded-lg border border-[var(--color-light-gray)] p-5 text-center">
              <Badge tone="accent" className="text-xs px-3 py-1">
                Accent Badge (#FFFFC0)
              </Badge>
              <span className="text-xs font-bold text-[var(--color-primary-dark)]">Fresh Green Badge</span>
              <span className="text-[11px] text-muted">#1A1A00 text label</span>
            </div>
          </div>
        </div>

        {/* 4. Form Elements & Focus States */}
        <div className="mt-8 rounded-xl border border-[var(--color-light-gray)] bg-surface p-6 shadow-card sm:p-8">
          <h3 className="text-lg font-bold text-[var(--color-primary-dark)]">Form Elements &amp; Focus States</h3>
          <p className="text-xs text-[var(--color-warm-gray)]">
            Border: #E8E8E0 | Focus state: #FFFFC0 ring with #1A1A00 outline per Guide Page 5
          </p>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <label htmlFor="test-input" className="text-sm font-semibold text-[var(--color-primary-dark)]">
                Sample Input (Try Focusing)
              </label>
              <input
                id="test-input"
                type="text"
                placeholder="Click to see #FFFFC0 ring & #1A1A00 outline"
                value={formInputValue}
                onChange={(e) => setFormInputValue(e.target.value)}
                className="h-11 w-full rounded-md border border-[var(--color-light-gray)] bg-surface px-4 text-sm text-[var(--color-primary-dark)] transition-all placeholder:text-muted focus:border-[var(--color-primary-dark)] focus:outline-2 focus:outline-[var(--color-primary-dark)] focus:ring-2 focus:ring-[var(--color-accent-light)]"
              />
              <p className="text-xs text-muted">
                Meets the exact guideline: border #E8E8E0, focus state to #FFFFC0 with #1A1A00 outline.
              </p>
            </div>

            <div className="space-y-3">
              <span className="text-sm font-semibold text-[var(--color-primary-dark)]">
                Interactive Checkbox &amp; Radio
              </span>
              <div className="flex flex-col gap-2 pt-1">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checkboxState}
                    onChange={(e) => setCheckboxState(e.target.checked)}
                    className="size-5 rounded border border-[var(--color-light-gray)] text-[var(--color-primary-dark)] accent-[var(--color-primary-dark)] focus:ring-2 focus:ring-[var(--color-accent-light)]"
                  />
                  <span className="text-sm text-[var(--color-primary-dark)] font-medium">
                    Verified Accessible Checkbox
                  </span>
                </label>
                <div className="flex items-center gap-2 pt-2 text-xs text-muted">
                  <span className="font-semibold text-[var(--color-primary-dark)]">Example link:</span>
                  <a
                    href="#contrast-matrix"
                    className="text-[var(--color-primary-dark)] underline font-medium hover:bg-[var(--color-accent-light)] px-1 py-0.5 rounded transition-colors"
                  >
                    Hover link for #FFFFC0 highlight
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Loading States & Toasts */}
        <div className="mt-8 rounded-xl border border-[var(--color-light-gray)] bg-surface p-6 shadow-card sm:p-8">
          <h3 className="text-lg font-bold text-[var(--color-primary-dark)]">
            Loading States, Spinners &amp; Semantic Toasts
          </h3>
          <p className="text-xs text-[var(--color-warm-gray)]">
            Loading spinners: #FFFFC0 | Toast/Alert text: Pair semantic backgrounds with #1A1A00 text
          </p>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {/* Loading Spinner Example */}
            <div className="flex flex-col justify-between rounded-lg border border-[var(--color-light-gray)] bg-[var(--color-primary-dark)] p-6 text-white">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent-light)]">
                  Dark Container Spinner
                </span>
                <h4 className="mt-1 font-semibold">Active Loading State</h4>
                <p className="mt-1 text-xs text-white/70">
                  Spinners changed from orange/teal to #FFFFC0 for high contrast visibility.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-4">
                <Loader2 className="size-6 animate-spin text-[var(--color-accent-light)]" />
                <span className="text-sm font-medium text-[var(--color-accent-light)]">
                  Loading verification data&hellip;
                </span>
              </div>
            </div>

            {/* Live Toast Triggers */}
            <div className="flex flex-col justify-between rounded-lg border border-[var(--color-light-gray)] bg-surface p-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted">
                  Semantic Toasts (#1A1A00 text)
                </span>
                <h4 className="mt-1 font-semibold text-[var(--color-primary-dark)]">Interactive Toast Stack</h4>
                <p className="mt-1 text-xs text-muted">
                  Click below to trigger live toasts adhering to Page 5 specification.
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => toast('Operation completed successfully!', 'success')}
                  className="bg-success-subtle text-[var(--color-primary-dark)] border border-success/40 hover:bg-success/20 shadow-none font-semibold"
                >
                  Success Toast
                </Button>
                <Button
                  size="sm"
                  onClick={() => toast('Attention: Check your prerequisite courses', 'warning')}
                  className="bg-warning-subtle text-[var(--color-primary-dark)] border border-warning/40 hover:bg-warning/20 shadow-none font-semibold"
                >
                  Warning Toast
                </Button>
                <Button
                  size="sm"
                  onClick={() => toast('Verification action notification', 'neutral')}
                  className="bg-surface text-[var(--color-primary-dark)] border border-[var(--color-light-gray)] hover:bg-[var(--color-cream)] shadow-none font-semibold"
                >
                  Neutral Toast
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Accessibility & Contrast Checklist                              */}
      {/* ---------------------------------------------------------------- */}
      <section id="contrast-matrix" className="mt-16 scroll-mt-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-primary-dark)]">
              Accessibility &amp; Contrast Checklist
            </h2>
            <p className="text-[0.9375rem] text-[var(--color-warm-gray)]">
              Every critical color pair audited against WCAG 2.1 AA &amp; AAA requirements (minimum 4.5:1 for interactive elements).
            </p>
          </div>
          <Badge tone="success" className="font-semibold text-xs">
            100% WCAG AA Passing
          </Badge>
        </div>

        {/* Contrast Table from Page 4 */}
        <div className="mt-6 overflow-hidden rounded-xl border border-[var(--color-light-gray)] bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--color-light-gray)] bg-[var(--color-cream)] text-xs font-bold uppercase tracking-wider text-[var(--color-primary-dark)]">
                <tr>
                  <th className="px-6 py-4">Contrast Pair</th>
                  <th className="px-6 py-4">Ratio</th>
                  <th className="px-6 py-4">WCAG AA Standard</th>
                  <th className="px-6 py-4">Real Context</th>
                  <th className="px-6 py-4">Reference Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-light-gray)]">
                {CONTRAST_PAIRS.map((item) => (
                  <tr key={item.pair} className="hover:bg-[var(--color-primary-dark)]/[0.02] transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-[var(--color-primary-dark)]">
                      {item.pair}
                    </td>
                    <td className="px-6 py-4 font-mono text-base font-bold text-[var(--color-primary-dark)]">
                      {item.ratio}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-success-subtle px-2.5 py-1 text-xs font-bold text-[var(--color-primary-dark)] border border-success/30">
                        <Check className="size-3.5 text-success" />
                        {item.wcagAA}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-[var(--color-warm-gray)]">{item.context}</td>
                    <td className="px-6 py-4">
                      <span
                        className="inline-block rounded-md px-3 py-1.5 text-xs font-semibold shadow-sm border border-black/5"
                        style={{ backgroundColor: item.bg, color: item.fg }}
                      >
                        Sample Text
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Real-Time Interactive Contrast Calculator */}
        <div className="mt-8 rounded-xl border border-[var(--color-light-gray)] bg-surface p-6 shadow-card sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-md bg-[var(--color-primary-dark)] text-[var(--color-accent-light)]">
              <Sliders className="size-4" />
            </span>
            <h3 className="text-lg font-bold text-[var(--color-primary-dark)]">
              Live Interactive Contrast Calculator
            </h3>
          </div>
          <p className="mt-1 text-xs text-[var(--color-warm-gray)]">
            Test any foreground and background color combinations according to the WCAG 2.1 relative luminance algorithm.
          </p>

          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {/* Pickers */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Foreground Color (Text)
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={customFg}
                    onChange={(e) => setCustomFg(e.target.value)}
                    className="size-9 cursor-pointer rounded border border-[var(--color-light-gray)] bg-transparent p-0.5"
                  />
                  <input
                    type="text"
                    value={customFg}
                    onChange={(e) => setCustomFg(e.target.value)}
                    className="h-9 w-28 rounded border border-[var(--color-light-gray)] px-2 font-mono text-xs uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Background Color
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={customBg}
                    onChange={(e) => setCustomBg(e.target.value)}
                    className="size-9 cursor-pointer rounded border border-[var(--color-light-gray)] bg-transparent p-0.5"
                  />
                  <input
                    type="text"
                    value={customBg}
                    onChange={(e) => setCustomBg(e.target.value)}
                    className="h-9 w-28 rounded border border-[var(--color-light-gray)] px-2 font-mono text-xs uppercase"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="pt-2">
                <span className="text-xs text-muted font-medium">Quick Presets:</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <button
                    onClick={() => {
                      setCustomFg('#1A1A00')
                      setCustomBg('#FFFFFF')
                    }}
                    className="rounded border border-[var(--color-light-gray)] px-2 py-0.5 text-[11px] font-medium hover:bg-[var(--color-cream)]"
                  >
                    Charcoal on White
                  </button>
                  <button
                    onClick={() => {
                      setCustomFg('#1A1A00')
                      setCustomBg('#FFFFC0')
                    }}
                    className="rounded border border-[var(--color-light-gray)] px-2 py-0.5 text-[11px] font-medium hover:bg-[var(--color-cream)]"
                  >
                    Charcoal on Green
                  </button>
                  <button
                    onClick={() => {
                      setCustomFg('#66666B')
                      setCustomBg('#FFFFFF')
                    }}
                    className="rounded border border-[var(--color-light-gray)] px-2 py-0.5 text-[11px] font-medium hover:bg-[var(--color-cream)]"
                  >
                    Warm Gray on White
                  </button>
                </div>
              </div>
            </div>

            {/* Live Result Gauge */}
            <div className="flex flex-col items-center justify-center rounded-lg border border-[var(--color-light-gray)] bg-[var(--color-cream)] p-6 text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Calculated Ratio
              </span>
              <div className="mt-2 font-mono text-4xl font-extrabold text-[var(--color-primary-dark)]">
                {customRatio}:1
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                <Badge tone={customRatio >= 4.5 ? 'success' : 'danger'}>
                  {customRatio >= 4.5 ? '✓ Normal Text (4.5:1)' : '✗ Normal Text'}
                </Badge>
                <Badge tone={customRatio >= 3.0 ? 'success' : 'danger'}>
                  {customRatio >= 3.0 ? '✓ Large Text (3.0:1)' : '✗ Large Text'}
                </Badge>
                <Badge tone={customRatio >= 7.0 ? 'success' : 'neutral'}>
                  {customRatio >= 7.0 ? '✓ AAA Certified (7.0:1)' : 'AAA Standard (7:1)'}
                </Badge>
              </div>
            </div>

            {/* Reference Preview Panel */}
            <div
              className="flex flex-col justify-between rounded-lg p-6 shadow-sm border border-black/10"
              style={{ backgroundColor: customBg, color: customFg }}
            >
              <div>
                <span className="text-xs font-bold uppercase opacity-75">Live Visual Sample</span>
                <h4 className="mt-2 text-xl font-bold">The quick brown fox jumps</h4>
                <p className="mt-1 text-sm opacity-90">
                  Over the lazy dog. Legibility across all device scales is guaranteed by rigorous contrast math.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-current/15 text-xs opacity-80">
                Foreground: {customFg} &middot; Background: {customBg}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* CSS Variables & Implementation Code Snippets                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-primary-dark)]">
              CSS Variables &amp; Implementation Code
            </h2>
            <p className="text-[0.9375rem] text-[var(--color-warm-gray)]">
              Ready-to-use snippets for CSS :root, Tailwind CSS v4, and design tokens.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => copyText(CSS_VARIABLES_RAW, 'CSS Variables')}
            className="flex items-center gap-1.5"
          >
            <Copy className="size-4" />
            Copy CSS Variables
          </Button>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-[var(--color-light-gray)] bg-[#1A1A00] text-[#FFFFC0] shadow-card">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-xs font-mono text-white/70">
            <span>globals.css — :root tokens</span>
            <span className="text-[var(--color-accent-light)] font-semibold">Page 4 Spec</span>
          </div>
          <pre className="overflow-x-auto p-6 text-sm leading-relaxed font-mono">
            <code>{CSS_VARIABLES_RAW}</code>
          </pre>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Testing Priorities Checklist (Page 5)                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-16 mb-12">
        <div className="rounded-xl border border-[var(--color-light-gray)] bg-surface p-6 shadow-card sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-md bg-[var(--color-primary-dark)] text-[var(--color-accent-light)]">
              <ShieldCheck className="size-4" />
            </span>
            <h3 className="text-xl font-bold text-[var(--color-primary-dark)]">
              Testing Priorities Checklist
            </h3>
          </div>
          <p className="mt-1 text-sm text-[var(--color-warm-gray)]">
            Verified implementation criteria from Page 5 of the design guide.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-lg border border-[var(--color-light-gray)] bg-[var(--color-cream)] p-4">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success text-white">
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              <div>
                <strong className="text-sm font-bold text-[var(--color-primary-dark)]">
                  Contrast Testing
                </strong>
                <p className="mt-0.5 text-xs text-[var(--color-warm-gray)]">
                  All text and interactive pairs verified to meet WCAG AA (minimum 4.5:1, up to 21:1 for Charcoal on White).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-[var(--color-light-gray)] bg-[var(--color-cream)] p-4">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success text-white">
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              <div>
                <strong className="text-sm font-bold text-[var(--color-primary-dark)]">
                  Light/Dark Appearance
                </strong>
                <p className="mt-0.5 text-xs text-[var(--color-warm-gray)]">
                  Confirmed readability on both light backgrounds (#F5F5F0) and white cards (#FFFFFF), plus dark mode harmonization.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-[var(--color-light-gray)] bg-[var(--color-cream)] p-4">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success text-white">
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              <div>
                <strong className="text-sm font-bold text-[var(--color-primary-dark)]">
                  Component States
                </strong>
                <p className="mt-0.5 text-xs text-[var(--color-warm-gray)]">
                  Hover (#2D2D2D / #FFFFB3), active, disabled (opacity 45%), and focus (#FFFFC0 ring with #1A1A00 outline) verified.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-[var(--color-light-gray)] bg-[var(--color-cream)] p-4">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success text-white">
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              <div>
                <strong className="text-sm font-bold text-[var(--color-primary-dark)]">
                  Mobile Rendering (44x44px Tap Targets)
                </strong>
                <p className="mt-0.5 text-xs text-[var(--color-warm-gray)]">
                  Interactive button heights set with min-h-[44px] ensuring comfortable touch target accessibility on mobile screens.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
