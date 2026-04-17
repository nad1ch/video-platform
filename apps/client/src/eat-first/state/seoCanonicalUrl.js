/**
 * Pure URL helpers for rel=canonical / og:url (no Vue, no DOM).
 * Composable `useSeoCanonical` delegates here for testability.
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
