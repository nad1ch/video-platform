import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { isDatabaseConfigured, prisma } from '../../prisma'
import { CHAT_REWARD, resolvePendingExpiryMs } from '../economyConfig'
import { grantPending } from '../claims/claimService'
import { utcDayKey } from '../claims/dailyClaim'

/**
 * Chat-activity reward grantor. Called from the Twitch IRC ingest path
 * (`apps/server/src/nadle/tmiChat.ts`) per chat message. Must:
 *
 *   - Never throw into `c.on('message')` — fully self-contained try/catch.
 *   - Never block the hot path: caller fires-and-forgets via `void`.
 *   - Skip Twitch viewers who have not linked a Prisma user account.
 *   - Enforce server-side caps: per-user-per-stream-per-day messages and
 *     coins, plus a per-user-per-stream cooldown and a duplicate-text window.
 *
 * Caps storage: lightweight in-process Maps keyed by `(streamerId, userId,
 * utcDay)` for counters and `(streamerId, twitchUserId)` for cooldown +
 * recent-text dedupe. Per-process limits are acceptable for this surface —
 * the worst case under horizontal scaling is that effective caps are
 * `cap × instanceCount`, which is fine for chat reward purposes (it is not
 * a hard security boundary). The DB-side guarantor is the unique
 * `idempotencyKey` on `PendingReward`.
 */

type DailyCounter = { count: number; coins: number; dayKey: string }
const dailyCountersByKey = new Map<string, DailyCounter>()

type Cooldown = { lastAtMs: number; lastTextHash: string; lastTextAtMs: number }
const cooldownsByKey = new Map<string, Cooldown>()

const REAP_INTERVAL_MS = 5 * 60 * 1000
const reaper = setInterval(() => {
  const now = Date.now()
  const cooldownTtl = Math.max(CHAT_REWARD.cooldownMs, CHAT_REWARD.duplicateTextWindowMs) * 4
  for (const [k, v] of cooldownsByKey) {
    if (now - v.lastAtMs > cooldownTtl && now - v.lastTextAtMs > cooldownTtl) {
      cooldownsByKey.delete(k)
    }
  }
  for (const [k, v] of dailyCountersByKey) {
    // Day keys roll over once per UTC day; entries older than 2 days are dead.
    if (v.dayKey < utcDayKey(new Date(now - 2 * 24 * 60 * 60 * 1000))) {
      dailyCountersByKey.delete(k)
    }
  }
}, REAP_INTERVAL_MS)
if (typeof reaper.unref === 'function') reaper.unref()

function dailyKey(streamerId: string, userId: string, dayKeyStr: string): string {
  return `${streamerId}|${userId}|${dayKeyStr}`
}

function cooldownKey(streamerId: string, twitchUserId: string): string {
  return `${streamerId}|${twitchUserId}`
}

function hashText(text: string): string {
  return createHash('sha1').update(text).digest('hex').slice(0, 16)
}

export type ChatRewardInput = {
  streamerId: string
  /** Twitch user id from `tags['user-id']`. We resolve to a Prisma user id internally. */
  twitchUserId: string
  text: string
  now?: Date
}

export type ChatRewardOutcome =
  | { granted: true; pendingRewardId: string; coinAmount: number; xpAmount: number }
  | {
      granted: false
      reason:
        | 'disabled'
        | 'db_not_configured'
        | 'too_short'
        | 'cooldown'
        | 'duplicate_text'
        | 'message_cap'
        | 'coin_cap'
        | 'no_prisma_user'
        | 'idempotent_replay'
        | 'error'
    }

/**
 * Award chat-activity coins/XP to the Twitch chatter if they are linked to a
 * Prisma user and have not breached any per-stream/per-day cap. Returns a
 * structured outcome (caller ignores it; it exists for tests and logging).
 *
 * MUST NOT throw. All exceptions are caught and converted to
 * `{ granted: false, reason: 'error' }`.
 */
