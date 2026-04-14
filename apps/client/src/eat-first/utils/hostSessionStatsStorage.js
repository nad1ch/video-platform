/** Локальна статистика ведучого для gameId: історія голосувань + лічильник підняття рук (до скидання кімнати / очистки). */

const KEY_PREFIX = 'eat-first:host-session-stats:v1:'

const MAX_VOTE_SESSIONS = 50

/**
 * @typedef {{ voter: string, choice: 'for' | 'against' }} VoteRecord
 * @typedef {{
 *   id: string,
 *   endedAt: number,
 *   round: number,
 *   target: string,
 *   votes: VoteRecord[],
 * }} VoteSessionEntry
 */

function defaultStats() {
  return { v: 1, voteSessions: [], handRaises: {} }
}

/**
 * @param {unknown} o
 * @returns {{ v: 1, voteSessions: VoteSessionEntry[], handRaises: Record<string, number> }}
 */
function normalizeStats(o) {
  if (!o || typeof o !== 'object') return defaultStats()
  const voteSessions = []
  if (Array.isArray(o.voteSessions)) {
    for (const s of o.voteSessions) {
      if (!s || typeof s !== 'object') continue
      const id = typeof s.id === 'string' ? s.id : `${s.endedAt || Date.now()}-x`
      const votes = []
      if (Array.isArray(s.votes)) {
        for (const v of s.votes) {
          if (!v || typeof v !== 'object') continue
          const voter = String(v.voter ?? '').trim()
          if (!voter) continue
          const choice = v.choice === 'against' ? 'against' : 'for'
          votes.push({ voter, choice })
        }
      }
      const slotCount = Math.max(1, Math.floor(Number(s.slotCount) || 1))
      voteSessions.push({
        id,
        endedAt: Math.floor(Number(s.endedAt) || 0) || Date.now(),
        round: Math.min(8, Math.max(1, Math.floor(Number(s.round) || 1))),
        target: String(s.target ?? '').trim(),
        ballotRunId: typeof s.ballotRunId === 'string' ? s.ballotRunId : '',
        syntheticEmptyRun: s.syntheticEmptyRun === true,
        slotCount,
        votes,
      })
    }
  }
  const handRaises = {}
  if (o.handRaises && typeof o.handRaises === 'object') {
    for (const [k, n] of Object.entries(o.handRaises)) {
      const kk = String(k).trim()
      if (!kk) continue
      const num = Math.max(0, Math.floor(Number(n) || 0))
      if (num > 0) handRaises[kk] = num
    }
  }
  return { v: 1, voteSessions: voteSessions.slice(0, MAX_VOTE_SESSIONS), handRaises }
}

/**
 * @param {string} gameId
 */
export function loadHostSessionStats(gameId) {
  const gid = String(gameId ?? '').trim()
  if (!gid || typeof localStorage === 'undefined') return defaultStats()
  try {
    const raw = localStorage.getItem(KEY_PREFIX + gid)
    if (!raw) return defaultStats()
    const o = JSON.parse(raw)
    return normalizeStats(o)
  } catch {
    return defaultStats()
  }
}

/**
 * @param {string} gameId
 * @param {{ voteSessions: VoteSessionEntry[], handRaises: Record<string, number> }} data
 */
export function saveHostSessionStats(gameId, data) {
  const gid = String(gameId ?? '').trim()
  if (!gid || typeof localStorage === 'undefined') return
  try {
    const payload = {
      v: 1,
      voteSessions: (data.voteSessions || []).slice(0, MAX_VOTE_SESSIONS),
      handRaises: data.handRaises && typeof data.handRaises === 'object' ? data.handRaises : {},
    }
    localStorage.setItem(KEY_PREFIX + gid, JSON.stringify(payload))
  } catch {
    /* quota */
  }
}

/**
 * @param {string} gameId
 */
export function clearHostSessionStats(gameId) {
  const gid = String(gameId ?? '').trim()
  if (!gid || typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(KEY_PREFIX + gid)
  } catch {
    /* */
  }
}
