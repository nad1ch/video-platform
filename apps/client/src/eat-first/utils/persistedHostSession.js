/** Термін збереження доступу ведучого на пристрої (після успішного вводу ключа). */
export const HOST_ACCESS_TTL_MS = 14 * 24 * 60 * 60 * 1000

const STORAGE_KEY = 'eat-first:host-access-v1'

/**
 * @param {string} adminKey — значення, що збіглося з ADMIN_KEY
 */
export function saveHostAccessSession(adminKey) {
  const k = String(adminKey ?? '').trim()
  if (!k || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: 1, exp: Date.now() + HOST_ACCESS_TTL_MS, k }),
    )
  } catch {
    /* quota / приватний режим */
  }
}

/**
 * Повертає збережений ключ лише якщо термін дійсний і він збігається з поточним ADMIN_KEY (після деплою з новим ключем сесія скидається).
 * @param {string} expectedAdminKey — імпортований ADMIN_KEY з конфігу
 * @returns {string | null}
 */
export function getValidatedPersistedHostKey(expectedAdminKey) {
  const exp = String(expectedAdminKey ?? '').trim()
  if (!exp || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw)
    if (!o || o.v !== 1 || typeof o.exp !== 'number' || typeof o.k !== 'string') return null
    if (Date.now() > o.exp) {
      clearHostAccessSession()
      return null
    }
    if (o.k !== exp) {
      clearHostAccessSession()
      return null
    }
    return o.k
  } catch {
    return null
  }
}

export function clearHostAccessSession() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
