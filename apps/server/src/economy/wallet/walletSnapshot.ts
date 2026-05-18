import type { Prisma } from '@prisma/client'
import { prisma } from '../../prisma'
import { sumClaimablePending } from '../claims/claimService'
import { deriveLevelSnapshot } from '../ledger/levelCurve'

export type PendingRewardDto = {
  id: string
  kind: string
  coinAmount: number
  xpAmount: number
  streamerId: string | null
  sourceRef: string | null
  expiresAt: string
  createdAt: string
}

export type WalletSnapshotDto = {
  /** Current spendable coin balance. Mirrors `CoinHub.balance`. */
  coinBalance: number
  /** Current XP total. */
  xpBalance: number
  /** Materialized level derived from `xpBalance` via the level curve. */
  level: number
  /** Cumulative XP needed for the current level. */
  currentLevelXp: number
  /** Cumulative XP needed for the next level. */
  nextLevelXp: number
  /** Progress to next level in [0, 1]. */
  progressToNextLevel: number
  /** Sum of claimable coin amounts across unexpired, unclaimed pending rows. */
  pendingCoins: number
  /** Sum of claimable XP amounts across unexpired, unclaimed pending rows. */
  pendingXp: number
  /** Per-row pending rewards (capped — for UI list / breakdown). */
  pending: PendingRewardDto[]
}

const PENDING_LIST_LIMIT = 50

/**
 * Server-authoritative wallet snapshot for the authenticated user. Read-only:
 * runs no mutations, opens no transaction beyond per-find reads.
 *
 * The frontend may read this directly to render the new "wallet/me" panel,
 * but it is ADDITIVE to existing CoinHub semantics — the legacy CoinHub
 * endpoint still works and the new fields here (XP/level/pending list) do
 * not replace anything.
 */
export async function getWalletSnapshot(
  userId: string,
  now: Date = new Date(),
): Promise<WalletSnapshotDto> {
  const [bal, xp, claimable, pendingRows] = await Promise.all([
    prisma.coinBalance.findUnique({
      where: { userId },
      select: { amount: true },
    }),
    prisma.xpBalance.findUnique({
      where: { userId },
      select: { amount: true },
    }),
    sumClaimablePending(prisma as unknown as Prisma.TransactionClient, userId, now),
    prisma.pendingReward.findMany({
      where: {
        userId,
        claimedAt: null,
        lostAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      take: PENDING_LIST_LIMIT,
      select: {
        id: true,
        kind: true,
        coinAmount: true,
        xpAmount: true,
        streamerId: true,
        sourceRef: true,
        expiresAt: true,
        createdAt: true,
      },
    }),
  ])

  const xpAmount = xp?.amount ?? 0
  const level = deriveLevelSnapshot(xpAmount)
  return {
    coinBalance: bal?.amount ?? 0,
    xpBalance: xpAmount,
    level: level.level,
    currentLevelXp: level.currentLevelXp,
    nextLevelXp: level.nextLevelXp,
    progressToNextLevel: level.progressToNextLevel,
    pendingCoins: claimable.coinAmount,
    pendingXp: claimable.xpAmount,
    pending: pendingRows.map((r) => ({
      id: r.id,
      kind: r.kind,
      coinAmount: r.coinAmount,
      xpAmount: r.xpAmount,
      streamerId: r.streamerId,
      sourceRef: r.sourceRef,
      expiresAt: r.expiresAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
    })),
  }
}
