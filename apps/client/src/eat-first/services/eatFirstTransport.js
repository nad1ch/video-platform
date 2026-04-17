const PREFIX = '/api/eat-first'

async function jfetch(path, init = {}) {
  const res = await fetch(`${PREFIX}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
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

export async function efPostHand(gameId, playerId, raised) {
  await jfetch(`/games/${encodeURIComponent(gameId)}/hand`, {
    method: 'POST',
    body: JSON.stringify({ playerId, raised }),
  })
}

export async function efPostReady(gameId, playerId, ready) {
  await jfetch(`/games/${encodeURIComponent(gameId)}/ready`, {
    method: 'POST',
    body: JSON.stringify({ playerId, ready }),
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

export async function efSubmitVote(gameId, voterPlayerId, targetPlayer, choice, round) {
  return jfetch(`/games/${encodeURIComponent(gameId)}/votes/submit`, {
    method: 'POST',
    body: JSON.stringify({ voterPlayerId, targetPlayer, choice, round }),
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
