import { Prisma } from '@prisma/client'
import { prisma } from '../../prisma'
import { applyDelta } from '../ledger/walletService'
import { WalletInsufficientFundsError } from '../ledger/types'
import { grantPending } from '../claims/claimService'
import { PREDICTIONS, resolvePendingExpiryMs } from '../economyConfig'
import { isStreamerOwner } from '../streamerOwnership'
import { getStreamerSettings } from '../streamer/streamerSettingsService'

const TX_SERIAL: { isolationLevel: Prisma.TransactionIsolationLevel } = {
  isolationLevel: 'Serializable',
}

export class PredictionError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'PredictionError'
  }
}

export type CreatePredictionInput = {
  streamerId: string
  title: string
  options: string[]
  /** Minutes from now to auto-lock. Server clamps to PREDICTIONS.maxDurationMs. */
  durationMs: number
  minStake?: number
  maxStake?: number
}

export type JoinPredictionInput = {
  predictionId: string
  optionId: string
  stake: number
}

async function ensurePredictionsEnabled(): Promise<void> {
  if (!PREDICTIONS.enabled) {
    throw new PredictionError(503, 'PREDICTIONS_DISABLED', 'Predictions feature is disabled')
  }
}

async function ensureOwnerOrThrow(userId: string, streamerId: string): Promise<void> {
  const ok = await isStreamerOwner(userId, streamerId)
  if (!ok) {
    throw new PredictionError(403, 'NOT_STREAMER_OWNER', 'Caller is not the streamer owner')
  }
}

/**
 * Create a new prediction. Host-only (Streamer owner). Enforces:
 *   - 2..6 options
 *   - `durationMs` clamped to [60s, PREDICTIONS.maxDurationMs]
 *   - `minStake`/`maxStake` within config bounds
 *   - max active predictions per streamer (`open` + `locked`).
 */
export async function createPrediction(
  actorUserId: string,
  input: CreatePredictionInput,
): Promise<{ predictionId: string }> {
  await ensurePredictionsEnabled()
  await ensureOwnerOrThrow(actorUserId, input.streamerId)

  const title = (input.title ?? '').trim()
  if (title.length === 0 || title.length > 160) {
    throw new PredictionError(400, 'BAD_TITLE', 'title must be 1..160 chars')
  }
  const options = (input.options ?? [])
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => s.length > 0 && s.length <= 80)
  if (options.length < 2 || options.length > 6) {
    throw new PredictionError(400, 'BAD_OPTIONS', 'options must contain 2..6 non-empty labels')
  }
  const minStake = Math.max(
    PREDICTIONS.minStake,
    Math.floor(input.minStake ?? PREDICTIONS.minStake),
  )
  const maxStake = Math.min(
    PREDICTIONS.maxStake,
    Math.floor(input.maxStake ?? PREDICTIONS.maxStake),
  )
  if (maxStake < minStake) {
    throw new PredictionError(400, 'BAD_STAKE_RANGE', 'maxStake must be >= minStake')
  }
  const duration = Math.min(
    PREDICTIONS.maxDurationMs,
    Math.max(60_000, Math.floor(input.durationMs)),
  )

  const streamerSettings = await getStreamerSettings(input.streamerId)
  if (!streamerSettings.predictionsEnabled) {
    throw new PredictionError(
      403,
      'PREDICTIONS_DISABLED_FOR_STREAMER',
      'This streamer has predictions disabled',
    )
  }
  const maxActivePerStreamer = Math.min(
    PREDICTIONS.maxActivePerStreamer,
    streamerSettings.maxActivePredictions,
  )
  const effectiveMaxStake = Math.min(maxStake, streamerSettings.maxPredictionStake)

  return prisma.$transaction(async (tx) => {
    const active = await tx.prediction.count({
      where: {
        streamerId: input.streamerId,
        status: { in: ['open', 'locked'] },
      },
    })
    if (active >= maxActivePerStreamer) {
      throw new PredictionError(
        409,
        'TOO_MANY_ACTIVE',
        `Streamer already has ${active} active predictions (max ${maxActivePerStreamer})`,
      )
    }
    const prediction = await tx.prediction.create({
      data: {
        streamerId: input.streamerId,
        createdByUserId: actorUserId,
        title,
        status: 'open',
        lockAt: new Date(Date.now() + duration),
        minStake,
        maxStake: effectiveMaxStake,
      },
      select: { id: true },
    })
    await tx.predictionOption.createMany({
      data: options.map((label, position) => ({
        predictionId: prediction.id,
        label,
        position,
      })),
    })
    return { predictionId: prediction.id }
  }, TX_SERIAL)
}

/**
 * Join a prediction. Refuses outside the open window. Deducts the stake from
 * `CoinBalance` via the ledger and writes one `PredictionEntry` keyed
 * uniquely on `(predictionId, userId)` — the unique constraint is the real
 * guarantor against two-tab joins.
 */
