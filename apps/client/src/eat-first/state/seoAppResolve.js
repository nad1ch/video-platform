import { STREAM_APP_BRAND_NAME, STREAMER_NICK } from '../constants/brand.js'
import { eatViewTitleFromQuery } from './seoEatTitle.js'

/**
 * Resolve document title for `/app/*` shell (SPA). Landing `/` is unchanged (static HTML + LandingPage).
 *
 * @param {import('vue-router').RouteLocationNormalizedLoaded} route
 * @param {(key: string) => string} t — vue-i18n `t`
 * @returns {string}
 */
export function resolveAppSeoTitle(route, t) {
  const brand = STREAM_APP_BRAND_NAME
  const path = route.path || ''

  if (path.startsWith('/app/eat') || route.name === 'eat') {
    return eatViewTitleFromQuery(route.query?.view)
  }

  const key = route.meta?.appTitleKey
  if (key === 'routes.streamAssist') {
    return brand
  }
  if (typeof key === 'string' && key.length > 0) {
    const base = t(key)
    const nm = route.name
    if (nm === 'wordle-streamer' || nm === 'app-streamer') {
      const s = route.params?.streamer
      if (typeof s === 'string' && s.length > 0) {
        return `${base} · ${s}`
      }
    }
    return `${base} · ${brand}`
  }

  return brand
}

/**
 * Default meta description for app routes (i18n).
 *
 * @param {import('vue-router').RouteLocationNormalizedLoaded} route
 * @param {(key: string, values?: Record<string, unknown>) => string} t
 * @returns {string}
 */
export function resolveAppSeoDescription(route, t) {
  void route
  return t('seo.metaDescription', { nick: STREAMER_NICK })
}

/**
 * Absolute URL for default OG/Twitter image (same origin as canonical).
 *
 * @param {string} originTrimmed — no trailing slash
 * @returns {string}
 */
export function resolveDefaultOgImageUrl(originTrimmed) {
  if (!originTrimmed) {
    return ''
  }
  return `${originTrimmed}/og.jpg`
}
