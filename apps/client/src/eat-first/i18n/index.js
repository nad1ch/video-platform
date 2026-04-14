import { createI18n } from 'vue-i18n'
import uk from '../locales/uk.json'
import en from '../locales/en.json'
import de from '../locales/de.json'
import pl from '../locales/pl.json'

const LANG_KEY = 'eat-first:locale'
const VALID = new Set(['uk', 'en', 'de', 'pl'])

function readInitialLocale() {
  if (typeof localStorage === 'undefined') return 'uk'
  const s = localStorage.getItem(LANG_KEY)
  if (VALID.has(s)) return s
  if (s) localStorage.setItem(LANG_KEY, 'uk')
  return 'uk'
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: readInitialLocale(),
  fallbackLocale: 'uk',
  messages: { uk, en, de, pl },
})

export function persistLocale(code) {
  if (!VALID.has(code)) return
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
