'use client'

import * as React from 'react'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export const LANGUAGES = {
  en: { label: 'English', instruction: 'Reply in clear Nigerian English.' },
  pcm: { label: 'Nigerian Pidgin', instruction: 'Reply in clear Nigerian Pidgin.' },
  yo: { label: 'Yoruba', instruction: 'Reply in Yoruba. Keep official admissions terms in English where that is clearer.' },
  ig: { label: 'Igbo', instruction: 'Reply in Igbo. Keep official admissions terms in English where that is clearer.' },
  ha: { label: 'Hausa', instruction: 'Reply in Hausa. Keep official admissions terms in English where that is clearer.' },
} as const

export type LanguageCode = keyof typeof LANGUAGES

type LanguageContextValue = {
  language: LanguageCode
  setLanguage: (language: LanguageCode) => void
}

const LanguageContext = React.createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = React.useState<LanguageCode>('en')

  React.useEffect(() => {
    const saved = window.localStorage.getItem('ac-language')
    if (saved && saved in LANGUAGES) setLanguage(saved as LanguageCode)
  }, [])

  const chooseLanguage = React.useCallback((next: LanguageCode) => {
    setLanguage(next)
    window.localStorage.setItem('ac-language', next)
  }, [])

  return (
    <LanguageContext.Provider value={{ language, setLanguage: chooseLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const value = React.useContext(LanguageContext)
  if (!value) throw new Error('useLanguage must be used inside <LanguageProvider>')
  return value
}

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage()

  return (
    <Select value={language} onValueChange={(value) => setLanguage(value as LanguageCode)}>
      <SelectTrigger aria-label="Preferred language" className="h-10 w-[8.75rem] text-[0.875rem]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(LANGUAGES).map(([code, item]) => (
          <SelectItem key={code} value={code}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
