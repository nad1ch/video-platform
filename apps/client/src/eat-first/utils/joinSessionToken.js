function key(gameId, playerId) {
  return `eat-first:join-token:${String(gameId).trim()}:${String(playerId).trim()}`
}

export function getJoinSessionToken(gameId, playerId) {
  if (typeof sessionStorage === 'undefined') return ''
  try {
    return String(sessionStorage.getItem(key(gameId, playerId)) ?? '').trim()
  } catch {
    return ''
  }
}

export function setJoinSessionToken(gameId, playerId, token) {
  const t = String(token ?? '').trim()
  if (!t || typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(key(gameId, playerId), t)
  } catch {
    /* quota / приватний режим */
  }
}

export function clearJoinSessionToken(gameId, playerId) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(key(gameId, playerId))
  } catch {
    /* */
  }
}
