/** Trim `VITE_API_URL`-style env: non-empty string → no trailing slash; else `''`. */
export function trimApiBaseEnv(raw: unknown): string {
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim().replace(/\/$/, '')
  }
  return ''
}

/**
 * Same-origin API prefix when `apiBase` is empty: Vite `BASE_URL` without trailing slash, or `''` at `/`.
 */
export function sameOriginPrefixFromBaseUrl(apiBaseTrimmed: string, baseUrl: unknown): string {
  if (apiBaseTrimmed) {
    return apiBaseTrimmed
  }
  const b = typeof baseUrl === 'string' && baseUrl.length > 0 ? baseUrl : '/'
  if (b === '/' || b === '') {
    return ''
  }
  return b.replace(/\/$/, '')
}

/** Join optional same-origin prefix with an API path (leading `/` normalized). */
export function buildApiUrl(prefix: string, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return prefix ? `${prefix}${p}` : p
}
