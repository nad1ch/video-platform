import { describe, expect, it } from 'vitest'
import { getLandingScrollTopForHash, normalizeRouteHash } from '@/utils/landingAnchorScroll'

describe('normalizeRouteHash', () => {
  it('returns empty for nullish or empty', () => {
    expect(normalizeRouteHash(undefined)).toBe('')
    expect(normalizeRouteHash(null)).toBe('')
    expect(normalizeRouteHash('')).toBe('')
  })

  it('keeps leading hash', () => {
    expect(normalizeRouteHash('#videocall')).toBe('#videocall')
  })

  it('adds hash when missing', () => {
    expect(normalizeRouteHash('games')).toBe('#games')
  })
})

describe('getLandingScrollTopForHash', () => {
  it('returns 0 for empty hash', () => {
    expect(getLandingScrollTopForHash('')).toBe(0)
    expect(getLandingScrollTopForHash(undefined)).toBe(0)
  })

  it('maps known landing fragments', () => {
    expect(getLandingScrollTopForHash('#videocall')).toBe(721)
    expect(getLandingScrollTopForHash('#games')).toBe(1139)
    expect(getLandingScrollTopForHash('#economy')).toBe(1735)
    expect(getLandingScrollTopForHash('#footer')).toBe(2204)
  })

  it('returns 0 for unknown fragment', () => {
    expect(getLandingScrollTopForHash('#unknown')).toBe(0)
  })
})
