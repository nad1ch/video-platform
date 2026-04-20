const lastNadrawGuessByUser = new Map<string, number>()

function key(streamerId: string, userId: string): string {
  return `${streamerId}:${userId}`
}

/** Per-user cooldown between guesses in Nadraw (default 2000 ms). */
export function nadrawGuessCooldownMs(): number {
  return 2000
}

export function tryConsumeNadrawGuessThrottle(streamerId: string, userId: string): boolean {
  const now = Date.now()
  const cd = nadrawGuessCooldownMs()
  const k = key(streamerId, userId)
  const last = lastNadrawGuessByUser.get(k) ?? 0
  if (now - last < cd) {
    return false
  }
  lastNadrawGuessByUser.set(k, now)
  return true
}

export function clearNadrawGuessThrottleForStreamer(streamerId: string): void {
  const prefix = `${streamerId}:`
  for (const k of [...lastNadrawGuessByUser.keys()]) {
    if (k.startsWith(prefix)) {
      lastNadrawGuessByUser.delete(k)
    }
  }
}
