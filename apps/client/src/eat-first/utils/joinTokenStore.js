/**
 * Per-(gameId, slotId) join-token store used to authorize player actions
 * (hand/ready/vote) against the server-side `EatFirstPlayer.data.joinToken`.
 *
 * Populated by `claimPlayerSlot` on a successful claim (the server returns the
 * fresh token). Stays in localStorage so the token survives reloads and the
 * user keeps control of their slot across tab refreshes — mirrors how the
 * device id already persists there.
 */

const STORAGE_KEY = 'eat-first:join-tokens-v1'

function readAll() {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writeAll(next) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* quota/private mode */
  }
}

function key(gameId, slotId) {
  return `${String(gameId ?? '').trim()}|${String(slotId ?? '').trim()}`
}

export function saveEatFirstJoinToken(gameId, slotId, token) {
  const gid = String(gameId ?? '').trim()
  const sid = String(slotId ?? '').trim()
  const tok = typeof token === 'string' ? token.trim() : ''
  if (!gid || !sid || !tok) return
  const all = readAll()
  all[key(gid, sid)] = tok
  writeAll(all)
}

export function getEatFirstJoinToken(gameId, slotId) {
  const gid = String(gameId ?? '').trim()
  const sid = String(slotId ?? '').trim()
  if (!gid || !sid) return ''
  const all = readAll()
  const v = all[key(gid, sid)]
  return typeof v === 'string' ? v : ''
}

export function clearEatFirstJoinToken(gameId, slotId) {
  const gid = String(gameId ?? '').trim()
  const sid = String(slotId ?? '').trim()
  if (!gid || !sid) return
  const all = readAll()
  if (key(gid, sid) in all) {
    delete all[key(gid, sid)]
    writeAll(all)
  }
}
