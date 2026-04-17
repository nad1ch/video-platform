/**
 * Pure helpers for Cloud Functions gating (no Firebase import). Used by `callableApi.js` and tests.
 */

export function trimFunctionsRegionEnv(value) {
  return String(value ?? '').trim()
}

/** @param {unknown} functionsRegionRaw — trimmed inside (same end state as `callableRegion()`). */
export function callableApiEnabledFromFlags(firebaseConfigured, functionsRegionRaw) {
  return Boolean(firebaseConfigured) && Boolean(trimFunctionsRegionEnv(functionsRegionRaw))
}
