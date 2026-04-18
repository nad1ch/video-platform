/**
 * Pure URL helpers for rel=canonical / og:url (no Vue, no DOM).
 * `useSeoApp` delegates here for testability.
 */

/** Strip trailing slash from configured origin (same as previous inline `.replace(/\/$/, '')`). */
export function trimCanonicalOrigin(raw) {
  return String(raw ?? '').replace(/\/$/, '')
}

/**
 * @param {string} originTrimmed — already trimmed origin, no trailing `/`
 * @param {string} [fullPath] — route.fullPath
 * @returns {string} absolute URL, or `''` if origin is empty
 */
export function buildCanonicalAbsoluteUrl(originTrimmed, fullPath) {
  if (!originTrimmed) {
    return ''
  }
  const path = fullPath || '/'
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${originTrimmed}${suffix}`
}

/**
 * Query keys that should not affect canonical (tracking, auth modal, etc.). Content keys (e.g. `view`, `game`) stay.
 * @type {ReadonlySet<string>}
 */
const CANONICAL_NOISE_QUERY_KEYS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'msclkid',
  '_ga',
  'needLogin',
  'authRedirect',
])

/**
 * Vue Router `fullPath` is path + query + hash. Canonical URLs should omit hash and strip noise query params.
 *
 * @param {string} [routerFullPath] — `route.fullPath`
 * @returns {string} path + filtered search (no hash), always starting with `/`
 */
export function canonicalRelativePathForSeo(routerFullPath) {
  const raw = String(routerFullPath ?? '').trim() || '/'
  let pathPart = raw.startsWith('/') ? raw : `/${raw}`
  const hashIdx = pathPart.indexOf('#')
  if (hashIdx !== -1) {
    pathPart = pathPart.slice(0, hashIdx)
  }
  const qIdx = pathPart.indexOf('?')
  const pathname = (qIdx === -1 ? pathPart : pathPart.slice(0, qIdx)) || '/'
  const search = qIdx === -1 ? '' : pathPart.slice(qIdx + 1)
  if (!search) {
    return pathname
  }
  const params = new URLSearchParams(search)
  /** @type {Array<[string, string]>} */
  const entries = []
  for (const [k, v] of params.entries()) {
    if (CANONICAL_NOISE_QUERY_KEYS.has(k)) {
      continue
    }
    if (v === '' || v == null) {
      continue
    }
    entries.push([k, v])
  }
  entries.sort((a, b) => a[0].localeCompare(b[0]))
  const next = new URLSearchParams()
  for (const [k, v] of entries) {
    next.append(k, v)
  }
  const q = next.toString()
  return `${pathname}${q ? `?${q}` : ''}`
}

/**
 * Runtime canonical base for the SPA: avoid pointing local dev at production `VITE_PUBLIC_CANONICAL_ORIGIN`.
 * - DEV: always `windowOrigin` when present (e.g. http://localhost:5173).
 * - PROD: prefer `vitePublicCanonicalOrigin` when set; else `windowOrigin`.
 *
 * @param {{ dev: boolean, vitePublicCanonicalOrigin?: string, windowOrigin?: string }} opts
 * @returns {string} trimmed origin or ''
 */
export function resolveCanonicalOriginForClient(opts) {
  const dev = Boolean(opts?.dev)
  const vite =
    typeof opts?.vitePublicCanonicalOrigin === 'string' ? opts.vitePublicCanonicalOrigin.trim() : ''
  const win = typeof opts?.windowOrigin === 'string' ? opts.windowOrigin.trim() : ''

  if (dev && win) {
    return trimCanonicalOrigin(win)
  }
  if (vite) {
    return trimCanonicalOrigin(vite)
  }
  if (win) {
    return trimCanonicalOrigin(win)
  }
  return ''
}
