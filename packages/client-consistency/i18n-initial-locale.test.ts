import { describe, expect, it } from 'vitest'
import { normalizeBrowserLocale, resolveInitialLocale } from '@/eat-first/i18n/index.js'

describe('initial locale resolution', () => {
  it('uses the browser language on first visit', () => {
    expect(resolveInitialLocale(null, 'de-DE')).toBe('de')
    expect(resolveInitialLocale(undefined, 'pl-PL')).toBe('pl')
  })

  it('maps Russian browser language to English', () => {
    expect(resolveInitialLocale(null, 'ru-RU')).toBe('en')
  })

  it('maps Russian stored locale to English', () => {
    expect(resolveInitialLocale('ru', 'uk-UA')).toBe('en')
  })

  it('falls back from unsupported stored locale to browser locale', () => {
    expect(resolveInitialLocale('xxx', 'en-US')).toBe('en')
  })

  it('keeps a valid manually stored locale first', () => {
    expect(resolveInitialLocale('uk', 'en-US')).toBe('uk')
  })

  it('falls back safely when browser APIs are unavailable', () => {
    expect(normalizeBrowserLocale(undefined)).toBe('uk')
    expect(resolveInitialLocale(null, undefined)).toBe('uk')
  })
})
