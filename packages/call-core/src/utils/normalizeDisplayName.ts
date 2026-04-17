/**
 * Single canonical trimming / coercion for display-name-like strings in call-core.
 * Pure — no Pinia or I/O.
 */
export function normalizeDisplayName(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'string') {
    return value.trim()
  }
  return String(value).trim()
}
