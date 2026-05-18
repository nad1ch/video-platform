import { Prisma } from '@prisma/client'
import { prisma } from '../../prisma'
import { applyDelta } from '../ledger/walletService'
import { applyXpDelta } from '../ledger/xpService'

const TX_SERIAL: { isolationLevel: Prisma.TransactionIsolationLevel } = {
  isolationLevel: 'Serializable',
}

export class CaseError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'CaseError'
  }
}

export type CaseRewardKind = 'coins' | 'xp' | 'badge' | 'cosmetic' | 'fragment'

export type CatalogRewardDto = {
  id: string
  weight: number
  kind: CaseRewardKind
  value: number
  referenceId: string | null
  minPityCount: number
  /** Display odds in [0, 1] — weight / sum(weights) — for transparency UIs. */
  oddsApprox: number
}

export type CatalogCaseDto = {
  slug: string
  displayName: string
  rarityTier: string
  isActive: boolean
  guaranteedMinCoins: number
  pityFloorCount: number
  streamerId: string | null
  rewards: CatalogRewardDto[]
}

function rewardsToDtos(
  rewards: Array<{
    id: string
    weight: number
    kind: string
    value: number
    referenceId: string | null
    minPityCount: number
  }>,
): CatalogRewardDto[] {
  const total = rewards.reduce((acc, r) => acc + Math.max(0, r.weight), 0) || 1
  return rewards.map((r) => ({
    id: r.id,
    weight: r.weight,
    kind: r.kind as CaseRewardKind,
    value: r.value,
    referenceId: r.referenceId,
    minPityCount: r.minPityCount,
    oddsApprox: Math.max(0, r.weight) / total,
  }))
}

/**
 * Public catalog read. Returns all active cases (optionally scoped to a
 * `streamerId`) with their rewards and approximate odds. Used by the UI
 * to render "what's in this case".
 */
export async function listActiveCatalog(opts?: { streamerId?: string | null }): Promise<CatalogCaseDto[]> {
  const where: Prisma.CaseCatalogWhereInput = { isActive: true }
  if (opts?.streamerId) {
    where.OR = [{ streamerId: opts.streamerId }, { streamerId: null }]
  }
  const rows = await prisma.caseCatalog.findMany({
    where,
    orderBy: { slug: 'asc' },
    include: { rewards: { orderBy: { weight: 'desc' } } },
  })
  return rows.map((c) => ({
    slug: c.slug,
    displayName: c.displayName,
    rarityTier: c.rarityTier,
    isActive: c.isActive,
    guaranteedMinCoins: c.guaranteedMinCoins,
    pityFloorCount: c.pityFloorCount,
    streamerId: c.streamerId,
    rewards: rewardsToDtos(c.rewards),
  }))
}

/**
 * Grant N copies of a catalog case to a user's `UserCaseInventory`. Called
 * by other reward flows (event chests, subscription chest, predictions
 * post-MVP, admin tooling). Must run inside a Prisma transaction.
 */
export async function grantCaseToInventory(
  tx: Prisma.TransactionClient,
  userId: string,
  caseSlug: string,
  count: number,
): Promise<void> {
  const n = Math.max(1, Math.floor(count))
  await tx.userCaseInventory.upsert({
    where: { userId_caseSlug: { userId, caseSlug } },
    create: { userId, caseSlug, count: n },
    update: { count: { increment: n } },
  })
}

function pickWeightedRewardId(
  eligible: Array<{ id: string; weight: number }>,
  rng: () => number,
): string {
  const total = eligible.reduce((acc, r) => acc + Math.max(0, r.weight), 0)
  if (total <= 0) {
    // Shouldn't happen in a healthy catalog; fall back to the first eligible.
    return eligible[0]!.id
  }
  const r = rng() * total
  let acc = 0
  for (const cand of eligible) {
    acc += Math.max(0, cand.weight)
    if (r < acc) return cand.id
  }
  return eligible[eligible.length - 1]!.id
}

