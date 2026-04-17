import { createLogger } from '@/utils/logger'
import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const eatFirstFirebaseLog = createLogger('eat-first:firebase')
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const apiKey = String(import.meta.env.VITE_FIREBASE_API_KEY ?? '').trim()

/**
 * True when minimal Firebase web config is present. Without this we skip init entirely
 * (no invalid-api-key crash; eat-first UI still mounts).
 */
export const isEatFirstFirebaseEnabled = apiKey.length > 0

/** Only passed to `initializeApp` when `isEatFirstFirebaseEnabled` (avoids empty-string apiKey). */
export const firebaseConfig = {
  apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

let _app = null
let _auth = null
let _db = null

if (isEatFirstFirebaseEnabled) {
  _app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
  _auth = getAuth(_app)

  const usePersistentCache =
    import.meta.env.PROD === true ||
    String(import.meta.env.VITE_FIRESTORE_DEV_PERSIST ?? '').toLowerCase() === 'true'

  const firestoreSingletonKey = '__eat_first_overlay_firestore__'

  function createFirestore() {
    return initializeFirestore(_app, {
      localCache: usePersistentCache
        ? persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          })
        : memoryLocalCache(),
    })
  }

  _db =
    globalThis[firestoreSingletonKey] ?? (globalThis[firestoreSingletonKey] = createFirestore())
} else if (import.meta.env.DEV) {
  eatFirstFirebaseLog.warn(
    'Firebase disabled (missing VITE_FIREBASE_API_KEY). Lobby/game features need .env.local.',
  )
}

/** @type {import('firebase/app').FirebaseApp | null} */
export const app = _app
/** @type {import('firebase/auth').Auth | null} */
export const auth = _auth
/** @type {import('firebase/firestore').Firestore | null} */
export const db = _db
