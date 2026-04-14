import { normalizePlayerSlotId } from './playerSlot.js'

/** Як довго пам’ятати останній слот гравця для кімнати. */
export const PLAYER_SLOT_TTL_MS = 30 * 24 * 60 * 60 * 1000

const PREFIX = 'eat-first:player-slot-v1:'

function storageKey(gameId) {
  const g = String(gameId ?? '').trim().slice(0, 96)
  return g ? PREFIX + g : ''
}

export function saveLastPlayerSlot(gameId, playerId) {
  const sk = storageKey(gameId)
  if (!sk || typeof localStorage === 'undefined') return
  const p = normalizePlayerSlotId(playerId)
  try {
    localStorage.setItem(sk, JSON.stringify({ v: 1, exp: Date.now() + PLAYER_SLOT_TTL_MS, p }))
  } catch {
    /* ignore */
  }
}

export function getValidatedLastPlayerSlot(gameId) {
  const sk = storageKey(gameId)
  if (!sk || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(sk)
    if (!raw) return null
    const o = JSON.parse(raw)
    if (!o || o.v !== 1 || typeof o.exp !== 'number' || typeof o.p !== 'string') return null
    if (Date.now() > o.exp) {
      localStorage.removeItem(sk)
      return null
    }
    return normalizePlayerSlotId(o.p)
  } catch {
    return null
  }
}

export function clearLastPlayerSlot(gameId) {
  const sk = storageKey(gameId)
  if (!sk || typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(sk)
  } catch {
    /* ignore */
  }
}

/** Чи в URL явно задано слот (навіть p1), щоб не перезаписувати вибір з localStorage. */
export function routeHasExplicitPlayerSlot(query) {
  if (!query || typeof query !== 'object') return false
  return (
    Object.prototype.hasOwnProperty.call(query, 'player') &&
    String(query.player ?? '').trim() !== ''
  )
}
