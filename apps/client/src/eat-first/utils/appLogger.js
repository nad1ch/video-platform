/**
 * Єдиний формат логів для відвалювання слухачів Firestore та інших збоїв.
 * У проді залишаємо warn (не spam error), деталі — для дебагу.
 */
const NS = '[eat-first]'

function payload(error, extra) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : ''
  const message = error && typeof error === 'object' && 'message' in error ? error.message : String(error ?? '')
  return { ...extra, code, message }
}

export function logListenerDetach(scope, error, meta = {}) {
  const detail = { scope, ...payload(error, meta), at: Date.now() }
  console.warn(`${NS} firestore listener`, detail)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('eat-first:listener-error', { detail }))
  }
}

export function logFirestoreError(scope, error, meta = {}) {
  console.error(`${NS} firestore`, scope, payload(error, meta))
}
