import type { Prisma } from '@prisma/client'

/**
 * PendingReward kinds — open string union so future branches can introduce
 * new kinds without amending this file. The leading literals are the kinds
 * the MVP backend grants today.
 */
export type PendingRewardKind =
  | 'daily'
  | 'chat_activity'
  | 'watch_time'
  | 'game_participation'
  | 'streak'
  | 'event'
  | 'prediction_payout'
  | 'subscription_chest'
  | 'streamer_loyalty'
  | 'legacy'
  | (string & {})

export type GrantPendingInput = {
  userId: string
  kind: PendingRewardKind
  coinAmount?: number
  xpAmount?: number
  streamerId?: string | null
  sourceRef?: string | null
  idempotencyKey?: string | null
  metadata?: Prisma.InputJsonValue | null
  /** Override the kind-default expiry (`economyConfig.resolvePendingExpiryMs`). */
  expiresAt?: Date | null
}

export type GrantPendingResult = {
  pendingRewardId: string
  /** True when an existing row was returned (idempotent replay) instead of inserted. */
  idempotentReplay: boolean
}

export type ClaimSummary = {
  /** Total coins credited to the wallet in this claim event. */
  coinTotal: number
  /** Total XP credited in this claim event. */
  xpTotal: number
  /** Ids of consumed PendingReward rows. */
  consumedPendingIds: string[]
  /** Claim row id, or `null` when nothing was claimable. */
  claimId: string | null
}
