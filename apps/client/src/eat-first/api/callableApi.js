import { trimFunctionsRegionEnv } from './callableApiPure.js'

export function callableRegion() {
  return trimFunctionsRegionEnv(import.meta.env.VITE_FUNCTIONS_REGION)
}

/**
 * Firebase Callable + Firestore path is retired — eat-first uses `/api/eat-first` + Postgres.
 * Kept as `false` so legacy branches stay dead without importing Firebase.
 */
export function callableApiEnabled() {
  return false
}
