import type { Prisma } from '@prisma/client'
import { prisma } from '../../prisma'
import { applyDelta } from '../ledger/walletService'
import { applyXpDelta } from '../ledger/xpService'
import { resolvePendingExpiryMs } from '../economyConfig'
import type { ClaimSummary, GrantPendingInput, GrantPendingResult } from './types'

const TX_SERIAL: { isolationLevel: Prisma.TransactionIsolationLevel } = {
  isolationLevel: 'Serializable',
}

/**
 * Insert one typed `PendingReward` row. Must be called inside an existing
 * Prisma transaction so the grant is atomic with whatever earned the reward
 * (e.g. chat message handling, round persistence). When `idempotencyKey` is
 * supplied and a row already exists with that key, the existing row id is
 * returned and nothing new is written.
 *
 * Hard rules:
 *   - `coinAmount` and `xpAmount` are non-negative integers (server-clamped).
 *   - At least one of `coinAmount` / `xpAmount` must be > 0; an "empty reward"
 *     row would be misleading and is rejected.
 *   - `expiresAt` defaults from `resolvePendingExpiryMs(kind)`.
 */
export async function grantPending(
  tx: Prisma.TransactionClient,
  input: GrantPendingInput,
  now: Date = new Date(),
): Promise<GrantPendingResult> {
  const coinAmount = Math.max(0, Math.floor(input.coinAmount ?? 0))
  const xpAmount = Math.max(0, Math.floor(input.xpAmount ?? 0))
  if (coinAmount === 0 && xpAmount === 0) {
    throw new Error('claimService.grantPending: empty reward (coin + xp == 0)')
  }
  if (typeof input.kind !== 'string' || input.kind.length === 0) {
    throw new Error('claimService.grantPending: kind required')
  }
  const idempotencyKey =
    typeof input.idempotencyKey === 'string' && input.idempotencyKey.length > 0
      ? input.idempotencyKey
      : null

  if (idempotencyKey !== null) {
    const existing = await tx.pendingReward.findUnique({
      where: { idempotencyKey },
      select: { id: true },
    })
    if (existing) {
      return { pendingRewardId: existing.id, idempotentReplay: true }
    }
  }

  const expiresAt =
    input.expiresAt instanceof Date
      ? input.expiresAt
      : new Date(now.getTime() + resolvePendingExpiryMs(input.kind))

  const created = await tx.pendingReward.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      coinAmount,
      xpAmount,
      streamerId: input.streamerId ?? null,
      sourceRef: input.sourceRef ?? null,
      idempotencyKey,
      metadata: input.metadata ?? undefined,
      expiresAt,
    },
    select: { id: true },
  })
  return { pendingRewardId: created.id, idempotentReplay: false }
}

/**
 * Total claimable `coinAmount` and `xpAmount` for a user — unexpired,
 * unclaimed, not-lost. Used by snapshot endpoints to show the "pending"
 * badge without consuming.
 */
export async function sumClaimablePending(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date = new Date(),
): Promise<{ coinAmount: number; xpAmount: number; rowCount: number }> {
  const agg = await tx.pendingReward.aggregate({
    where: {
      userId,
      claimedAt: null,
      lostAt: null,
      expiresAt: { gt: now },
    },
    _sum: { coinAmount: true, xpAmount: true },
    _count: { _all: true },
  })
  return {
    coinAmount: agg._sum.coinAmount ?? 0,
    xpAmount: agg._sum.xpAmount ?? 0,
    rowCount: agg._count._all,
  }
}

/**
 * Sweep expired-but-unclaimed rows into `lostAt`. Side-effect-free for
 * already-stamped rows. Cheap when called sporadically (e.g. once per claim
 * attempt) — index `expiresAt_claimedAt_idx` covers the predicate.
 */
export async function markExpiredAsLost(
  tx: Prisma.TransactionClient,
  now: Date = new Date(),
): Promise<number> {
  const result = await tx.pendingReward.updateMany({
    where: { claimedAt: null, lostAt: null, expiresAt: { lt: now } },
    data: { lostAt: now },
  })
  return result.count
}

/**
 * Claim ALL unexpired/unclaimed `PendingReward` rows for the user. Each
 * row's `coinAmount` flows through `walletService.applyDelta` and each
 * row's `xpAmount` through `xpService.applyXpDelta`, all inside one
 * Serializable transaction together with stamping `claimedAt` on the
 * consumed rows and writing one summary `Claim` row.
 *
 * Concurrency: the per-row `claimedAt` UPDATE uses a `WHERE claimedAt IS NULL`
 * filter via `updateMany`, so two tabs racing the same set of rows only
 * credit each row once — the loser sees `count=0` for already-claimed rows
 * and credits nothing.
 *
 * Returns the summary (zeros when nothing was claimable).
 */