export type CatalogOpenResult = {
  caseSlug: string
  reward: {
    rewardId: string
    kind: CaseRewardKind
    value: number
    referenceId: string | null
  }
  pityCountBefore: number
  pityCountAfter: number
  /** True when this open consumed the user's pity threshold (forced top reward). */
  pityTriggered: boolean
  coinTransactionId: string | null
  xpTransactionId: string | null
  inventoryRemaining: number
  openingId: string
}

/**
 * Open one case from the catalog. Requires the user has ≥1 inventory entry
 * for `caseSlug`. The full flow runs inside one Serializable transaction:
 *
 *   1. Decrement inventory (refuse if 0).
 *   2. Read pity counter; if pity ≥ catalog.pityFloorCount, force-pick the
 *      highest-`minPityCount` eligible reward.
 *   3. Otherwise weighted-pick from rewards whose `minPityCount` ≤ current
 *      pity count.
 *   4. Apply the chosen reward through the appropriate ledger (coins → coin
 *      ledger; xp → xp ledger; badge/cosmetic/fragment → record on opening
 *      row only — actual inventory grant lands in Phase 9 when those
 *      inventories exist).
 *   5. Update pity: if reward value < `guaranteedMinCoins` OR the rolled
 *      reward equals the lowest-weight "junk" tier, increment; else reset
 *      to 0. (We treat the minimum eligible weight as the pity-incrementing
 *      tier so future curators can tag rewards explicitly via metadata.)
 *   6. Insert `CaseOpening` audit row.
 *
 * Idempotency: open-case is naturally not retried by the client (the user
 * presses Open and sees the result); we do not require an idempotency key.
 * The unique decrement-then-pick path is safe under two-tab races because
 * the inventory `updateMany` with `WHERE count > 0` lets only one writer
 * proceed.
 */
