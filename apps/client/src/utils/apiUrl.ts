/**
 * API origin for fetch() and OAuth full-page redirects.
 * - Dev (Vite proxy): leave unset → relative paths like `/api/auth/google`.
 * - Prod (SPA on Pages, API on subdomain): set `VITE_API_URL=https://api.example.com` → `https://api.example.com/api/auth/google`.
 */
export function apiBase(): string {
  const raw = import.meta.env.VITE_API_URL
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim().replace(/\/$/, '')
  }
  return ''
}

/** Absolute or same-origin URL. Always use this for OAuth `window.location` and credentialed `/api/*` calls. */
export function apiUrl(path: string): string {
  const base = apiBase()
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : p
}