export async function joinPrediction(
  userId: string,
  input: JoinPredictionInput,
): Promise<{ entryId: string; stake: number; coinBalanceAfter: number }> {
  await ensurePredictionsEnabled()
  const stake = Math.floor(input.stake)
  if (!Number.isFinite(stake) || stake <= 0) {
    throw new PredictionError(400, 'BAD_STAKE', 'stake must be a positive integer')
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const prediction = await tx.prediction.findUnique({
        where: { id: input.predictionId },
        select: {
          id: true,
          status: true,
          lockAt: true,
          minStake: true,
          maxStake: true,
          totalPool: true,
        },
      })
      if (!prediction) {
        throw new PredictionError(404, 'NOT_FOUND', 'Prediction not found')
      }
      if (prediction.status !== 'open' || prediction.lockAt.getTime() <= Date.now()) {
        throw new PredictionError(409, 'CLOSED', 'Prediction is not accepting entries')
      }
      if (stake < prediction.minStake || stake > prediction.maxStake) {
        throw new PredictionError(
          400,
          'STAKE_OUT_OF_RANGE',
          `stake must be in [${prediction.minStake}, ${prediction.maxStake}]`,
        )
      }
      const option = await tx.predictionOption.findUnique({
        where: { id: input.optionId },
        select: { id: true, predictionId: true },
      })
      if (!option || option.predictionId !== prediction.id) {
        throw new PredictionError(404, 'OPTION_NOT_FOUND', 'Option does not belong to this prediction')
      }
      await tx.coinBalance.upsert({
        where: { userId },
        create: { userId, amount: 0 },
        update: {},
      })
      // Deduct stake. WalletInsufficientFundsError surfaces as 409 below.
      const ledger = await applyDelta(tx, userId, {
        delta: -stake,
        source: 'prediction_stake',
        sourceRef: prediction.id,
      })
      const entry = await tx.predictionEntry.create({
        data: {
          predictionId: prediction.id,
          optionId: option.id,
          userId,
          stake,
          stakeCoinTransactionId: ledger.transactionId,
        },
        select: { id: true },
      })
      await tx.predictionOption.update({
        where: { id: option.id },
        data: { totalStakes: { increment: stake } },
      })
      await tx.prediction.update({
        where: { id: prediction.id },
        data: { totalPool: { increment: stake } },
      })
      return {
        entryId: entry.id,
        stake,
        coinBalanceAfter: ledger.balanceAfter,
      }
    }, TX_SERIAL)
  } catch (err) {
    if (err instanceof WalletInsufficientFundsError) {
      throw new PredictionError(
        409,
        'INSUFFICIENT_BALANCE',
        `Need ${err.requested}, have ${err.available}`,
      )
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new PredictionError(409, 'ALREADY_JOINED', 'User already has an entry in this prediction')
    }
    throw err
  }
}

/**
 * Lock a prediction (host action). Idempotent: locking an already-locked or
 * past-lockAt prediction is a no-op.
 */
export async function lockPrediction(
  actorUserId: string,
  predictionId: string,
): Promise<{ status: string }> {
  return prisma.$transaction(async (tx) => {
    const pred = await tx.prediction.findUnique({
      where: { id: predictionId },
      select: { id: true, streamerId: true, status: true },
    })
    if (!pred) throw new PredictionError(404, 'NOT_FOUND', 'Prediction not found')
    await ensureOwnerOrThrow(actorUserId, pred.streamerId)
    if (pred.status === 'open') {
      await tx.prediction.update({
        where: { id: pred.id },
        data: { status: 'locked', lockAt: new Date() },
      })
      return { status: 'locked' }
    }
    return { status: pred.status }
  }, TX_SERIAL)
}

/**
 * Resolve a prediction. Pool math runs server-side; payouts become
 * `PendingReward(kind='prediction_payout')` rows so users see them in their
 * normal claim flow. Idempotent: resolving an already-resolved/cancelled
 * prediction is a no-op.
 *
 * Edge case — winning pool is zero: no entries on the winning option means
 * "house" keeps the entire pool. Behavior: refund every entry. Operators
 * may prefer "all-to-house"; the audit explicitly forbids real-money paths,
 * and refunding is the user-friendly, internal-only choice.
 */
