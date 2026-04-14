const lastGuessShapeAttemptByUser = new Map<string, number>()

/** Per-user cooldown between guess-shaped chat lines (1–2s typical). Env clamp 1000–2500. */
export function readTwitchChatGuessCooldownMs(): number {
  const raw = process.env.TWITCH_CHAT_GUESS_COOLDOWN_MS
  if (typeof raw !== 'string' || raw.length === 0) {
    return 1500
  }
  const n = Number(raw)
  return Number.isFinite(n) && n >= 1000 && n <= 2500 ? n : 1500
}

/** Returns false if this user must wait before another guess-shaped message is processed. */
export function tryConsumeTwitchGuessThrottle(userId: string): boolean {
  const now = Date.now()
  const cooldown = readTwitchChatGuessCooldownMs()
  const last = lastGuessShapeAttemptByUser.get(userId) ?? 0
  if (now - last < cooldown) {
    return false
  }
  lastGuessShapeAttemptByUser.set(userId, now)
  return true
}

export function clearTwitchGuessThrottle(): void {
  lastGuessShapeAttemptByUser.clear()
}
