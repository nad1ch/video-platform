import { normalizePlayerSlotId } from './playerSlot.js'

/**
 * Клонує вкладені поля кімнати, щоб Vue гарантовано бачив оновлення (напр. hands.p1).
 * Ключі hands нормалізуємо до p1…p10 — збіг з playerId з URL.
 */
export function normalizeGameRoomPayload(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const out = { ...raw }
  const mergedHands = {}
  if (raw.hands && typeof raw.hands === 'object') {
    for (const [k, v] of Object.entries(raw.hands)) {
      mergedHands[normalizePlayerSlotId(k)] = Boolean(v)
    }
  }
  const legacyPrefix = 'hands.'
  for (const key of Object.keys(raw)) {
    if (typeof key !== 'string' || !key.startsWith(legacyPrefix)) continue
    const slot = key.slice(legacyPrefix.length)
    if (!slot) continue
    mergedHands[normalizePlayerSlotId(slot)] = Boolean(raw[key])
    delete out[key]
  }
  out.hands = mergedHands
  const mergedReady = {}
  if (raw.playersReady && typeof raw.playersReady === 'object') {
    for (const [k, v] of Object.entries(raw.playersReady)) {
      if (v === true) mergedReady[normalizePlayerSlotId(k)] = true
    }
  }
  out.playersReady = mergedReady
  if (raw.voting && typeof raw.voting === 'object') {
    out.voting = { ...raw.voting }
  }
  if (Array.isArray(raw.nominations)) {
    out.nominations = raw.nominations.map((n) => (n && typeof n === 'object' ? { ...n } : n))
  }
  if (Array.isArray(raw.voteTargetsThisRound)) {
    out.voteTargetsThisRound = raw.voteTargetsThisRound
      .map((id) => normalizePlayerSlotId(String(id ?? '')))
      .filter(Boolean)
  }
  return out
}