export async function claimAllPending(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date = new Date(),
): Promise<ClaimSummary> {
  await markExpiredAsLost(tx, now)

  const rows = await tx.pendingReward.findMany({
    where: {
      userId,
      claimedAt: null,
      lostAt: null,
      expiresAt: { gt: now },
    },
    select: { id: true, coinAmount: true, xpAmount: true, kind: true },
  })
  if (rows.length === 0) {
    return { coinTotal: 0, xpTotal: 0, consumedPendingIds: [], claimId: null }
  }

  let coinTotal = 0
  let xpTotal = 0
  const consumed: string[] = []
  for (const row of rows) {
    const stamp = await tx.pendingReward.updateMany({
      where: { id: row.id, claimedAt: null, lostAt: null, expiresAt: { gt: now } },
      data: { claimedAt: now },
    })
    if (stamp.count === 0) {
      // Lost the race for this row to a concurrent claimer; skip.
      continue
    }
    if (row.coinAmount > 0) {
      await applyDelta(tx, userId, {
        delta: row.coinAmount,
        source: 'claim_pending',
        sourceRef: `pending:${row.id}`,
      })
      coinTotal += row.coinAmount
    }
    if (row.xpAmount > 0) {
      await applyXpDelta(tx, userId, {
        delta: row.xpAmount,
        source: 'claim_pending',
        sourceRef: `pending:${row.id}`,
      })
      xpTotal += row.xpAmount
    }
    consumed.push(row.id)
  }

  if (consumed.length === 0) {
    return { coinTotal: 0, xpTotal: 0, consumedPendingIds: [], claimId: null }
  }

  const claim = await tx.claim.create({
    data: {
      userId,
      kind: 'all',
      coinTotal,
      xpTotal,
      consumedPendingIds: consumed,
    },
    select: { id: true },
  })

  return { coinTotal, xpTotal, consumedPendingIds: consumed, claimId: claim.id }
}

/**
 * Top-level wrapper that opens its own Serializable transaction. Use this
 * from HTTP handlers; inner callers (those already in a txn) should call
 * `claimAllPending(tx, …)` directly.
 */
export async function claimAllPendingTopLevel(
  userId: string,
  now: Date = new Date(),
): Promise<ClaimSummary> {
  return prisma.$transaction((tx) => claimAllPending(tx, userId, now), TX_SERIAL)
}

/**
 * Claim one specific `PendingReward` by id. Verifies ownership (`userId`
 * matches the row's `userId`) inside the txn so a forged id cannot leak
 * another user's reward. Returns the summary or zeros if the row was
 * already claimed/expired.
 */
export async function claimPendingById(
  userId: string,
  pendingRewardId: string,
  now: Date = new Date(),
): Promise<ClaimSummary> {
  return prisma.$transaction(async (tx) => {
    await markExpiredAsLost(tx, now)
    const row = await tx.pendingReward.findUnique({
      where: { id: pendingRewardId },
      select: {
        id: true,
        userId: true,
        coinAmount: true,
        xpAmount: true,
        kind: true,
        claimedAt: true,
        lostAt: true,
        expiresAt: true,
      },
    })
    if (!row || row.userId !== userId) {
      return { coinTotal: 0, xpTotal: 0, consumedPendingIds: [], claimId: null }
    }
    if (row.claimedAt !== null || row.lostAt !== null || row.expiresAt.getTime() <= now.getTime()) {
      return { coinTotal: 0, xpTotal: 0, consumedPendingIds: [], claimId: null }
    }
    const stamp = await tx.pendingReward.updateMany({
      where: { id: row.id, claimedAt: null, lostAt: null, expiresAt: { gt: now } },
      data: { claimedAt: now },
    })
    if (stamp.count === 0) {
      return { coinTotal: 0, xpTotal: 0, consumedPendingIds: [], claimId: null }
    }
    if (row.coinAmount > 0) {
      await applyDelta(tx, userId, {
        delta: row.coinAmount,
        source: 'claim_pending',
        sourceRef: `pending:${row.id}`,
      })
    }
    if (row.xpAmount > 0) {
      await applyXpDelta(tx, userId, {
        delta: row.xpAmount,
        source: 'claim_pending',
        sourceRef: `pending:${row.id}`,
      })
    }
    const claim = await tx.claim.create({
      data: {
        userId,
        kind: row.kind,
        coinTotal: row.coinAmount,
        xpTotal: row.xpAmount,
        consumedPendingIds: [row.id],
      },
      select: { id: true },
    })
    return {
      coinTotal: row.coinAmount,
      xpTotal: row.xpAmount,
      consumedPendingIds: [row.id],
      claimId: claim.id,
    }
  }, TX_SERIAL)
}
