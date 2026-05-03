const lastGuessShapeAttemptByUser = new Map<string, number>()

function throttleKey(streamerId: string, userId: string): string {
  return `${streamerId}:${userId}`
}

/** Per-user cooldown between guess-shaped chat lines (1–2s typical). Env clamp 1000–2500. */
export function readTwitchChatGuessCooldownMs(): number {
  const raw = process.env.TWITCH_CHAT_GUESS_COOLDOWN_MS
  if (typeof raw !== 'string' || raw.length === 0) {
    return 1500
  }
  const n = Number(raw)
  return Number.isFinite(n) && n >= 1000 && n <= 2500 ? n : 1500
}

/**
 * Reaper: drop entries whose last attempt is older than 4× the current cooldown.
 * Every chatter left an entry for the lifetime of the process; large Twitch
 * channels leak one Map entry per unique viewer. 4× cooldown is safely past
 * the "pending throttle" window so legitimate throttle checks never see a
 * stale-delete before they fire.
 */
const THROTTLE_REAP_INTERVAL_MS = 60_000
const throttleReaper = setInterval(() => {
  const now = Date.now()
  const staleAfter = readTwitchChatGuessCooldownMs() * 4
  for (const [k, t] of lastGuessShapeAttemptByUser) {
    if (now - t > staleAfter) {
      lastGuessShapeAttemptByUser.delete(k)
    }
  }
}, THROTTLE_REAP_INTERVAL_MS)
if (typeof throttleReaper.unref === 'function') {
  throttleReaper.unref()
}

/** Returns false if this user must wait before another guess-shaped message is processed. */
export function tryConsumeTwitchGuessThrottle(streamerId: string, userId: string): boolean {
  const now = Date.now()
  const cooldown = readTwitchChatGuessCooldownMs()
  const key = throttleKey(streamerId, userId)
  const last = lastGuessShapeAttemptByUser.get(key) ?? 0
  if (now - last < cooldown) {
    return false
  }
  lastGuessShapeAttemptByUser.set(key, now)
  return true
}

export function clearTwitchGuessThrottleForStreamer(streamerId: string): void {
  const prefix = `${streamerId}:`
  for (const k of [...lastGuessShapeAttemptByUser.keys()]) {
    if (k.startsWith(prefix)) {
      lastGuessShapeAttemptByUser.delete(k)
    }
  }
}

export function clearAllTwitchGuessThrottles(): void {
  lastGuessShapeAttemptByUser.clear()
}
