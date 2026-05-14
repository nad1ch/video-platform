import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { createStreamViewRouteHelpers } from '@/composables/game-room/createStreamViewRouteHelpers'

const helpers = createStreamViewRouteHelpers('mafia')

function makeRoute(name: string | undefined, mode: unknown): RouteLocationNormalizedLoaded {
  return { name, query: { mode } } as unknown as RouteLocationNormalizedLoaded
}

describe('createStreamViewRouteHelpers', () => {
  it('viewQueryIsView returns true for the "view" string', () => {
    expect(helpers.viewQueryIsView('view')).toBe(true)
  })

  it('viewQueryIsView returns true for ["view"] array', () => {
    expect(helpers.viewQueryIsView(['view'])).toBe(true)
  })

  it('viewQueryIsView returns false for any other shape', () => {
    expect(helpers.viewQueryIsView(undefined)).toBe(false)
    expect(helpers.viewQueryIsView(null)).toBe(false)
    expect(helpers.viewQueryIsView('other')).toBe(false)
    expect(helpers.viewQueryIsView([])).toBe(false)
    expect(helpers.viewQueryIsView(['other'])).toBe(false)
  })

  it('streamViewFromRoute is true on the configured route with mode=view', () => {
    expect(helpers.streamViewFromRoute(makeRoute('mafia', 'view'))).toBe(true)
  })

  it('streamViewFromRoute accepts ["view"] array form', () => {
    expect(helpers.streamViewFromRoute(makeRoute('mafia', ['view']))).toBe(true)
  })

  it('streamViewFromRoute is false on a different route name even with mode=view', () => {
    expect(helpers.streamViewFromRoute(makeRoute('eat', 'view'))).toBe(false)
    expect(helpers.streamViewFromRoute(makeRoute('game-template', 'view'))).toBe(false)
  })

  it('streamViewFromRoute is false when mode is missing', () => {
    expect(helpers.streamViewFromRoute(makeRoute('mafia', undefined))).toBe(false)
  })

  it('streamViewFromRoute is false when mode is something other than view', () => {
    expect(helpers.streamViewFromRoute(makeRoute('mafia', 'other'))).toBe(false)
  })

  it('returned helper exposes the documented function shape', () => {
    expect(typeof helpers.viewQueryIsView).toBe('function')
    expect(typeof helpers.streamViewFromRoute).toBe('function')
    expect(typeof helpers.useViewMode).toBe('function')
    expect(typeof helpers.useStreamViewFromRoute).toBe('function')
  })

  it('different routes produce gated helpers (no cross-route leak)', () => {
    const eat = createStreamViewRouteHelpers('eat')
    const gameTemplate = createStreamViewRouteHelpers('game-template')
    expect(eat.streamViewFromRoute(makeRoute('eat', 'view'))).toBe(true)
    expect(eat.streamViewFromRoute(makeRoute('mafia', 'view'))).toBe(false)
    expect(gameTemplate.streamViewFromRoute(makeRoute('game-template', 'view'))).toBe(true)
    expect(gameTemplate.streamViewFromRoute(makeRoute('mafia', 'view'))).toBe(false)
  })
})
