import { isEatFirstFirebaseEnabled } from '../firebase.js'
import { callableApiEnabledFromFlags, trimFunctionsRegionEnv } from './callableApiPure.js'

/** Регіон deploy Cloud Functions (наприклад europe-west1). Якщо порожньо — легасі-прямі записи у Firestore. */
export function callableRegion() {
  return trimFunctionsRegionEnv(import.meta.env.VITE_FUNCTIONS_REGION)
}

export function callableApiEnabled() {
  return callableApiEnabledFromFlags(isEatFirstFirebaseEnabled, callableRegion())
}
