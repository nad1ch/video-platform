import { describe, expect, it } from 'vitest'
import {
  buildCanonicalAbsoluteUrl,
  canonicalRelativePathForSeo,
  resolveCanonicalOriginForClient,
  trimCanonicalOrigin,
} from '@/eat-first/state/seoCanonicalUrl.js'

describe('seoCanonicalUrl', () => {
  it('trimCanonicalOrigin removes trailing slash', () => {
    expect(trimCanonicalOrigin('https://example.com/')).toBe('https://example.com')
    expect(trimCanonicalOrigin('https://example.com')).toBe('https://example.com')
    expect(trimCanonicalOrigin('')).toBe('')
  })

  it('buildCanonicalAbsoluteUrl joins origin and path', () => {
    expect(buildCanonicalAbsoluteUrl('https://example.com', '/eat?view=join')).toBe(
      'https://example.com/eat?view=join',
    )
    expect(buildCanonicalAbsoluteUrl('https://example.com', 'eat')).toBe('https://example.com/eat')
  })

  it('buildCanonicalAbsoluteUrl defaults path to slash', () => {
    expect(buildCanonicalAbsoluteUrl('https://example.com', '')).toBe('https://example.com/')
  })

  it('buildCanonicalAbsoluteUrl returns empty when origin empty', () => {
    expect(buildCanonicalAbsoluteUrl('', '/x')).toBe('')
  })

  it('resolveCanonicalOriginForClient: dev prefers window over VITE', () => {
    expect(
      resolveCanonicalOriginForClient({
        dev: true,
        vitePublicCanonicalOrigin: 'https://app.streamassist.net',
        windowOrigin: 'http://localhost:5173',
      }),
    ).toBe('http://localhost:5173')
  })

  it('resolveCanonicalOriginForClient: prod prefers VITE when set', () => {
    expect(
      resolveCanonicalOriginForClient({
        dev: false,
        vitePublicCanonicalOrigin: 'https://app.streamassist.net',
        windowOrigin: 'https://app.streamassist.net',
      }),
    ).toBe('https://app.streamassist.net')
  })

  it('resolveCanonicalOriginForClient: prod falls back to window when VITE empty', () => {
    expect(
      resolveCanonicalOriginForClient({
        dev: false,
        vitePublicCanonicalOrigin: '',
        windowOrigin: 'https://preview.example.com',
      }),
    ).toBe('https://preview.example.com')
  })

  it('canonicalRelativePathForSeo keeps content query, strips tracking and auth modal keys', () => {
    expect(canonicalRelativePathForSeo('/app/eat?view=join&utm_source=x&needLogin=1')).toBe(
      '/app/eat?view=join',
    )
    expect(canonicalRelativePathForSeo('/app/nadle/foo?x=1')).toBe('/app/nadle/foo?x=1')
  })

  it('canonicalRelativePathForSeo drops empty query values and sorts keys', () => {
    expect(canonicalRelativePathForSeo('/app/eat?empty=&view=join&z=9&a=1')).toBe(
      '/app/eat?a=1&view=join&z=9',
    )
  })

  it('canonicalRelativePathForSeo drops hash (fragment not in canonical)', () => {
    expect(canonicalRelativePathForSeo('/app/eat?view=overlay#panel')).toBe('/app/eat?view=overlay')
  })

  it('buildCanonicalAbsoluteUrl does not double-slash when origin is trimmed', () => {
    expect(buildCanonicalAbsoluteUrl('https://app.streamassist.net', '/app/call')).toBe(
      'https://app.streamassist.net/app/call',
    )
  })
})
