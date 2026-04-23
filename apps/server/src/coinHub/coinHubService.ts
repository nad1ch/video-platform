import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { CASE_OPEN_COOLDOWN_MS, caseSeedForCreate, CASE_OPEN_REWARD, HUB_CASE_IDS, pickDailySpinAmount } from './defaults'
import { CoinHubHttpError } from './httpError'
import type { ApiCoinCase, ApiCoinHub, CoinRewardJson, GetCoinHubResponse, OpenCaseResponse } from './types'

type Tx = Prisma.TransactionClient

const TX_SERIAL: { isolationLevel: Prisma.TransactionIsolationLevel } = {
  isolationLevel: 'Serializable',
}

function startOfNextUtcDay(now: Date): Date {
  const d = new Date(now)
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + 1)
  return d
}

function parseCoinReward(v: unknown): CoinRewardJson | null {
  if (v == null) return null
  if (typeof v !== 'object' || v === null) return null
  const o = v as { kind?: unknown; amount?: unknown }
  if (o.kind === 'coins' && typeof o.amount === 'number' && Number.isFinite(o.amount)) {
    return { kind: 'coins', amount: Math.max(0, Math.floor(o.amount)) }
  }
  return null
}

function isSpinAvailable(nextAvailableAt: Date | null, now: Date): boolean {
  if (nextAvailableAt == null) return true
  return nextAvailableAt.getTime() <= now.getTime()
}

function mapState(s: string): ApiCoinCase['state'] {
  if (s === 'available' || s === 'locked' || s === 'cooldown') return s
  return 'available'
}

async function ensureUserCoinHub(tx: Tx, userId: string, now: Date): Promise<void> {
  await tx.coinBalance.upsert({
    where: { userId },
    create: { userId, amount: 0 },
    update: {},
  })
  await tx.pending.upsert({
    where: { userId },
    create: { userId, amount: 0 },
    update: {},
  })
  await tx.spin.upsert({
    where: { userId },
    create: { userId, nextAvailableAt: null },
    update: {},
  })
  for (const row of caseSeedForCreate(now)) {
    await tx.coinCase.upsert({
      where: { userId_caseId: { userId, caseId: row.caseId } },
      create: {
        userId,
        caseId: row.caseId,
        state: row.state,
        cooldownUntil: row.cooldownUntil,
      },
      update: {},
    })
  }
}

async function reconcileExpiredCaseCooldowns(tx: Tx, userId: string, now: Date): Promise<void> {
  await tx.coinCase.updateMany({
    where: {
      userId,
      state: 'cooldown',
      cooldownUntil: { not: null, lte: now },
    },
    data: {
      state: 'available',
      cooldownUntil: null,
    },
  })
}

async function loadAndBuild(
  tx: Tx,
  userId: string,
  now: Date,
): Promise<ApiCoinHub> {
  const [bal, pen, sp, caseRows] = await Promise.all([
    tx.coinBalance.findUniqueOrThrow({ where: { userId } }),
    tx.pending.findUniqueOrThrow({ where: { userId } }),
    tx.spin.findUniqueOrThrow({ where: { userId } }),
    tx.coinCase.findMany({ where: { userId } }),
  ])
  const nextSpin = sp.nextAvailableAt
  const spinAvailable = isSpinAvailable(nextSpin, now)
  const byId = new Map(caseRows.map((r) => [r.caseId, r]))
  const cases: ApiCoinCase[] = HUB_CASE_IDS.map((id) => {
    const r = byId.get(id)
    if (!r) {
      return {
        id,
        state: 'available' as const,
        cooldownUntil: null,
        displayReward: null,
      }
    }
    return {
      id: r.caseId,
      state: mapState(r.state),
      cooldownUntil: r.cooldownUntil ? r.cooldownUntil.toISOString() : null,
      displayReward: parseCoinReward(r.lastReward),
    }
  })
  return {
    balance: bal.amount,
    pending: pen.amount,
    spin: {
      available: spinAvailable,
      nextAvailableAt: !spinAvailable && sp.nextAvailableAt ? sp.nextAvailableAt.toISOString() : null,
      lastReward: parseCoinReward(sp.lastReward),
    },
    cases,
  }
}

/**
 * Public GET snapshot: ensure rows, reconcile cooldowns, return hub JSON.
 */
export async function getCoinHubSnapshot(userId: string, now: Date = new Date()): Promise<GetCoinHubResponse> {
  return prisma.$transaction(async (tx) => {
    await ensureUserCoinHub(tx, userId, now)
    await reconcileExpiredCaseCooldowns(tx, userId, now)
    const coinHub = await loadAndBuild(tx, userId, now)
    return { coinHub }
  })
}

