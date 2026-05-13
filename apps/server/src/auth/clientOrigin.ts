



const DEFAULT_CLIENT_ORIGINS = Object.freeze([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'https://app.streamassist.net',
])

function normalizeOrigin(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().replace(/\/$/, '') : ''
}

export function clientPublicOrigin(): string {
  const raw = process.env.BASE_URL ?? process.env.NADLE_CLIENT_ORIGIN
  const normalized = normalizeOrigin(raw)
  if (normalized.length > 0) {
    return normalized
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Production requires BASE_URL or NADLE_CLIENT_ORIGIN (public SPA origin, no trailing slash).',
    )
  }
  return 'http://localhost:5173'
}

/**
 * Origins allowed for credentialed CORS. The server must echo the request's `Origin` when it matches.
 * Always includes local Vite; adds `BASE_URL` / `NADLE_CLIENT_ORIGIN`; optional `CORS_ORIGINS` (comma-separated).
 */
export function corsAllowedOrigins(): string[] {
  const set = new Set<string>()
  for (const origin of DEFAULT_CLIENT_ORIGINS) {
    set.add(origin)
  }
  const raw = process.env.BASE_URL ?? process.env.NADLE_CLIENT_ORIGIN
  const normalizedPrimary = normalizeOrigin(raw)
  if (normalizedPrimary.length > 0) {
    set.add(normalizedPrimary)
  }
  for (const part of (process.env.CORS_ORIGINS ?? '').split(',')) {
    const t = normalizeOrigin(part)
    if (t.length > 0) {
      set.add(t)
    }
  }
  return [...set]
}
