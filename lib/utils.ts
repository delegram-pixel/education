import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Ticket IDs are read aloud down a phone line to a counselor, so the alphabet
 * excludes every character pair that gets misheard or mistyped: O/0 and I/1.
 */
const TICKET_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateTicketId(): string {
  let suffix = ''
  const bytes = crypto.getRandomValues(new Uint8Array(5))
  for (const byte of bytes) {
    suffix += TICKET_ALPHABET[byte % TICKET_ALPHABET.length]
  }
  return `AC-${suffix}`
}

export function formatRelative(date: Date | string): string {
  const then = typeof date === 'string' ? new Date(date) : date
  const seconds = Math.round((Date.now() - then.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`
  return then.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}
