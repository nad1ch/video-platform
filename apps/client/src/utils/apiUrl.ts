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





export function sameOriginApiPrefix(): string {
  return sameOriginPrefixFromBaseUrl(apiBase(), import.meta.env.BASE_URL ?? '/')
}


export function apiUrl(path: string): string {
  return buildApiUrl(sameOriginApiPrefix(), path)
}