export async function resolvePrediction(
  actorUserId: string,
  predictionId: string,
  winningOptionId: string,
): Promise<{ status: string; totalPool: number; totalPaidOut: number; winners: number }> {
  return prisma.$transaction(async (tx) => {
    const pred = await tx.prediction.findUnique({
      where: { id: predictionId },
      select: {
        id: true,
        streamerId: true,
        status: true,
        totalPool: true,
      },
    })
    if (!pred) throw new PredictionError(404, 'NOT_FOUND', 'Prediction not found')
    await ensureOwnerOrThrow(actorUserId, pred.streamerId)
    if (pred.status === 'resolved' || pred.status === 'cancelled') {
      return { status: pred.status, totalPool: pred.totalPool, totalPaidOut: 0, winners: 0 }
    }
    const winningOption = await tx.predictionOption.findUnique({
      where: { id: winningOptionId },
      select: { id: true, predictionId: true, totalStakes: true },
    })
    if (!winningOption || winningOption.predictionId !== pred.id) {
      throw new PredictionError(400, 'BAD_WINNING_OPTION', 'winningOptionId does not belong to this prediction')
    }

    const winningPool = winningOption.totalStakes
    const totalPool = pred.totalPool

    // No winners → refund all entries via the ledger to keep "internal-only,
    // never real money" invariant clean and viewer-friendly.
    if (winningPool === 0) {
      await refundAllEntriesInTx(tx, pred.id)
      await tx.prediction.update({
        where: { id: pred.id },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          winningOptionId: null,
        },
      })
      return { status: 'cancelled', totalPool, totalPaidOut: totalPool, winners: 0 }
    }

    const winners = await tx.predictionEntry.findMany({
      where: { predictionId: pred.id, optionId: winningOption.id },
      select: { id: true, userId: true, stake: true },
    })
    let paid = 0
    for (const entry of winners) {
      const reward = Math.floor((entry.stake / winningPool) * totalPool)
      if (reward <= 0) continue
      const grant = await grantPending(
        tx,
        {
          userId: entry.userId,
          kind: 'prediction_payout',
          coinAmount: reward,
          xpAmount: 0,
          streamerId: pred.streamerId,
          sourceRef: `${pred.id}:${entry.id}`,
          idempotencyKey: `prediction_payout:${pred.id}:${entry.id}`,
          metadata: { stake: entry.stake, totalPool, winningPool },
          expiresAt: new Date(Date.now() + resolvePendingExpiryMs('prediction_payout')),
        },
      )
      await tx.predictionEntry.update({
        where: { id: entry.id },
        data: { payout: reward, payoutPendingRewardId: grant.pendingRewardId },
      })
      paid += reward
    }

    await tx.prediction.update({
      where: { id: pred.id },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
        winningOptionId: winningOption.id,
        totalPaidOut: paid,
      },
    })

    return { status: 'resolved', totalPool, totalPaidOut: paid, winners: winners.length }
  }, TX_SERIAL)
}

async function refundAllEntriesInTx(
  tx: Prisma.TransactionClient,
  predictionId: string,
): Promise<number> {
  const entries = await tx.predictionEntry.findMany({
    where: { predictionId, refunded: false },
    select: { id: true, userId: true, stake: true },
  })
  let totalRefunded = 0
  for (const entry of entries) {
    await tx.coinBalance.upsert({
      where: { userId: entry.userId },
      create: { userId: entry.userId, amount: 0 },
      update: {},
    })
    const r = await applyDelta(tx, entry.userId, {
      delta: entry.stake,
      source: 'prediction_refund',
      sourceRef: `${predictionId}:${entry.id}`,
      idempotencyKey: `prediction_refund:${predictionId}:${entry.id}`,
    })
    await tx.predictionEntry.update({
      where: { id: entry.id },
      data: { refunded: true, refundCoinTransactionId: r.transactionId },
    })
    totalRefunded += entry.stake
  }
  return totalRefunded
}

/**
 * Cancel a prediction. Refunds every entry via the coin ledger inside one
 * Serializable txn. Idempotent on already-cancelled/resolved.
 */
export async function cancelPrediction(
  actorUserId: string,
  predictionId: string,
): Promise<{ status: string; refunded: number }> {
  return prisma.$transaction(async (tx) => {
    const pred = await tx.prediction.findUnique({
      where: { id: predictionId },
      select: { id: true, streamerId: true, status: true },
    })
    if (!pred) throw new PredictionError(404, 'NOT_FOUND', 'Prediction not found')
    await ensureOwnerOrThrow(actorUserId, pred.streamerId)
    if (pred.status === 'cancelled' || pred.status === 'resolved') {
      return { status: pred.status, refunded: 0 }
    }
    const refunded = await refundAllEntriesInTx(tx, pred.id)
    await tx.prediction.update({
      where: { id: pred.id },
      data: { status: 'cancelled', cancelledAt: new Date(), winningOptionId: null },
    })
    return { status: 'cancelled', refunded }
  }, TX_SERIAL)
}

/**
 * Public-readable list of predictions for a streamer (open/locked/resolved/
 * cancelled). Auth required upstream; this query does not check ownership.
 */
export async function listPredictionsForStreamer(
  streamerId: string,
  opts?: { status?: string; limit?: number },
): Promise<
  Array<{
    id: string
    title: string
    status: string
    lockAt: string
    minStake: number
    maxStake: number
    totalPool: number
    totalPaidOut: number
    winningOptionId: string | null
    options: Array<{ id: string; label: string; totalStakes: number; position: number }>
  }>
> {
  const limit = Math.max(1, Math.min(50, opts?.limit ?? 25))
  const rows = await prisma.prediction.findMany({
    where: {
      streamerId,
      ...(opts?.status ? { status: opts.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { options: { orderBy: { position: 'asc' } } },
  })
  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    lockAt: p.lockAt.toISOString(),
    minStake: p.minStake,
    maxStake: p.maxStake,
    totalPool: p.totalPool,
    totalPaidOut: p.totalPaidOut,
    winningOptionId: p.winningOptionId,
    options: p.options.map((o) => ({
      id: o.id,
      label: o.label,
      totalStakes: o.totalStakes,
      position: o.position,
    })),
  }))
}
