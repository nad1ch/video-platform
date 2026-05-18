import type { Prisma } from '@prisma/client'
import { prisma } from '../../prisma'

export type TransactionRow = {
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
 * User-facing transaction history (coins + XP interleaved by createdAt DESC).
 * Returns `nextCursor` when more rows exist; pass it back as `cursor` to page.
 * Server-side only: no SUMs over the entire ledger.
 */
export async function getOwnTransactionHistory(
  userId: string,
  opts: { limit?: number; cursor?: string | null; kind?: 'coin' | 'xp' | 'all' } = {},
): Promise<{ rows: TransactionRow[]; nextCursor: string | null }> {
  const limit = Math.max(1, Math.min(100, opts.limit ?? 25))
  const kindFilter = opts.kind ?? 'all'
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
  const whereBase = !createdAtLt
    ? { userId }
    : {
        userId,
        OR: [
          { createdAt: { lt: createdAtLt } },
          { createdAt: createdAtLt, id: { lt: idLt } },
        ],
      }
  const fetchCoin = kindFilter === 'xp'
    ? Promise.resolve([] as Awaited<ReturnType<typeof prisma.coinTransaction.findMany>>)
    : prisma.coinTransaction.findMany({
        where: whereBase as Prisma.CoinTransactionWhereInput,
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
      })
  const fetchXp = kindFilter === 'coin'
    ? Promise.resolve([] as Awaited<ReturnType<typeof prisma.xpTransaction.findMany>>)
    : prisma.xpTransaction.findMany({
        where: whereBase as Prisma.XpTransactionWhereInput,
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
      })
  const [coinRows, xpRows] = await Promise.all([fetchCoin, fetchXp])
  const merged: TransactionRow[] = [
    ...coinRows.map<TransactionRow>((r) => ({
      kind: 'coin',
      id: r.id,
      delta: r.delta,
      balanceBefore: r.balanceBefore,
      balanceAfter: r.balanceAfter,
      source: r.source,
      sourceRef: r.sourceRef,
      createdAt: r.createdAt.toISOString(),
    })),
    ...xpRows.map<TransactionRow>((r) => ({
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

export type StreamerEconomySummary = {
  streamerId: string
  topEarners: Array<{ userId: string; displayName: string; coins: number }>
  recentPredictions: Array<{
    id: string
    title: string
    status: string
    totalPool: number
    totalPaidOut: number
    createdAt: string
  }>
  chatRewardCoinsLast30d: number
  participationCoinsLast30d: number
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Owner-only streamer economy snapshot. Aggregations are scoped to the last
 * 30 days and capped lists. All queries are indexed (PendingReward by
 * streamerId+createdAt-equivalent via index on `kind,createdAt`).
 */
export async function getStreamerEconomySummary(
  streamerId: string,
): Promise<StreamerEconomySummary> {
  const since = new Date(Date.now() - 30 * MS_PER_DAY)

  const [topEarnersAgg, recentPredictions, chatCoinsAgg, participationAgg] =
    await Promise.all([
      prisma.pendingReward.groupBy({
        by: ['userId'],
        where: { streamerId, createdAt: { gte: since } },
        _sum: { coinAmount: true },
        orderBy: { _sum: { coinAmount: 'desc' } },
        take: 10,
      }),
      prisma.prediction.findMany({
        where: { streamerId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          status: true,
          totalPool: true,
          totalPaidOut: true,
          createdAt: true,
        },
      }),
      prisma.pendingReward.aggregate({
        where: { streamerId, kind: 'chat_activity', createdAt: { gte: since } },
        _sum: { coinAmount: true },
      }),
      prisma.pendingReward.aggregate({
        where: {
          streamerId,
          kind: 'game_participation',
          createdAt: { gte: since },
        },
        _sum: { coinAmount: true },
      }),
    ])

  const earnerIds = topEarnersAgg.map((g) => g.userId)
  const users = earnerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: earnerIds } },
        select: { id: true, displayName: true },
      })
    : []
  const nameById = new Map(users.map((u) => [u.id, u.displayName]))

  return {
    streamerId,
    topEarners: topEarnersAgg.map((g) => ({
      userId: g.userId,
      displayName: nameById.get(g.userId) ?? g.userId,
      coins: g._sum.coinAmount ?? 0,
    })),
    recentPredictions: recentPredictions.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      totalPool: p.totalPool,
      totalPaidOut: p.totalPaidOut,
      createdAt: p.createdAt.toISOString(),
    })),
    chatRewardCoinsLast30d: chatCoinsAgg._sum.coinAmount ?? 0,
    participationCoinsLast30d: participationAgg._sum.coinAmount ?? 0,
  }
}

/**
 * Admin-only prediction list across all streamers, filterable by status.
 * Cursor-based for paging.
 */
export async function listAllPredictionsForAdmin(opts: {
  status?: string
  limit?: number
  cursor?: string | null
}): Promise<{
  rows: Array<{
    id: string
    streamerId: string
    title: string
    status: string
    totalPool: number
    totalPaidOut: number
    createdAt: string
  }>
  nextCursor: string | null
}> {
  const limit = Math.max(1, Math.min(100, opts.limit ?? 50))
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
  const where: Prisma.PredictionWhereInput = createdAtLt
    ? {
        ...(opts.status ? { status: opts.status } : {}),
        OR: [
          { createdAt: { lt: createdAtLt } },
          { createdAt: createdAtLt, id: { lt: idLt } },
        ],
      }
    : opts.status
      ? { status: opts.status }
      : {}
  const rows = await prisma.prediction.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    select: {
      id: true,
      streamerId: true,
      title: true,
      status: true,
      totalPool: true,
      totalPaidOut: true,
      createdAt: true,
    },
  })
  const hasMore = rows.length > limit
  const sliced = hasMore ? rows.slice(0, limit) : rows
  const last = sliced[sliced.length - 1]
  const nextCursor =
    hasMore && last ? `${last.createdAt.getTime()}:${last.id}` : null
  return {
    rows: sliced.map((p) => ({
      id: p.id,
      streamerId: p.streamerId,
      title: p.title,
      status: p.status,
      totalPool: p.totalPool,
      totalPaidOut: p.totalPaidOut,
      createdAt: p.createdAt.toISOString(),
    })),
    nextCursor,
  }
}
