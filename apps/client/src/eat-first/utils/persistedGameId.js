/** Останній обраний game id — переживає оновлення сторінки та перехід без `?game=` у URL. */
const KEY = 'eat-first:last-game-id'
const MAX_LEN = 96

export function getPersistedGameId() {
  if (typeof localStorage === 'undefined') return null
  try {
    const s = localStorage.getItem(KEY)
    const t = String(s ?? '').trim()
    if (!t || t.length > MAX_LEN) return null
    return t
  } catch {
    return null
  }
}

export function setPersistedGameId(id) {
  if (typeof localStorage === 'undefined') return
  try {
    const t = String(id ?? '').trim()
    if (!t || t.length > MAX_LEN) return
    localStorage.setItem(KEY, t)
  } catch {
    /* quota / приватний режим */
  }
}
