import { createLogger } from '@/utils/logger'

/**
 * Єдиний формат логів для відвалювання слухачів Firestore та інших збоїв.
 * У проді — лише errors через `log.error`; listener detach — warn (dev-only у createLogger).
 */
const log = createLogger('eat-first')

function payload(error, extra) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : ''
  const message = error && typeof error === 'object' && 'message' in error ? error.message : String(error ?? '')
  return { ...extra, code, message }
}

export function logListenerDetach(scope, error, meta = {}) {
  const detail = { scope, ...payload(error, meta), at: Date.now() }
  log.warn('firestore listener', detail)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('eat-first:listener-error', { detail }))
  }
}

export function logFirestoreError(scope, error, meta = {}) {
  log.error('firestore', scope, payload(error, meta))
}
