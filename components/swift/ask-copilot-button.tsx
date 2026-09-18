'use client'

import { MessageCircleQuestion } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { Button, type ButtonProps } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { Tooltip } from '@/components/ui/tooltip'
import { LANGUAGES, useLanguage } from '@/components/shared/language-preference'
import { cn } from '@/lib/utils'

/**
 * Detects whether the Swift widget actually mounted.
 *
 * The script is loaded with `afterInteractive`, so it is not present on first
 * paint. It may also never arrive — no credentials configured, an ad blocker,
 * or an offline demo machine. Polling briefly and then giving up lets every
 * trigger in the app degrade to something that still helps the student.
 */
function useSwiftWidget() {
  const [state, setState] = React.useState<'pending' | 'ready' | 'unavailable'>('pending')

  React.useEffect(() => {
    if (window.SwiftAgentWidget?.isLoaded) {
      setState('ready')
      return
    }

    let elapsed = 0
    const interval = window.setInterval(() => {
      elapsed += 250
      if (window.SwiftAgentWidget?.isLoaded) {
        setState('ready')
        window.clearInterval(interval)
      } else if (elapsed >= 3000) {
        setState('unavailable')
        window.clearInterval(interval)
      }
    }, 250)

    return () => window.clearInterval(interval)
  }, [])

  return state
}

type AskCopilotButtonProps = Omit<ButtonProps, 'children'> & {
  /** The question a student would ask here. Copied to the clipboard on click. */
  suggestedQuestion: string
  label?: string
  /** Where to send the student when the widget is unavailable. */
  fallbackHref?: string
  showIcon?: boolean
}

/**
 * Opens the Swift chat panel with the relevant question ready to paste.
 *
 * WHY THE CLIPBOARD: the Swift widget exposes no method to prefill or send a
 * message — `open`, `close`, `toggle`, `mount`, `unmount` and `isLoaded` are the
 * entire documented surface. Reaching into its Shadow DOM to type for the user
 * would work until it silently didn't, which on a demo stage is the worst
 * possible failure. Copying the question and telling the student to paste it is
 * honest, reliable, and one keystroke away from the same outcome.
 */
export function AskCopilotButton({
  suggestedQuestion,
  label = 'Ask the Copilot',
  fallbackHref = '/tickets/new',
  variant = 'secondary',
  size = 'sm',
  className,
  showIcon = true,
  ...props
}: AskCopilotButtonProps) {
  const widget = useSwiftWidget()
  const toast = useToast()
  const { language } = useLanguage()
  const languageInstruction = LANGUAGES[language].instruction
  const contextualQuestion = `${suggestedQuestion}\n\nPreferred response language: ${LANGUAGES[language].label}. ${languageInstruction}`

  if (widget === 'unavailable') {
    const separator = fallbackHref.includes('?') ? '&' : '?'
    const href = `${fallbackHref}${separator}q=${encodeURIComponent(contextualQuestion)}&lang=${language}`
    return (
      <Tooltip content="Send this question to a counselor with the relevant context attached.">
        <Button asChild variant={variant} size={size} className={cn('group', className)}>
          <Link href={href}>
            {showIcon ? <MessageCircleQuestion aria-hidden className="size-4" /> : null}
            Ask a counselor
          </Link>
        </Button>
      </Tooltip>
    )
  }

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(contextualQuestion)
      toast('Question copied — paste it into the chat.', 'success')
    } catch {
      // Clipboard access can be refused outright. Opening the panel is still
      // the useful half of this interaction, so carry on without it.
      toast('Chat opened. Ask away.')
    }
    window.SwiftAgentWidget?.open()
  }

  return (
    <Tooltip content="Open the counselor chat with a useful question already prepared.">
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={widget === 'pending'}
        className={cn('group', className)}
        {...props}
      >
        {showIcon ? <MessageCircleQuestion aria-hidden className="size-4" /> : null}
        {label}
      </Button>
    </Tooltip>
  )
}
