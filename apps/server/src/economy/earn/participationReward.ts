import type { Prisma } from '@prisma/client'
import { PARTICIPATION_REWARD, resolvePendingExpiryMs } from '../economyConfig'
import { grantPending } from '../claims/claimService'

export type ParticipationGrant = {
  /** Round id from `GameRound.id` — keys the idempotency token. */
  roundId: string
  /** Game key for metadata/audit (e.g. 'nadle', 'checkers'). */
  game: string
  /** Internal Prisma user id (NOT a Twitch user id). */
  userId: string
  /** Optional streamer scope so future analytics can show per-streamer earnings. */
  streamerId?: string | null
  /** Whether the user won this round; drives win-vs-play reward amount. */
  isWinner: boolean
}

/**
 * Grant a `PendingReward(kind='game_participation')` for one participant of
 * one game round. Idempotent on `participation:<roundId>:<userId>` — replaying
 * the same round persistence call is a no-op.
 *
 * Caller contract:
 *   - Must run inside an existing Prisma transaction so the reward grant is
 *     atomic with the round persistence (no half-committed state visible).
 *   - `userId` MUST be the Prisma user id. Callers that have only a Twitch
 *     id should resolve it first (see `nadle/persistRound.ts:resolveDbUserId`).
 */
export async function grantParticipationReward(
  tx: Prisma.TransactionClient,
  input: ParticipationGrant,
  now: Date = new Date(),
): Promise<{ pendingRewardId: string; idempotentReplay: boolean } | null> {
  if (!PARTICIPATION_REWARD.enabled) return null
  const coinAmount = input.isWinner
    ? PARTICIPATION_REWARD.coinsWin
    : PARTICIPATION_REWARD.coinsPlay
  const xpAmount = input.isWinner
    ? PARTICIPATION_REWARD.xpWin
    : PARTICIPATION_REWARD.xpPlay
  if (coinAmount <= 0 && xpAmount <= 0) return null

  const result = await grantPending(
    tx,
    {
      userId: input.userId,
      kind: 'game_participation',
      coinAmount,
      xpAmount,
      streamerId: input.streamerId ?? null,
      sourceRef: input.roundId,
      idempotencyKey: `participation:${input.roundId}:${input.userId}`,
      metadata: { game: input.game, isWinner: input.isWinner },
      expiresAt: new Date(now.getTime() + resolvePendingExpiryMs('game_participation')),
    },
    now,
  )
  return result
}
