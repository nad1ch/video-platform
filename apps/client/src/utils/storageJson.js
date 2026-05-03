








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
