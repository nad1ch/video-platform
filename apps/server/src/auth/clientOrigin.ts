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
