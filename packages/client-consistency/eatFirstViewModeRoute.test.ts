import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import {
  eatFirstStreamViewFromRoute,
  eatFirstStreamViewQueryIsView,
} from '@/composables/eatFirstCallStreamView'

function makeRoute(name: string | undefined, mode: unknown): RouteLocationNormalizedLoaded {
  return { name, query: { mode } } as unknown as RouteLocationNormalizedLoaded
}

describe('eatFirstStreamViewQueryIsView', () => {
  it('is true only for mode=view (string or first array value)', () => {
    expect(eatFirstStreamViewQueryIsView('view')).toBe(true)
    expect(eatFirstStreamViewQueryIsView(['view', 'x'])).toBe(true)
    expect(eatFirstStreamViewQueryIsView(['view'])).toBe(true)
    expect(eatFirstStreamViewQueryIsView(undefined)).toBe(false)
    expect(eatFirstStreamViewQueryIsView(null)).toBe(false)
    expect(eatFirstStreamViewQueryIsView('host')).toBe(false)
    expect(eatFirstStreamViewQueryIsView(['host'])).toBe(false)
    expect(eatFirstStreamViewQueryIsView([])).toBe(false)
  })
})

describe('eatFirstStreamViewFromRoute', () => {
  it('is true on the eat route with mode=view', () => {
    expect(eatFirstStreamViewFromRoute(makeRoute('eat', 'view'))).toBe(true)
  })

  it('accepts the ["view"] array form', () => {
    expect(eatFirstStreamViewFromRoute(makeRoute('eat', ['view']))).toBe(true)
  })

  it('is false when mode is missing or not "view"', () => {
    expect(eatFirstStreamViewFromRoute(makeRoute('eat', undefined))).toBe(false)
    expect(eatFirstStreamViewFromRoute(makeRoute('eat', 'host'))).toBe(false)
    expect(eatFirstStreamViewFromRoute(makeRoute('eat', ['host']))).toBe(false)
  })

  it('does not leak across routes: mode=view on a non-eat route is not stream view', () => {
    expect(eatFirstStreamViewFromRoute(makeRoute('mafia', 'view'))).toBe(false)
    expect(eatFirstStreamViewFromRoute(makeRoute('game-template', 'view'))).toBe(false)
    expect(eatFirstStreamViewFromRoute(makeRoute('call', 'view'))).toBe(false)
    expect(eatFirstStreamViewFromRoute(makeRoute(undefined, 'view'))).toBe(false)
  })
})