export async function awardChatActivity(
  input: ChatRewardInput,
): Promise<ChatRewardOutcome> {
  try {
    if (!CHAT_REWARD.enabled) {
      return { granted: false, reason: 'disabled' }
    }
    if (!isDatabaseConfigured()) {
      return { granted: false, reason: 'db_not_configured' }
    }
    const trimmed = input.text.trim()
    if (trimmed.length < CHAT_REWARD.minMessageLength) {
      return { granted: false, reason: 'too_short' }
    }
    const now = input.now ?? new Date()
    const nowMs = now.getTime()
    const cdKey = cooldownKey(input.streamerId, input.twitchUserId)
    const cd = cooldownsByKey.get(cdKey)
    if (cd && nowMs - cd.lastAtMs < CHAT_REWARD.cooldownMs) {
      return { granted: false, reason: 'cooldown' }
    }
    const textHash = hashText(trimmed)
    if (
      cd &&
      cd.lastTextHash === textHash &&
      nowMs - cd.lastTextAtMs < CHAT_REWARD.duplicateTextWindowMs
    ) {
      return { granted: false, reason: 'duplicate_text' }
    }

    // Resolve Prisma user from the Twitch IRC user-id; silently skip unlinked
    // viewers so chat-active anonymous viewers do not accumulate orphaned rows.
    const user = await prisma.user.findFirst({
      where: { twitchId: input.twitchUserId },
      select: { id: true },
    })
    if (!user) {
      // Still advance the cooldown so we do not re-resolve every message.
      cooldownsByKey.set(cdKey, {
        lastAtMs: nowMs,
        lastTextHash: textHash,
        lastTextAtMs: nowMs,
      })
      return { granted: false, reason: 'no_prisma_user' }
    }

    const dayKey = utcDayKey(now)
    const dKey = dailyKey(input.streamerId, user.id, dayKey)
    let counter = dailyCountersByKey.get(dKey)
    if (!counter || counter.dayKey !== dayKey) {
      counter = { count: 0, coins: 0, dayKey }
      dailyCountersByKey.set(dKey, counter)
    }
    if (counter.count >= CHAT_REWARD.maxMessagesPerStreamerPerDay) {
      return { granted: false, reason: 'message_cap' }
    }
    const coinAmount = CHAT_REWARD.coinsPerMessage
    if (counter.coins + coinAmount > CHAT_REWARD.maxCoinsPerStreamerPerDay) {
      return { granted: false, reason: 'coin_cap' }
    }

    const xpAmount = CHAT_REWARD.xpPerMessage
    const idempotencyKey = `chat:${input.streamerId}:${user.id}:${dayKey}:${counter.count + 1}`

    const result = await prisma.$transaction(
      async (tx) =>
        grantPending(
          tx,
          {
            userId: user.id,
            kind: 'chat_activity',
            coinAmount,
            xpAmount,
            streamerId: input.streamerId,
            sourceRef: textHash,
            idempotencyKey,
            metadata: { twitchUserId: input.twitchUserId, textHash },
            expiresAt: new Date(now.getTime() + resolvePendingExpiryMs('chat_activity')),
          },
          now,
        ),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )

    cooldownsByKey.set(cdKey, {
      lastAtMs: nowMs,
      lastTextHash: textHash,
      lastTextAtMs: nowMs,
    })
    if (result.idempotentReplay) {
      return { granted: false, reason: 'idempotent_replay' }
    }
    counter.count += 1
    counter.coins += coinAmount
    return { granted: true, pendingRewardId: result.pendingRewardId, coinAmount, xpAmount }
  } catch (err) {
    console.warn('[economy][chat] awardChatActivity failed', (err as Error).message)
    return { granted: false, reason: 'error' }
  }
}

/** Test-only helper: reset in-process counters between cases. */
export function __resetChatRewardStateForTests(): void {
  dailyCountersByKey.clear()
  cooldownsByKey.clear()
}
