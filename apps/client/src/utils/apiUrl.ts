/** Same-origin `/api` when unset; e.g. `VITE_API_URL=/app` when the app is served under `/app` and API is `/app/api`. */
export function apiBase(): string {
  const raw = import.meta.env.VITE_API_URL
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim().replace(/\/$/, '')
  }
  return ''
}

export function apiUrl(path: string): string {
  const base = apiBase()
  return base ? `${base}${path}` : path
}
