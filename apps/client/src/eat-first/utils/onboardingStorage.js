import { HOST_PANEL_QUERY_KEY, HOST_PANEL_QUERY_VALUE } from '../config/access.js'
import { eatViewFromRoute } from '../state/eatFirstRouteUtils.js'
import { readStorageJson, writeStorageJson } from '@/utils/storageJson.js'

const STORAGE_KEY = 'eat-first:onboarding-dismissed:v1'

/**
 * @param {{ path: string, query: Record<string, string | string[] | undefined | null> }} route
 * @returns {'join'|'controlHost'|'controlPlayer'|'overlay'|null}
 */
export function resolveOnboardingTourKeyFromRoute(route) {
  const v = eatViewFromRoute(route)
  if (v === 'join') return 'join'
  if (v === 'overlay') return 'overlay'
  if (v === 'control') {
    const host = route.query[HOST_PANEL_QUERY_KEY]
    const hostStr = Array.isArray(host) ? host[0] : host
    return String(hostStr ?? '') === HOST_PANEL_QUERY_VALUE ? 'controlHost' : 'controlPlayer'
  }
  return null
}

/** @returns {Record<string, boolean>} */
function readMap() {
  if (typeof localStorage === 'undefined') return {}
  const o = readStorageJson(localStorage, STORAGE_KEY, {})
  return o && typeof o === 'object' ? o : {}
}

function writeMap(m) {
  if (typeof localStorage === 'undefined') return
  writeStorageJson(localStorage, STORAGE_KEY, m)
}

/** @param {string} tourKey join | controlHost | controlPlayer | overlay */
export function isOnboardingDismissed(tourKey) {
  const k = String(tourKey ?? '').trim()
  if (!k) return false
  return readMap()[k] === true
}

/** @param {string} tourKey */
export function dismissOnboardingTour(tourKey) {
  const k = String(tourKey ?? '').trim()
  if (!k) return
  const m = { ...readMap(), [k]: true }
  writeMap(m)
}
