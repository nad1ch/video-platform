import { readStorageJson, writeStorageJson } from '@/utils/storageJson.js'

const STORAGE_KEY = 'eat-first:onboarding-dismissed:v1'

/**
 * After the legacy `view=overlay|control|admin` panels were removed there is
 * only one Eat First onboarding tour ("call"). The route param is no longer
 * inspected here.
 */
export function resolveOnboardingTourKeyFromRoute(route) {
  return route?.path && String(route.path).startsWith('/app/eat') ? 'call' : null
}


function readMap() {
  if (typeof localStorage === 'undefined') return {}
  const o = readStorageJson(localStorage, STORAGE_KEY, {})
  return o && typeof o === 'object' ? o : {}
}

function writeMap(m) {
  if (typeof localStorage === 'undefined') return
  writeStorageJson(localStorage, STORAGE_KEY, m)
}


export function isOnboardingDismissed(tourKey) {
  const k = String(tourKey ?? '').trim()
  if (!k) return false
  return readMap()[k] === true
}


export function dismissOnboardingTour(tourKey) {
  const k = String(tourKey ?? '').trim()
  if (!k) return
  const m = { ...readMap(), [k]: true }
  writeMap(m)
}
