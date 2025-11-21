import { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from 'react'
import resourcesJson from './resources.json'
import type { AppStrings, Locale } from './types'

export { type HeadingLevel, type Locale, type AppStrings, type ShortcutDefinition } from './types'

const fallbackLocale: Locale = 'en-US'
const resources = resourcesJson as unknown as Record<Locale, AppStrings>
const STORAGE_KEY = 'tiptap-locale'

const normalizeLocale = (locale?: string): Locale => {
  if (!locale) {
    return fallbackLocale
  }

  const lower = locale.toLowerCase()

  if (lower.startsWith('ko')) {
    return 'ko-KR'
  }

  if (lower.startsWith('ja')) {
    return 'ja-JP'
  }

  return fallbackLocale
}

const detectBrowserLocale = (): Locale => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return fallbackLocale
  }

  return normalizeLocale(navigator.language)
}

const getStoredLocale = (): Locale | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return normalizeLocale(raw)
  } catch {
    return null
  }
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
  setLocale: () => { },
})

const deepMerge = (target: any, source: any): any => {
  if (typeof target !== 'object' || target === null) {
    return source !== undefined ? source : target
  }
  if (typeof source !== 'object' || source === null) {
    return source !== undefined ? source : target
  }

  const output = { ...target }
  for (const key of Object.keys(source)) {
    if (source[key] instanceof Array) {
      output[key] = source[key]
    } else if (typeof source[key] === 'object' && source[key] !== null) {
      if (!(key in target)) {
        Object.assign(output, { [key]: source[key] })
      } else {
        output[key] = deepMerge(target[key], source[key])
      }
    } else {
      Object.assign(output, { [key]: source[key] })
    }
  }
  return output
}

export const I18nProvider = ({ children, initialLocale }: { children: ReactNode; initialLocale?: Locale }) => {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale ?? getStoredLocale() ?? detectBrowserLocale())

  const persistLocale = useCallback((next: Locale) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore storage failures */
    }
  }, [])

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      strings: deepMerge(resources[fallbackLocale], resources[locale]),
      setLocale: (nextLocale) => {
        persistLocale(nextLocale)
        setLocaleState(nextLocale)
      },
    }),
    [locale, persistLocale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export const useI18n = () => useContext(I18nContext)
