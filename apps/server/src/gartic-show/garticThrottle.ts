const lastGarticGuessByUser = new Map<string, number>()

function key(streamerId: string, userId: string): string {
  return `${streamerId}:${userId}`
}

/** Per-user cooldown between guesses in Gartic (default 2000 ms). */
export function garticGuessCooldownMs(): number {
  return 2000
}

export function tryConsumeGarticGuessThrottle(streamerId: string, userId: string): boolean {
  const now = Date.now()
  const cd = garticGuessCooldownMs()
  const k = key(streamerId, userId)
  const last = lastGarticGuessByUser.get(k) ?? 0
  if (now - last < cd) {
    return false
  }
  lastGarticGuessByUser.set(k, now)
  return true
}

export function clearGarticGuessThrottleForStreamer(streamerId: string): void {
  const prefix = `${streamerId}:`
  for (const k of [...lastGarticGuessByUser.keys()]) {
    if (k.startsWith(prefix)) {
      lastGarticGuessByUser.delete(k)
    }
  }
}
