import { describe, expect, it } from 'vitest'
import {
  buildCanonicalAbsoluteUrl,
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
})
