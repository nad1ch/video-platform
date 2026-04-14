import { signInAnonymously } from 'firebase/auth'
import { auth } from '../firebase.js'

let inflight = null

/** Мінімальний anonymous sign-in для Callable (гравець / майбутній хост до promote). */
export function ensureAnonymousAuth() {
  if (typeof window === 'undefined') return Promise.resolve()
  if (!auth) return Promise.resolve()
  if (auth.currentUser) return Promise.resolve()
  if (!inflight) {
    inflight = signInAnonymously(auth).finally(() => {
      inflight = null
    })
  }
  return inflight
}
