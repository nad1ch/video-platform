/**
 * Minimal JSON helpers for localStorage/sessionStorage (silent failures).
 */

/**
 * @param {Storage | null | undefined} storage
 * @param {string} key
 * @param {unknown} fallback returned when missing, empty, or parse error
 */
export function readStorageJson(storage, key, fallback) {
  if (storage == null || typeof storage === 'undefined') {
    return fallback
  }
  try {
    const raw = storage.getItem(key)
    if (raw == null || raw === '') {
      return fallback
    }
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

/**
 * @param {Storage | null | undefined} storage
 * @param {string} key
 * @param {unknown} value
 */
export function writeStorageJson(storage, key, value) {
  if (storage == null || typeof storage === 'undefined') {
    return
  }
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota / private mode */
  }
}
