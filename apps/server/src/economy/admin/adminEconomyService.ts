import { Prisma } from '@prisma/client'
import { prisma } from '../../prisma'
import { applyDelta } from '../ledger/walletService'
import { applyXpDelta } from '../ledger/xpService'
import { WalletInsufficientFundsError } from '../ledger/types'

const TX_SERIAL: { isolationLevel: Prisma.TransactionIsolationLevel } = {
  isolationLevel: 'Serializable',
}

export class AdminEconomyError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AdminEconomyError'
  }
}

export type AdminMutationInput = {
  /** Target user. */
  userId: string
  coinAmount?: number
  xpAmount?: number
  /** Free-form admin-supplied reason; recorded on `AdminAuditLog.metadata`. */
  reason?: string | null
  /**
   * Optional idempotency token from the admin tool. Recommended to be a
   * UUID v4 so repeated submits of the same admin form do not double-grant.
   */
  idempotencyKey?: string | null
}

export type AdminMutationResult = {
  userId: string
  coinDelta: number
  xpDelta: number
  coinBalanceAfter: number
  xpBalanceAfter: number
  coinTransactionId: string | null
  xpTransactionId: string | null
  idempotentReplay: boolean
}

async function ensureUserExists(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })
  if (!user) {
    throw new AdminEconomyError(404, 'USER_NOT_FOUND', `User ${userId} not found`)
  }
}

async function ensureCoinBalanceRow(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.coinBalance.upsert({
    where: { userId },
    create: { userId, amount: 0 },
    update: {},
  })
}

/**
 * Admin grant. Positive coin and/or XP amounts (zero is allowed for a
 * "metadata-only" audit row but a non-zero amount on at least one side
 * is required). Records `AdminAuditLog` regardless of idempotent replay
 * so the audit shows every admin attempt.
 */
export async function adminGrant(
  actorUserId: string,
  input: AdminMutationInput,
): Promise<AdminMutationResult> {
  const coinDelta = Math.max(0, Math.floor(input.coinAmount ?? 0))
  const xpDelta = Math.max(0, Math.floor(input.xpAmount ?? 0))
  if (coinDelta === 0 && xpDelta === 0) {
    throw new AdminEconomyError(
      400,
      'EMPTY_GRANT',
      'At least one of coinAmount/xpAmount must be > 0',
    )
  }
  await ensureUserExists(input.userId)
  const baseKey = input.idempotencyKey ?? null

  const result = await prisma.$transaction(async (tx) => {
    await ensureCoinBalanceRow(tx, input.userId)
    let coinTxnId: string | null = null
    let coinBalanceAfter = 0
    let xpTxnId: string | null = null
    let xpBalanceAfter = 0
    let idempotentReplay = false

    if (coinDelta > 0) {
      const r = await applyDelta(tx, input.userId, {
        delta: coinDelta,
        source: 'admin_grant',
        sourceRef: actorUserId,
        idempotencyKey: baseKey ? `admin_grant:coin:${baseKey}` : null,
        metadata: { actorUserId, reason: input.reason ?? null },
      })
      coinTxnId = r.transactionId
      coinBalanceAfter = r.balanceAfter
      idempotentReplay = idempotentReplay || r.idempotentReplay
    } else {
      const bal = await tx.coinBalance.findUnique({
        where: { userId: input.userId },
        select: { amount: true },
      })
      coinBalanceAfter = bal?.amount ?? 0
    }

    if (xpDelta > 0) {
      const r = await applyXpDelta(tx, input.userId, {
        delta: xpDelta,
        source: 'admin_grant',
        sourceRef: actorUserId,
        idempotencyKey: baseKey ? `admin_grant:xp:${baseKey}` : null,
        metadata: { actorUserId, reason: input.reason ?? null },
      })
      xpTxnId = r.transactionId
      xpBalanceAfter = r.balanceAfter
      idempotentReplay = idempotentReplay || r.idempotentReplay
    } else {
      const bal = await tx.xpBalance.findUnique({
        where: { userId: input.userId },
        select: { amount: true },
      })
      xpBalanceAfter = bal?.amount ?? 0
    }

    await tx.adminAuditLog.create({
      data: {
        actorUserId,
        targetUserId: input.userId,
        action: 'economy.grant',
        metadata: {
          coinDelta,
          xpDelta,
          coinTransactionId: coinTxnId,
          xpTransactionId: xpTxnId,
          idempotencyKey: baseKey,
          idempotentReplay,
          reason: input.reason ?? null,
        } satisfies Prisma.InputJsonValue,
      },
    })

    return {
      userId: input.userId,
      coinDelta,
      xpDelta,
      coinBalanceAfter,
      xpBalanceAfter,
      coinTransactionId: coinTxnId,
      xpTransactionId: xpTxnId,
      idempotentReplay,
    }
  }, TX_SERIAL)

  return result
}

