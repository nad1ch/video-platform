import { buildApiUrl, sameOriginPrefixFromBaseUrl, trimApiBaseEnv } from '@/utils/apiUrlPure'

/**
 * API origin for fetch() and OAuth full-page redirects.
 * - Dev (Vite proxy at site root): leave `VITE_API_URL` unset → `/api/...`.
 * - SPA under a subpath (e.g. Cloudflare Pages `/app`): either set `VITE_API_URL=/app` or rely on
 *   Vite `base` — `sameOriginApiPrefix()` prepends `import.meta.env.BASE_URL` so requests hit `/app/api/...`.
 * - API on another host: `VITE_API_URL=https://api.example.com` → `https://api.example.com/api/...`.
 */
export function apiBase(): string {
  return trimApiBaseEnv(import.meta.env.VITE_API_URL)
}

/**
 * Path or absolute URL prefix for same-origin API/WebSocket calls.
 * Prefer explicit `VITE_API_URL`; otherwise uses Vite `BASE_URL` when the app is not at `/` (e.g. `/app`).
 */
export function sameOriginApiPrefix(): string {
  return sameOriginPrefixFromBaseUrl(apiBase(), import.meta.env.BASE_URL ?? '/')
}

/** Absolute or same-origin URL. Always use this for OAuth `window.location` and credentialed `/api/*` calls. */
export function apiUrl(path: string): string {
  return buildApiUrl(sameOriginApiPrefix(), path)
}
