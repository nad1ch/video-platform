import { describe, expect, it } from 'vitest'
import {
  EAT_FIRST_ROUTE_NAME,
  eatViewFromRoute,
  normalizeEatView,
} from '@/eat-first/state/eatFirstRouteUtils.js'

describe('eatFirstRouteUtils', () => {
  it('normalizeEatView accepts known views', () => {
    expect(normalizeEatView('join')).toBe('join')
    expect(normalizeEatView('admin')).toBe('admin')
    expect(normalizeEatView('control')).toBe('control')
    expect(normalizeEatView('overlay')).toBe('overlay')
  })

  it('normalizeEatView is case-insensitive and trimmed', () => {
    expect(normalizeEatView('  CONTROL  ')).toBe('control')
    expect(normalizeEatView('Overlay')).toBe('overlay')
  })

  it('normalizeEatView falls back to join for unknown', () => {
    expect(normalizeEatView('')).toBe('join')
    expect(normalizeEatView('lobby')).toBe('join')
    expect(normalizeEatView(null)).toBe('join')
  })

  it('eatViewFromRoute reads query.view', () => {
    expect(eatViewFromRoute({ query: { view: 'overlay' } })).toBe('overlay')
    expect(eatViewFromRoute({ query: {} })).toBe('join')
    expect(eatViewFromRoute({ query: { view: 'bad' } })).toBe('join')
  })

  it('EAT_FIRST_ROUTE_NAME is stable', () => {
    expect(EAT_FIRST_ROUTE_NAME).toBe('eat')
  })
})
