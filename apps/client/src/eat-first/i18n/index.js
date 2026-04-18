import { createI18n } from 'vue-i18n'

const LANG_KEY = 'eat-first:locale'
const VALID = new Set(['uk', 'en', 'de', 'pl'])

function readInitialLocale() {
  if (typeof localStorage === 'undefined') return 'uk'
  const s = localStorage.getItem(LANG_KEY)
  if (VALID.has(s)) return s
  if (s) localStorage.setItem(LANG_KEY, 'uk')
  return 'uk'
}

const initialLocale = readInitialLocale()

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: initialLocale,
  fallbackLocale: 'uk',
  messages: {},
})

const loadedLocales = new Set()

/**
 * Loads one locale JSON (dynamic import = separate chunk per locale).
 * @param {string} code
 */
export async function loadLocaleMessages(code) {
  if (!VALID.has(code) || loadedLocales.has(code)) return
  const mod = await import(`../locales/${code}.json`)
  const messages = mod.default ?? mod
  i18n.global.setLocaleMessage(code, messages)
  loadedLocales.add(code)
}

/**
 * Load active locale + fallback (`uk`) so `t()` never misses keys on first paint.
 */
export async function preloadInitialLocales() {
  await loadLocaleMessages(initialLocale)
  if (initialLocale !== 'uk') {
    await loadLocaleMessages('uk')
  }
}

export async function persistLocale(code) {
  if (!VALID.has(code)) return
  await loadLocaleMessages(code)
  i18n.global.locale.value = code
  if (typeof localStorage !== 'undefined') localStorage.setItem(LANG_KEY, code)
  if (typeof document !== 'undefined') document.documentElement.setAttribute('lang', code)
}

export const LOCALE_OPTIONS = [
  { code: 'uk', label: 'УКР' },
  { code: 'en', label: 'EN' },
  { code: 'de', label: 'DE' },
  { code: 'pl', label: 'PL' },
]