/**
 * Admin revoke. Cannot drive either balance below zero — surfaces
 * `INSUFFICIENT_BALANCE` (409). Same audit-log shape as grant.
 */
export async function adminRevoke(
  actorUserId: string,
  input: AdminMutationInput,
): Promise<AdminMutationResult> {
  const coinDelta = Math.max(0, Math.floor(input.coinAmount ?? 0))
  const xpDelta = Math.max(0, Math.floor(input.xpAmount ?? 0))
  if (coinDelta === 0 && xpDelta === 0) {
    throw new AdminEconomyError(
      400,
      'EMPTY_REVOKE',
      'At least one of coinAmount/xpAmount must be > 0',
    )
  }
  await ensureUserExists(input.userId)
  const baseKey = input.idempotencyKey ?? null

  try {
    return await prisma.$transaction(async (tx) => {
      await ensureCoinBalanceRow(tx, input.userId)
      let coinTxnId: string | null = null
      let coinBalanceAfter = 0
      let xpTxnId: string | null = null
      let xpBalanceAfter = 0
      let idempotentReplay = false

      if (coinDelta > 0) {
        const r = await applyDelta(tx, input.userId, {
          delta: -coinDelta,
          source: 'admin_revoke',
          sourceRef: actorUserId,
          idempotencyKey: baseKey ? `admin_revoke:coin:${baseKey}` : null,
          metadata: { actorUserId, reason: input.reason ?? null },
        })
        coinTxnId = r.transactionId
        coinBalanceAfter = r.balanceAfter
        idempotentReplay = idempotentReplay || r.idempotentReplay
      } else {
        const bal = await tx.coinBalance.findUnique({
          where: { userId: input.userId },
          select: { amount: true },
        })
        coinBalanceAfter = bal?.amount ?? 0
      }

      if (xpDelta > 0) {
        const r = await applyXpDelta(tx, input.userId, {
          delta: -xpDelta,
          source: 'admin_revoke',
          sourceRef: actorUserId,
          idempotencyKey: baseKey ? `admin_revoke:xp:${baseKey}` : null,
          metadata: { actorUserId, reason: input.reason ?? null },
        })
        xpTxnId = r.transactionId
        xpBalanceAfter = r.balanceAfter
        idempotentReplay = idempotentReplay || r.idempotentReplay
      } else {
        const bal = await tx.xpBalance.findUnique({
          where: { userId: input.userId },
          select: { amount: true },
        })
        xpBalanceAfter = bal?.amount ?? 0
      }

      await tx.adminAuditLog.create({
        data: {
          actorUserId,
          targetUserId: input.userId,
          action: 'economy.revoke',
          metadata: {
            coinDelta,
            xpDelta,
            coinTransactionId: coinTxnId,
            xpTransactionId: xpTxnId,
            idempotencyKey: baseKey,
            idempotentReplay,
            reason: input.reason ?? null,
          } satisfies Prisma.InputJsonValue,
        },
      })

      return {
        userId: input.userId,
        coinDelta: -coinDelta,
        xpDelta: -xpDelta,
        coinBalanceAfter,
        xpBalanceAfter,
        coinTransactionId: coinTxnId,
        xpTransactionId: xpTxnId,
        idempotentReplay,
      }
    }, TX_SERIAL)
  } catch (err) {
    if (err instanceof WalletInsufficientFundsError) {
      throw new AdminEconomyError(
        409,
        'INSUFFICIENT_BALANCE',
        `Cannot revoke ${err.requested} from user ${err.userId}: only ${err.available} available`,
      )
    }
    throw err
  }
}

