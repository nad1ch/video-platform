import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import {
  resolveAppSeoDescription,
  resolveAppSeoTitle,
  resolveDefaultOgImageUrl,
} from '@/eat-first/state/seoAppResolve.js'

function t(key: string, values?: Record<string, unknown>): string {
  if (key === 'seo.metaDescription') {
    return `desc-${String(values?.nick ?? '')}`
  }
  const map: Record<string, string> = {
    'routes.call': 'Call',
    'routes.nadle': 'nadle',
    'routes.admin': 'Admin',
  }
  return map[key] ?? key
}

describe('seoAppResolve', () => {
  it('resolveAppSeoTitle: eat uses Ukrainian eat titles', () => {
    const route = {
      path: '/app/eat',
      name: 'eat',
      query: { view: 'join' },
      meta: {},
      params: {},
    } as unknown as RouteLocationNormalizedLoaded
    expect(resolveAppSeoTitle(route, t)).toContain('Лобі')
  })

  it('resolveAppSeoTitle: home uses brand', () => {
    const route = {
      path: '/app',
      name: 'home',
      query: {},
      meta: { appTitleKey: 'routes.streamAssist' },
      params: {},
    } as unknown as RouteLocationNormalizedLoaded
    expect(resolveAppSeoTitle(route, t)).toBe('StreamAssist')
  })

  it('resolveAppSeoTitle: nadle includes streamer', () => {
    const route = {
      path: '/app/nadle/foo',
      name: 'nadle-streamer',
      query: {},
      meta: { appTitleKey: 'routes.nadle' },
      params: { streamer: 'foo' },
    } as unknown as RouteLocationNormalizedLoaded
    expect(resolveAppSeoTitle(route, t)).toBe('nadle · foo')
  })

  it('resolveAppSeoDescription uses seo.metaDescription', () => {
    const route = {
      path: '/app',
      name: 'home',
      query: {},
      meta: {},
      params: {},
    } as unknown as RouteLocationNormalizedLoaded
    expect(resolveAppSeoDescription(route, t)).toBe('desc-nad1ch')
  })

  it('resolveDefaultOgImageUrl', () => {
    expect(resolveDefaultOgImageUrl('https://example.com')).toBe('https://example.com/og.png')
    expect(resolveDefaultOgImageUrl('')).toBe('')
  })
})