export async function claimPending(userId: string, now: Date = new Date()): Promise<GetCoinHubResponse> {
  return prisma.$transaction(async (tx) => {
    await ensureUserCoinHub(tx, userId, now)
    await reconcileExpiredCaseCooldowns(tx, userId, now)
    const pen = await tx.pending.findUniqueOrThrow({ where: { userId } })
    if (pen.amount > 0) {
      await tx.coinBalance.update({
        where: { userId },
        data: { amount: { increment: pen.amount } },
      })
      await tx.pending.update({ where: { userId }, data: { amount: 0 } })
    }
    const coinHub = await loadAndBuild(tx, userId, now)
    return { coinHub }
  }, TX_SERIAL)
}

type MutationOpts = { adminBypass?: boolean }

export async function spin(
  userId: string,
  now: Date = new Date(),
  opts?: MutationOpts,
): Promise<GetCoinHubResponse> {
  const bypass = opts?.adminBypass === true
  return prisma.$transaction(async (tx) => {
    await ensureUserCoinHub(tx, userId, now)
    await reconcileExpiredCaseCooldowns(tx, userId, now)
    const sp = await tx.spin.findUniqueOrThrow({ where: { userId } })
    if (!bypass && !isSpinAvailable(sp.nextAvailableAt, now)) {
      throw new CoinHubHttpError(
        409,
        'SPIN_NOT_AVAILABLE',
        'Daily spin is not available yet',
      )
    }
    const amount = pickDailySpinAmount()
    const reward: CoinRewardJson = { kind: 'coins', amount }
    await tx.coinBalance.update({
      where: { userId },
      data: { amount: { increment: reward.amount } },
    })
    const next = startOfNextUtcDay(now)
    await tx.spin.update({
      where: { userId },
      data: {
        lastReward: reward as unknown as Prisma.InputJsonValue,
        /** Admins / dev bypass: keep spin always available in snapshot without waiting a day. */
        nextAvailableAt: bypass ? null : next,
      },
    })
    const coinHub = await loadAndBuild(tx, userId, now)
    return { coinHub }
  }, TX_SERIAL)
}

export async function openCase(
  userId: string,
  caseId: string,
  now: Date = new Date(),
  opts?: MutationOpts,
): Promise<OpenCaseResponse> {
  if (!HUB_CASE_IDS.includes(caseId)) {
    throw new CoinHubHttpError(400, 'UNKNOWN_CASE', 'Unknown case id')
  }
  const bypass = opts?.adminBypass === true
  return prisma.$transaction(async (tx) => {
    await ensureUserCoinHub(tx, userId, now)
    await reconcileExpiredCaseCooldowns(tx, userId, now)
    const c = await tx.coinCase.findUnique({
      where: { userId_caseId: { userId, caseId } },
    })
    if (!c) {
      throw new CoinHubHttpError(500, 'CASE_STATE', 'Case row missing after ensure')
    }
    if (!bypass) {
      if (c.state === 'locked') {
        throw new CoinHubHttpError(409, 'CASE_LOCKED', 'Case is locked')
      }
      if (c.state === 'cooldown' && c.cooldownUntil && c.cooldownUntil.getTime() > now.getTime()) {
        throw new CoinHubHttpError(409, 'CASE_COOLING_DOWN', 'Case is on cooldown')
      }
      if (c.state !== 'available') {
        throw new CoinHubHttpError(409, 'CASE_UNAVAILABLE', 'Case is not openable right now')
      }
    }
    const n = CASE_OPEN_REWARD[caseId]
    if (typeof n !== 'number' || n <= 0) {
      if (!bypass) {
        throw new CoinHubHttpError(409, 'CASE_LOCKED', 'Case cannot be opened')
      }
    }
    const amount = typeof n === 'number' && n > 0 ? n : bypass ? 1 : 0
    if (!bypass && amount <= 0) {
      throw new CoinHubHttpError(409, 'CASE_LOCKED', 'Case cannot be opened')
    }
    const reward: CoinRewardJson = { kind: 'coins', amount: amount }
    await tx.coinBalance.update({
      where: { userId },
      data: { amount: { increment: amount } },
    })
    const until = new Date(now.getTime() + CASE_OPEN_COOLDOWN_MS)
    await tx.coinCase.update({
      where: { userId_caseId: { userId, caseId } },
      data: {
        state: bypass ? 'available' : 'cooldown',
        cooldownUntil: bypass ? null : until,
        lastReward: reward as unknown as Prisma.InputJsonValue,
      },
    })
    const coinHub = await loadAndBuild(tx, userId, now)
    return { coinHub, opened: { caseId, reward } }
  }, TX_SERIAL)
}
