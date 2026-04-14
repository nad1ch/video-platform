import { isEatFirstFirebaseEnabled } from '../firebase.js'

/** Регіон deploy Cloud Functions (наприклад europe-west1). Якщо порожньо — легасі-прямі записи у Firestore. */
export function callableRegion() {
  return String(import.meta.env.VITE_FUNCTIONS_REGION ?? '').trim()
}

export function callableApiEnabled() {
  return isEatFirstFirebaseEnabled && Boolean(callableRegion())
}
