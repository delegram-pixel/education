'use client'

import { MessageCircleQuestion } from 'lucide-react'
import Link from 'next/link'

import { useSwiftConfigured } from '@/components/swift/swift-availability'
import { Arrow, Button, type ButtonProps } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { Tooltip } from '@/components/ui/tooltip'
import { LANGUAGES, useLanguage } from '@/components/shared/language-preference'
import { SAFETY_GUARDRAIL } from '@/lib/swift/safety'
import { cn } from '@/lib/utils'

/**
 * The two routes out of every question in this app, side by side: Swift first,
 * a human counselor beside it.
 *
 * WHAT WAS WRONG BEFORE. This component used to poll for three seconds to decide
 * whether the Swift widget had mounted, and if it had not, it rendered a link to
 * the counselor page *instead*. Two things followed from that. The decision was
 * permanent — a widget arriving at 3.1s left every trigger in the app pointing at
 * the counselor page for the rest of the session. And the counselor link inherited
 * the caller's `className`, which for the site header included `open-chat`, the
 * class the widget delegates on `document`. So a single click both opened the
 * Swift panel and navigated to the counselor page. The two flows did not just
 * have bad ordering; they fired together.
 *
 * WHAT REPLACES IT. Whether Swift is deployed is a fact the server knows, so the
 * server says so once (see `SwiftRuntime`) and this component never guesses. The
 * Swift trigger carries `open-chat` and its click handler copies the question —
 * it does NOT call `Widget.open()`, because the delegated listener already does
 * that, and calling both opened the panel twice. Because the listener is
 * delegated, the trigger needs no readiness gate either: it starts working
 * whenever the script lands, however late that is.
 *
 * The counselor route is a sibling control, always visible, labelled as itself.
 * It is never a silent substitution for the Swift trigger, and it never carries
 * `open-chat` — see `stripOpenChat`.
 *
 * WHY THE CLIPBOARD: the Swift widget exposes no method to prefill or send a
 * message — `open`, `close`, `toggle`, `mount`, `unmount` and `isLoaded` are the
 * entire documented surface. Reaching into its Shadow DOM to type for the user
 * would work until it silently didn't, which on a demo stage is the worst
 * possible failure. Copying the question and telling the student to paste it is
 * honest, reliable, and one keystroke away from the same outcome.
 *
 * WHY THE SAFETY GUARDRAIL IS APPENDED HERE: the deadline and scam rules have to
 * hold for every question the app asks, not just the ones whose author remembered.
 * Appending at the single point every trigger funnels through means a trigger
 * added next year carries them too. See `lib/swift/safety.ts`.
 */

/**
 * `open-chat` opens the Swift panel through a listener the widget delegates on
 * `document`. On an element that also navigates, one click does both — the exact
 * bug this file exists to fix. The class is added here and never accepted from a
 * caller, and it is stripped from anything navigable so a future caller passing
 * it cannot reintroduce the double-trigger.
 */
function stripOpenChat(className: string | undefined): string | undefined {
  return className?.replace(/\bopen-chat\b/g, '')
}

type AskCopilotButtonProps = Omit<ButtonProps, 'children'> & {
  /** The question a student would ask here. Copied to the clipboard on click. */
  suggestedQuestion: string
  /** Wording for the Swift trigger. */
  label?: string
  /**
   * Wording for the counselor route that sits beside the Swift trigger. Pass
   * `null` on a screen where the human route is already the obvious next step —
   * the ticket thread itself, say — rather than offering it twice.
   */
  counselorLabel?: string | null
  /** Where the counselor route goes. Query params already on it are preserved. */
  counselorHref?: string
  showIcon?: boolean
}

export function AskCopilotButton({
  suggestedQuestion,
  label = 'Ask the Copilot',
  counselorLabel = 'Send to a counselor',
  counselorHref = '/tickets/new',
  variant = 'secondary',
  size = 'sm',
  className,
  showIcon = true,
  ...props
}: AskCopilotButtonProps) {
  const configured = useSwiftConfigured()
  const toast = useToast()
  const { language } = useLanguage()
  const languageInstruction = LANGUAGES[language].instruction
  const contextualQuestion = [
    suggestedQuestion,
    `Preferred response language: ${LANGUAGES[language].label}. ${languageInstruction}`,
    SAFETY_GUARDRAIL,
  ].join('\n\n')

  const separator = counselorHref.includes('?') ? '&' : '?'
  const counselorUrl = `${counselorHref}${separator}q=${encodeURIComponent(
    contextualQuestion,
  )}&lang=${language}`

  // Only `false` demotes Swift, and only because the server said so. `null` means
  // a trigger rendered outside `SwiftRuntime`; treating that as "no Swift" would
  // be guessing, which is what this rewrite removed.
  if (configured === false) {
    return (
      <Tooltip content="Send this question to a counselor with the relevant context attached.">
        <Button
          asChild
          variant={variant}
          size={size}
          className={cn('group', stripOpenChat(className))}
        >
          <Link href={counselorUrl}>
            {showIcon ? <MessageCircleQuestion aria-hidden className="size-4" /> : null}
            {counselorLabel ?? 'Ask a counselor'}
          </Link>
        </Button>
      </Tooltip>
    )
  }

  async function copyForChat() {
    // Copy only. The widget's own `.open-chat` listener opens the panel.
    try {
      await navigator.clipboard.writeText(contextualQuestion)
      toast('Question copied — paste it into the chat.', 'success')
    } catch {
      // Clipboard access can be refused outright. The panel still opens, which
      // is the useful half of this interaction.
      toast('Chat opened. Ask away.')
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      <Tooltip content="Open the chat, with a useful question already copied to your clipboard.">
        <Button
          variant={variant}
          size={size}
          className={cn('open-chat group', className)}
          {...props}
          onClick={copyForChat}
        >
          {showIcon ? <MessageCircleQuestion aria-hidden className="size-4" /> : null}
          {label}
        </Button>
      </Tooltip>

      {counselorLabel ? (
        <Tooltip content="Some things need a person. This sends your question to a counselor, with the context attached.">
          <Link
            href={counselorUrl}
            className={cn(
              'group inline-flex items-center gap-1 text-[0.875rem] font-medium text-muted',
              'underline-offset-4 transition-colors duration-200',
              'hover:text-foreground hover:underline',
            )}
          >
            {counselorLabel}
            <Arrow className="size-3.5" />
          </Link>
        </Tooltip>
      ) : null}
    </span>
  )
}