export type HistoryRow = {
  kind: 'coin' | 'xp'
  id: string
  delta: number
  balanceBefore: number
  balanceAfter: number
  source: string
  sourceRef: string | null
  createdAt: string
}

/**
 * Per-user economy history. Returns coin and XP transactions interleaved by
 * `createdAt DESC`. Cursor-based pagination on a synthetic `(createdAt, id)`
 * key — the next page request passes the last row's `cursor` field back.
 */
export async function getUserEconomyHistory(
  userId: string,
  opts: { limit?: number; cursor?: string | null } = {},
): Promise<{ rows: HistoryRow[]; nextCursor: string | null }> {
  const limit = Math.max(1, Math.min(200, opts.limit ?? 50))
  // Cursor format: `<createdAtMs>:<id>`. Older-than predicate keeps order
  // deterministic when many rows share the same millisecond.
  let createdAtLt: Date | undefined
  let idLt: string | undefined
  if (typeof opts.cursor === 'string' && opts.cursor.includes(':')) {
    const [tsRaw, idRaw] = opts.cursor.split(':', 2)
    const ts = Number(tsRaw)
    if (Number.isFinite(ts) && typeof idRaw === 'string' && idRaw.length > 0) {
      createdAtLt = new Date(ts)
      idLt = idRaw
    }
  }
  const where: Prisma.CoinTransactionWhereInput = createdAtLt
    ? {
        userId,
        OR: [
          { createdAt: { lt: createdAtLt } },
          { createdAt: createdAtLt, id: { lt: idLt } },
        ],
      }
    : { userId }
  const xpWhere: Prisma.XpTransactionWhereInput = createdAtLt
    ? {
        userId,
        OR: [
          { createdAt: { lt: createdAtLt } },
          { createdAt: createdAtLt, id: { lt: idLt } },
        ],
      }
    : { userId }
  const [coinRows, xpRows] = await Promise.all([
    prisma.coinTransaction.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        delta: true,
        balanceBefore: true,
        balanceAfter: true,
        source: true,
        sourceRef: true,
        createdAt: true,
      },
    }),
    prisma.xpTransaction.findMany({
      where: xpWhere,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        delta: true,
        balanceBefore: true,
        balanceAfter: true,
        source: true,
        sourceRef: true,
        createdAt: true,
      },
    }),
  ])
  const merged: HistoryRow[] = [
    ...coinRows.map<HistoryRow>((r) => ({
      kind: 'coin',
      id: r.id,
      delta: r.delta,
      balanceBefore: r.balanceBefore,
      balanceAfter: r.balanceAfter,
      source: r.source,
      sourceRef: r.sourceRef,
      createdAt: r.createdAt.toISOString(),
    })),
    ...xpRows.map<HistoryRow>((r) => ({
      kind: 'xp',
      id: r.id,
      delta: r.delta,
      balanceBefore: r.balanceBefore,
      balanceAfter: r.balanceAfter,
      source: r.source,
      sourceRef: r.sourceRef,
      createdAt: r.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => {
      const at = Date.parse(a.createdAt)
      const bt = Date.parse(b.createdAt)
      if (at !== bt) return bt - at
      return b.id.localeCompare(a.id)
    })
    .slice(0, limit + 1)
  const hasMore = merged.length > limit
  const rows = hasMore ? merged.slice(0, limit) : merged
  const last = rows.length > 0 ? rows[rows.length - 1]! : null
  const nextCursor =
    hasMore && last ? `${Date.parse(last.createdAt)}:${last.id}` : null
  return { rows, nextCursor }
}
