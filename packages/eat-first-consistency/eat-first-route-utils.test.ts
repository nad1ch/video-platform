import { describe, expect, it } from 'vitest'
import {
  EAT_FIRST_ROUTE_NAME,
  eatViewFromRoute,
  normalizeEatView,
} from '@/eat-first/state/eatFirstRouteUtils.js'

describe('eatFirstRouteUtils (post legacy view= cleanup)', () => {
  it('normalizeEatView always reports the canonical "call" surface', () => {
    expect(normalizeEatView()).toBe('call')
    expect(normalizeEatView('call')).toBe('call')
    expect(normalizeEatView('overlay')).toBe('call')
    expect(normalizeEatView('control')).toBe('call')
    expect(normalizeEatView('admin')).toBe('call')
    expect(normalizeEatView('lobby')).toBe('call')
    expect(normalizeEatView('')).toBe('call')
    expect(normalizeEatView(null)).toBe('call')
    expect(normalizeEatView(undefined)).toBe('call')
  })

  it('eatViewFromRoute ignores query.view (legacy panels are gone)', () => {
    expect(eatViewFromRoute({ query: {} })).toBe('call')
    expect(eatViewFromRoute({ query: { view: 'overlay' } })).toBe('call')
    expect(eatViewFromRoute({ query: { view: 'control' } })).toBe('call')
    expect(eatViewFromRoute({ query: { view: 'admin' } })).toBe('call')
  })

  it('EAT_FIRST_ROUTE_NAME is stable', () => {
    expect(EAT_FIRST_ROUTE_NAME).toBe('eat')
  })
})
