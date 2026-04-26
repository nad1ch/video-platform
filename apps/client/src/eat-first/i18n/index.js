import { createI18n } from 'vue-i18n'

const LANG_KEY = 'eat-first:locale'
const VALID = new Set(['uk', 'en', 'de', 'pl'])

function normalizeLocaleCode(raw) {
  const primary = String(raw || '').toLowerCase().split('-')[0]
  if (primary === 'ru') return 'en'
  if (VALID.has(primary)) return primary
  return null
}

export function normalizeBrowserLocale(raw) {
  return normalizeLocaleCode(raw) ?? 'uk'
}

export function resolveInitialLocale(storedLocale, browserLocale) {
  return normalizeLocaleCode(storedLocale) ?? normalizeBrowserLocale(browserLocale)
}

function readStoredLocale() {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(LANG_KEY)
  } catch {
    return null
  }
}

function writeStoredLocale(code) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LANG_KEY, code)
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function readInitialLocale() {
  const browserLocale = typeof navigator !== 'undefined' ? (navigator.languages?.[0] ?? navigator.language) : undefined
  const storedLocale = readStoredLocale()
  const locale = resolveInitialLocale(storedLocale, browserLocale)
  if (!VALID.has(storedLocale)) {
    writeStoredLocale(locale)
  }
  return locale
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
