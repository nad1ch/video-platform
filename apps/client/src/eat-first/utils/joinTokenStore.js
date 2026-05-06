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
const ACTIVE_SLOT_SESSION_PREFIX = 'eat-first:active-slot-v1:'

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

/**
 * Enumerate every (slotId, token) tuple this device has stored for a game.
 * Used by the call client to claim its Eat First slot via signaling so the
 * server can map `peerId → slotId` for trait/action-card lookups. The list is
 * intentionally not deduplicated against currently-active slots — the server
 * verifies each entry against `EatFirstPlayer.data` and silently rejects stale
 * tokens.
 */
export function listEatFirstJoinTokensForGame(gameId) {
  const gid = String(gameId ?? '').trim()
  if (!gid) return []
  const out = []
  const all = readAll()
  for (const [k, v] of Object.entries(all)) {
    if (typeof v !== 'string' || v.length < 1) continue
    const idx = k.indexOf('|')
    if (idx < 1) continue
    const g = k.slice(0, idx)
    const s = k.slice(idx + 1)
    if (g === gid && s.length > 0) {
      out.push({ slotId: s, token: v })
    }
  }
  return out
}

/** Stable numeric rank for Eat First slot ids `p1`..`p11` (unknown slots sort last). */
function eatFirstSlotRank(slotId) {
  const m = /^p([1-9]|10|11)$/i.exec(String(slotId ?? '').trim())
  return m ? Number(m[1]) : 999
}

/**
 * When sessionStorage has no active slot but localStorage holds multiple join tokens,
 * pick one deterministic candidate so call signaling can still send `eat:slot-claim`.
 */
export function pickPrimaryEatFirstJoinTokenForGame(gameId) {
  const list = listEatFirstJoinTokensForGame(gameId)
  if (list.length < 1) return null
  const sorted = [...list].sort((a, b) => eatFirstSlotRank(a.slotId) - eatFirstSlotRank(b.slotId))
  const chosen = sorted[0]
  if (!chosen || typeof chosen.slotId !== 'string' || typeof chosen.token !== 'string') return null
  const sid = chosen.slotId.trim()
  const tok = chosen.token.trim()
  if (!sid || !tok) return null
  return { slotId: sid, token: tok }
}

function activeSlotSessionKey(gameId) {
  const gid = String(gameId ?? '').trim()
  return gid ? `${ACTIVE_SLOT_SESSION_PREFIX}${gid}` : ''
}

/**
 * Tab-scoped active slot identity used by call signaling:
 * one tab/peer => one slot claim.
 *
 * Stored in sessionStorage (not localStorage) so opening a new tab does not
 * auto-steal/replay another tab's player slot. A refresh of the same tab keeps
 * identity.
 */
export function setActiveEatFirstSlotForSession(gameId, slotId, joinToken, deviceId) {
  const k = activeSlotSessionKey(gameId)
  const gid = String(gameId ?? '').trim()
  const sid = String(slotId ?? '').trim()
  const tok = String(joinToken ?? '').trim()
  const dev = String(deviceId ?? '').trim()
  if (!k || !gid || !sid || !tok || !dev) return
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(k, JSON.stringify({ gameId: gid, slotId: sid, joinToken: tok, deviceId: dev }))
  } catch {
    /* private mode / quota */
  }
}

export function getActiveEatFirstSlotForSession(gameId) {
  const k = activeSlotSessionKey(gameId)
  const expectedGameId = String(gameId ?? '').trim()
  if (!k || typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(k)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const storedGameId = typeof parsed.gameId === 'string' ? parsed.gameId.trim() : ''
    const slotId = typeof parsed.slotId === 'string' ? parsed.slotId.trim() : ''
    const joinToken = typeof parsed.joinToken === 'string' ? parsed.joinToken.trim() : ''
    const deviceId = typeof parsed.deviceId === 'string' ? parsed.deviceId.trim() : ''
    if (!slotId || !joinToken || !deviceId || !storedGameId || storedGameId !== expectedGameId) return null
    return { slotId, joinToken, deviceId }
  } catch {
    return null
  }
}

export function clearActiveEatFirstSlotForSession(gameId) {
  const k = activeSlotSessionKey(gameId)
  if (!k || typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(k)
  } catch {
    /* ignore */
  }
}
