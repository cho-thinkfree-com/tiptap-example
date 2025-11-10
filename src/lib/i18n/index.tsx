import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import resourcesJson from './resources.json'
import type { AppStrings, Locale } from './types'

export { type HeadingLevel, type Locale, type AppStrings, type ShortcutDefinition } from './types'

const fallbackLocale: Locale = 'en-US'
const resources = resourcesJson as Record<Locale, AppStrings>

const normalizeLocale = (locale?: string): Locale => {
  if (!locale) {
    return fallbackLocale
  }

  const lower = locale.toLowerCase()

  if (lower.startsWith('ko')) {
    return 'ko-KR'
  }

  return fallbackLocale
}

const detectBrowserLocale = (): Locale => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return fallbackLocale
  }

  return normalizeLocale(navigator.language)
}

export const getStringsForLocale = (locale?: string): AppStrings => {
  const normalized = normalizeLocale(locale)
  return resources[normalized]
}

type I18nContextValue = {
  locale: Locale
  strings: AppStrings
  setLocale: (nextLocale: Locale) => void
}

const I18nContext = createContext<I18nContextValue>({
  locale: fallbackLocale,
  strings: resources[fallbackLocale],
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setLocale: () => {},
})

export const I18nProvider = ({ children, initialLocale }: { children: ReactNode; initialLocale?: Locale }) => {
  const [locale, setLocale] = useState<Locale>(initialLocale ?? detectBrowserLocale())

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      strings: resources[locale],
      setLocale,
    }),
    [locale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export const useI18n = () => useContext(I18nContext)
