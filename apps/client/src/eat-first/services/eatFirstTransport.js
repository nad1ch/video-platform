const PREFIX = '/api/eat-first'

// X-Requested-With accompanies every mutation so the server's CSRF guard accepts
// the request even when the browser omits `Origin`. Matches apps/client/src/utils/apiFetch.ts.
const CSRF_HEADER = { 'X-Requested-With': 'streamassist-fetch' }

async function jfetch(path, init = {}) {
  const res = await fetch(`${PREFIX}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...CSRF_HEADER,
      ...(init.headers || {}),
    },
    ...init,
  })
  if (res.status === 204) return null
  const text = await res.text()
  if (!res.ok) throw new Error(text || res.statusText)
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function efSnapshot(gameId) {
  return jfetch(`/games/${encodeURIComponent(gameId)}/snapshot`, { method: 'GET' })
}

/** @returns {Promise<boolean>} true if the game was newly created */
export async function efEnsureGame(gameId) {
  const data = await jfetch(`/games/${encodeURIComponent(gameId)}/ensure`, { method: 'POST', body: '{}' })
  return Boolean(data && data.created)
}

export async function efPatchRoom(gameId, patch) {
  await jfetch(`/games/${encodeURIComponent(gameId)}/room`, {
    method: 'PATCH',
    body: JSON.stringify({ patch }),
  })
}

export async function efPostHand(gameId, playerId, raised, auth) {
  const body = { playerId, raised }
  if (auth && typeof auth === 'object') {
    if (typeof auth.joinToken === 'string' && auth.joinToken.length > 0) body.joinToken = auth.joinToken
    if (typeof auth.deviceId === 'string' && auth.deviceId.length > 0) body.deviceId = auth.deviceId
  }
  await jfetch(`/games/${encodeURIComponent(gameId)}/hand`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function efPostReady(gameId, playerId, ready, auth) {
  const body = { playerId, ready }
  if (auth && typeof auth === 'object') {
    if (typeof auth.joinToken === 'string' && auth.joinToken.length > 0) body.joinToken = auth.joinToken
    if (typeof auth.deviceId === 'string' && auth.deviceId.length > 0) body.deviceId = auth.deviceId
  }
  await jfetch(`/games/${encodeURIComponent(gameId)}/ready`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function efClaimSlot(gameId, slotId, deviceId, name) {
  return jfetch(`/games/${encodeURIComponent(gameId)}/players/${encodeURIComponent(slotId)}/claim`, {
    method: 'POST',
    body: JSON.stringify({ deviceId, name: name ?? '' }),
  })
}

export async function efPatchPlayer(gameId, slotId, patch) {
  await jfetch(`/games/${encodeURIComponent(gameId)}/players/${encodeURIComponent(slotId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ patch }),
  })
}

export async function efDeletePlayer(gameId, slotId) {
  await jfetch(`/games/${encodeURIComponent(gameId)}/players/${encodeURIComponent(slotId)}`, {
    method: 'DELETE',
    body: JSON.stringify({}),
  })
}

export async function efSubmitVote(gameId, voterPlayerId, targetPlayer, choice, round, auth) {
  const body = { voterPlayerId, targetPlayer, choice, round }
  if (auth && typeof auth === 'object') {
    if (typeof auth.joinToken === 'string' && auth.joinToken.length > 0) body.joinToken = auth.joinToken
    if (typeof auth.deviceId === 'string' && auth.deviceId.length > 0) body.deviceId = auth.deviceId
  }
  return jfetch(`/games/${encodeURIComponent(gameId)}/votes/submit`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function efClearVotes(gameId) {
  await jfetch(`/games/${encodeURIComponent(gameId)}/votes/clear`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function efDeleteVote(gameId, voterId) {
  await jfetch(`/games/${encodeURIComponent(gameId)}/votes/delete`, {
    method: 'POST',
    body: JSON.stringify({ voterId }),
  })
}

export async function efReviveEliminated(gameId) {
  return jfetch(`/games/${encodeURIComponent(gameId)}/players/revive-eliminated`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}
