import { describe, expect, it } from 'vitest'
import {
  EAT_FIRST_ROUTE_NAME,
  eatViewFromRoute,
  normalizeEatView,
} from '@/eat-first/state/eatFirstRouteUtils.js'

describe('eatFirstRouteUtils', () => {
  it('normalizeEatView accepts known views', () => {
    expect(normalizeEatView('call')).toBe('call')
    expect(normalizeEatView('join')).toBe('call')
    expect(normalizeEatView('admin')).toBe('admin')
    expect(normalizeEatView('control')).toBe('control')
    expect(normalizeEatView('overlay')).toBe('overlay')
  })

  it('normalizeEatView is case-insensitive and trimmed', () => {
    expect(normalizeEatView('  CONTROL  ')).toBe('control')
    expect(normalizeEatView('Overlay')).toBe('overlay')
  })

  it('normalizeEatView falls back to call for unknown', () => {
    expect(normalizeEatView('')).toBe('call')
    expect(normalizeEatView('lobby')).toBe('call')
    expect(normalizeEatView(null)).toBe('call')
  })

  it('eatViewFromRoute reads query.view', () => {
    expect(eatViewFromRoute({ query: { view: 'overlay' } })).toBe('overlay')
    expect(eatViewFromRoute({ query: {} })).toBe('call')
    expect(eatViewFromRoute({ query: { view: 'bad' } })).toBe('call')
  })

  it('EAT_FIRST_ROUTE_NAME is stable', () => {
    expect(EAT_FIRST_ROUTE_NAME).toBe('eat')
  })
})
