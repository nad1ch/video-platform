import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { AuthMode } from '@/types/authMode'

/** Stable auth page query: keep `redirect`, set `mode`, drop noise. */
export function replaceAuthQuery(
  route: RouteLocationNormalizedLoaded,
  mode: AuthMode,
): { redirect?: string; mode: AuthMode } {
  const out: { redirect?: string; mode: AuthMode } = { mode }
  const r = route.query.redirect
  const redir = typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : undefined
  if (redir) {
    out.redirect = redir
  }
  return out
}
