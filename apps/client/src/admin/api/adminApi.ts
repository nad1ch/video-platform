import { apiFetch, readJsonIfOk } from '@/utils/apiFetch'

/**
 * Shared admin GET helper: 403 is explicit; otherwise JSON when `ok`, same as manual `readJsonIfOk` usage.
 */
export async function adminGetJson<T>(path: string): Promise<
  | { forbidden: true }
  | { forbidden: false; notOk: true }
  | { forbidden: false; notOk: false; data: T | null }
> {
  const r = await apiFetch(path)
  if (r.status === 403) {
    return { forbidden: true }
  }
  if (!r.ok) {
    return { forbidden: false, notOk: true }
  }
  const data = await readJsonIfOk<T>(r)
  return { forbidden: false, notOk: false, data }
}
