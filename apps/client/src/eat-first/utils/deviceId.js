const STORAGE_KEY = 'eat-first:device-id-v1'

function randomId() {
  try {
    const a = new Uint8Array(16)
    crypto.getRandomValues(a)
    return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`
  }
}

/** Стабільний ідентифікатор пристрою/браузера для «зайняття» слота. */
export function getOrCreateDeviceId() {
  if (typeof localStorage === 'undefined') return randomId()
  try {
    let v = String(localStorage.getItem(STORAGE_KEY) ?? '').trim()
    if (v.length >= 16) return v
    v = randomId()
    localStorage.setItem(STORAGE_KEY, v)
    return v
  } catch {
    return randomId()
  }
}
