/**
 * Public browser origin for post-OAuth redirects and Wordle links.
 * In production, set `BASE_URL` or `WORDLE_CLIENT_ORIGIN` — no localhost fallback.
 */
export function clientPublicOrigin(): string {
  const raw = process.env.BASE_URL ?? process.env.WORDLE_CLIENT_ORIGIN
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim().replace(/\/$/, '')
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Production requires BASE_URL or WORDLE_CLIENT_ORIGIN (public SPA origin, no trailing slash).',
    )
  }
  return 'http://localhost:5173'
}

/**
 * Origins allowed for credentialed CORS. The server must echo the request's `Origin` when it matches.
 * Always includes local Vite; adds `BASE_URL` / `WORDLE_CLIENT_ORIGIN`; optional `CORS_ORIGINS` (comma-separated).
 */
export function corsAllowedOrigins(): string[] {
  const set = new Set<string>()
  set.add('http://localhost:5173')
  const raw = process.env.BASE_URL ?? process.env.WORDLE_CLIENT_ORIGIN
  if (typeof raw === 'string' && raw.trim().length > 0) {
    set.add(raw.trim().replace(/\/$/, ''))
  }
  for (const part of (process.env.CORS_ORIGINS ?? '').split(',')) {
    const t = part.trim().replace(/\/$/, '')
    if (t.length > 0) {
      set.add(t)
    }
  }
  return [...set]
}