export async function openCatalogCase(
  userId: string,
  caseSlug: string,
  opts?: { rng?: () => number },
): Promise<CatalogOpenResult> {
  const rng = opts?.rng ?? Math.random

  const catalog = await prisma.caseCatalog.findUnique({
    where: { slug: caseSlug },
    include: { rewards: true },
  })
  if (!catalog || !catalog.isActive) {
    throw new CaseError(404, 'CASE_NOT_FOUND', `Case ${caseSlug} not found or inactive`)
  }
  if (catalog.rewards.length === 0) {
    throw new CaseError(409, 'CASE_EMPTY', `Case ${caseSlug} has no rewards`)
  }

  return prisma.$transaction(async (tx) => {
    // Atomic inventory decrement.
    const dec = await tx.userCaseInventory.updateMany({
      where: { userId, caseSlug, count: { gt: 0 } },
      data: { count: { decrement: 1 } },
    })
    if (dec.count === 0) {
      throw new CaseError(409, 'NO_INVENTORY', 'No inventory for this case')
    }

    const pityRow = await tx.userPity.upsert({
      where: { userId_caseSlug: { userId, caseSlug } },
      create: { userId, caseSlug, count: 0 },
      update: {},
    })
    const pityBefore = pityRow.count

    const pityTriggered = pityBefore >= catalog.pityFloorCount
    let chosenId: string
    if (pityTriggered) {
      const pityCandidates = catalog.rewards
        .filter((r) => r.minPityCount > 0)
        .sort((a, b) => b.minPityCount - a.minPityCount)
      chosenId = pityCandidates[0]?.id ?? pickWeightedRewardId(catalog.rewards, rng)
    } else {
      const eligible = catalog.rewards.filter((r) => r.minPityCount <= pityBefore)
      chosenId = pickWeightedRewardId(eligible.length > 0 ? eligible : catalog.rewards, rng)
    }
    const reward = catalog.rewards.find((r) => r.id === chosenId)!

    let coinTxnId: string | null = null
    let xpTxnId: string | null = null
    const rewardKind = reward.kind as CaseRewardKind
    let appliedValue = reward.value

    if (rewardKind === 'coins') {
      // Apply guaranteed minimum at apply-time so "no empty case" holds even
      // for misconfigured rows.
      const credit = Math.max(reward.value, catalog.guaranteedMinCoins)
      appliedValue = credit
      await tx.coinBalance.upsert({
        where: { userId },
        create: { userId, amount: 0 },
        update: {},
      })
      const r = await applyDelta(tx, userId, {
        delta: credit,
        source: 'case_open',
        sourceRef: caseSlug,
      })
      coinTxnId = r.transactionId
    } else if (rewardKind === 'xp') {
      const credit = reward.value
      const r = await applyXpDelta(tx, userId, {
        delta: credit,
        source: 'case_open',
        sourceRef: caseSlug,
      })
      xpTxnId = r.transactionId
    }
    // badge/cosmetic/fragment: recorded in CaseOpening; inventory grant lives
    // in Phase 9 (badges/cosmetics inventory). For MVP, opening still credits
    // the guaranteedMinCoins so the user is never empty-handed.
    if (rewardKind !== 'coins' && rewardKind !== 'xp') {
      const fallbackCredit = catalog.guaranteedMinCoins
      if (fallbackCredit > 0) {
        await tx.coinBalance.upsert({
          where: { userId },
          create: { userId, amount: 0 },
          update: {},
        })
        const r = await applyDelta(tx, userId, {
          delta: fallbackCredit,
          source: 'case_open',
          sourceRef: caseSlug,
          metadata: { rewardKind, referenceId: reward.referenceId, note: 'guaranteed_min' },
        })
        coinTxnId = r.transactionId
      }
    }

    // Pity step: increment when result is the catalog's lowest-weight
    // junk-tier (rewards with `minPityCount == 0` and weight == min weight);
    // reset otherwise (including pity-triggered opens).
    const zeroPityRewards = catalog.rewards.filter((r) => r.minPityCount === 0)
    const minWeight = zeroPityRewards.length > 0
      ? Math.min(...zeroPityRewards.map((r) => r.weight))
      : 0
    const isJunk =
      reward.minPityCount === 0 && reward.weight === minWeight && !pityTriggered
    const pityAfter = pityTriggered ? 0 : isJunk ? pityBefore + 1 : 0
    await tx.userPity.update({
      where: { userId_caseSlug: { userId, caseSlug } },
      data: { count: pityAfter },
    })

    const opening = await tx.caseOpening.create({
      data: {
        userId,
        caseSlug,
        rewardId: reward.id,
        rewardKind: reward.kind,
        rewardValue: appliedValue,
        rewardReferenceId: reward.referenceId,
        coinTransactionId: coinTxnId,
        xpTransactionId: xpTxnId,
        pityCountBefore: pityBefore,
        pityCountAfter: pityAfter,
        metadata: { pityTriggered } satisfies Prisma.InputJsonValue,
      },
      select: { id: true },
    })

    const inv = await tx.userCaseInventory.findUnique({
      where: { userId_caseSlug: { userId, caseSlug } },
      select: { count: true },
    })

    return {
      caseSlug,
      reward: {
        rewardId: reward.id,
        kind: rewardKind,
        value: appliedValue,
        referenceId: reward.referenceId,
      },
      pityCountBefore: pityBefore,
      pityCountAfter: pityAfter,
      pityTriggered,
      coinTransactionId: coinTxnId,
      xpTransactionId: xpTxnId,
      inventoryRemaining: inv?.count ?? 0,
      openingId: opening.id,
    }
  }, TX_SERIAL)
}

/**
 * `true` when the slug exists in the new catalog (and is active). Used by
 * the legacy CoinHub open-case shim to decide whether to delegate.
 */
export async function isCatalogSlug(slug: string): Promise<boolean> {
  const row = await prisma.caseCatalog.findUnique({
    where: { slug },
    select: { isActive: true },
  })
  return !!row && row.isActive
}
