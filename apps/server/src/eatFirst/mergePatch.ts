/** JSON merge: object patches recurse; `null` removes a key (JSON Merge Patch style). */
export function mergeJson(existing: unknown, patch: unknown): unknown {
  if (patch === null || patch === undefined) {
    return existing
  }
  if (typeof patch !== 'object' || Array.isArray(patch)) {
    return patch
  }
  const base =
    typeof existing === 'object' && existing !== null && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {}
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (v === null) {
      delete base[k]
      continue
    }
    if (
      typeof v === 'object' &&
      v !== null &&
      !Array.isArray(v) &&
      typeof base[k] === 'object' &&
      base[k] !== null &&
      !Array.isArray(base[k])
    ) {
      base[k] = mergeJson(base[k], v) as Record<string, unknown>
    } else {
      base[k] = v
    }
  }
  return base
}
