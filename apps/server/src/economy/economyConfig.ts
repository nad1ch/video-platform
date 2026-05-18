/**
 * Single source of truth for Viewer Economy backend defaults. All values are
 * server-authoritative — never trust client-supplied amounts/durations.
 *
 * Env overrides are intentionally narrow: only the values that ops may need
 * to tune in production without a deploy. Anything else lives as a constant
 * here (one PR to change).
 */

const ONE_HOUR_MS = 60 * 60 * 1000
const ONE_DAY_MS = 24 * ONE_HOUR_MS

function readPositiveInt(env: string | undefined, fallback: number): number {
  if (typeof env !== 'string' || env.length === 0) return fallback
  const n = Number(env)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

function readNonNegativeInt(env: string | undefined, fallback: number): number {
  if (typeof env !== 'string' || env.length === 0) return fallback
  const n = Number(env)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback
}

function readBool(env: string | undefined, fallback: boolean): boolean {
  if (typeof env !== 'string' || env.length === 0) return fallback
  const v = env.trim().toLowerCase()
  if (v === '1' || v === 'true' || v === 'yes') return true
  if (v === '0' || v === 'false' || v === 'no') return false
  return fallback
}

/**
 * Default PendingReward expiry per `kind`. A grant without an explicit
 * `expiresAt` uses the kind default. 7 days for chat (high volume, low
 * value per row); 30 days for most others; 90 days for prediction payouts
 * and subscription chests so a user away from the platform for a month
 * still keeps their reward.
 */
export const PENDING_EXPIRY_MS_BY_KIND: Readonly<Record<string, number>> = {
  daily: 30 * ONE_DAY_MS,
  chat_activity: 7 * ONE_DAY_MS,
  watch_time: 7 * ONE_DAY_MS,
  game_participation: 30 * ONE_DAY_MS,
  streak: 30 * ONE_DAY_MS,
  event: 30 * ONE_DAY_MS,
  prediction_payout: 90 * ONE_DAY_MS,
  subscription_chest: 90 * ONE_DAY_MS,
  streamer_loyalty: 30 * ONE_DAY_MS,
  legacy: 365 * ONE_DAY_MS,
}

export const DEFAULT_PENDING_EXPIRY_MS = 30 * ONE_DAY_MS

export function resolvePendingExpiryMs(kind: string): number {
  return PENDING_EXPIRY_MS_BY_KIND[kind] ?? DEFAULT_PENDING_EXPIRY_MS
}

/**
 * Daily claim grant — coin and XP amounts. Server picks the amount; client
 * never proposes a value. Kept small in MVP to keep the economy stable until
 * earn surfaces (chat, games, predictions) are flowing.
 */
export const DAILY_CLAIM = {
  coins: readPositiveInt(process.env.ECONOMY_DAILY_COINS, 25),
  xp: readNonNegativeInt(process.env.ECONOMY_DAILY_XP, 50),
}

/**
 * Chat-activity reward defaults. Caps and cooldowns are server-side; the
 * Twitch IRC ingest path calls the rewarder per message and the rewarder
 * silently drops anything past a cap (no error to the chat callback).
 */
export const CHAT_REWARD = {
  enabled: readBool(process.env.ECONOMY_CHAT_REWARD_ENABLED, true),
  coinsPerMessage: readPositiveInt(process.env.ECONOMY_CHAT_COINS_PER_MESSAGE, 1),
  xpPerMessage: readNonNegativeInt(process.env.ECONOMY_CHAT_XP_PER_MESSAGE, 2),
  /** Minimum gap between rewarded messages from the same chatter in one stream. */
  cooldownMs: readPositiveInt(process.env.ECONOMY_CHAT_COOLDOWN_MS, 30 * 1000),
  /** Daily coin cap per (user, streamer). */
  maxCoinsPerStreamerPerDay: readPositiveInt(
    process.env.ECONOMY_CHAT_MAX_COINS_PER_STREAMER_PER_DAY,
    100,
  ),
  /** Daily rewarded-message cap per (user, streamer). */
  maxMessagesPerStreamerPerDay: readPositiveInt(
    process.env.ECONOMY_CHAT_MAX_MESSAGES_PER_STREAMER_PER_DAY,
    100,
  ),
  /** Minimum trimmed length for a chat message to count toward the reward. */
  minMessageLength: readPositiveInt(process.env.ECONOMY_CHAT_MIN_LENGTH, 3),
  /** Dedupe window for "same text by same user". Below this gap, repeats do not reward. */
  duplicateTextWindowMs: readPositiveInt(
    process.env.ECONOMY_CHAT_DEDUPE_WINDOW_MS,
    5 * 60 * 1000,
  ),
}

/**
 * Game participation reward defaults (Nadle, Checkers). Idempotency key is
 * `participation:<roundId>:<userId>` — replaying the same round persistence
 * call is a no-op.
 */
export const PARTICIPATION_REWARD = {
  enabled: readBool(process.env.ECONOMY_PARTICIPATION_ENABLED, true),
  coinsWin: readPositiveInt(process.env.ECONOMY_PARTICIPATION_WIN_COINS, 20),
  coinsPlay: readPositiveInt(process.env.ECONOMY_PARTICIPATION_PLAY_COINS, 5),
  xpWin: readNonNegativeInt(process.env.ECONOMY_PARTICIPATION_WIN_XP, 50),
  xpPlay: readNonNegativeInt(process.env.ECONOMY_PARTICIPATION_PLAY_XP, 15),
}

/**
 * Predictions — pool math is server-side; these limits prevent an abusive
 * host or viewer from configuring an unbounded prediction.
 */
export const PREDICTIONS = {
  enabled: readBool(process.env.ECONOMY_PREDICTIONS_ENABLED, true),
  minStake: readPositiveInt(process.env.ECONOMY_PREDICTION_MIN_STAKE, 10),
  maxStake: readPositiveInt(process.env.ECONOMY_PREDICTION_MAX_STAKE, 10_000),
  maxActivePerStreamer: readPositiveInt(
    process.env.ECONOMY_PREDICTION_MAX_ACTIVE_PER_STREAMER,
    3,
  ),
  maxDurationMs: readPositiveInt(
    process.env.ECONOMY_PREDICTION_MAX_DURATION_MS,
    24 * ONE_HOUR_MS,
  ),
}

/**
 * Cases — DB-backed catalog after Phase 7; this constant carries pity defaults
 * shared between catalog seed and runtime guard rails.
 */
export const CASES = {
  defaultPityFloor: readNonNegativeInt(process.env.ECONOMY_CASE_PITY_FLOOR, 10),
}

/**
 * Subscription boost defaults — multiplied into coin/XP earn deltas via
 * `walletService.applyDelta` / `xpService.applyXpDelta` when the user has
 * an active subscription. Pro is strictly more generous than Basic. No
 * direct coin packs anywhere.
 */
export const SUBSCRIPTION_BOOSTS = {
  basic: {
    coinsMultiplier: 1.1,
    xpMultiplier: 1.15,
    monthlyChestCoins: 100,
    monthlyChestXp: 200,
  },
  pro: {
    coinsMultiplier: 1.25,
    xpMultiplier: 1.5,
    monthlyChestCoins: 500,
    monthlyChestXp: 1_000,
  },
} as const

export type SubscriptionPlanSlug = 'basic' | 'pro'
