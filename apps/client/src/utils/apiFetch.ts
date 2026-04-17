import { apiUrl } from '@/utils/apiUrl'

/**
 * Same-origin API `fetch` with `credentials: 'include'` (session cookie).
 * Pass `path` as for `apiUrl` (e.g. `/api/auth/me`). Optional `init` overrides/extends defaults.
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), { credentials: 'include', ...init })
}

/** Alias for callers that prefer the `*Json` name; still returns `Response` (parse in caller). */
export const apiFetchJson = apiFetch

/**
 * Parse JSON when `res.ok` is true. Returns `null` if the status is not OK or the body is not JSON.
 * Prefer this over duplicating `if (!res.ok) …; return res.json()` at call sites.
 */
export async function readJsonIfOk<T>(res: Response): Promise<T | null> {
  if (!res.ok) {
    return null
  }
  try {
    return (await res.json()) as T
  } catch {
    return null
  }
}
