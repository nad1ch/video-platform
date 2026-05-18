import { Prisma } from '@prisma/client'
import { prisma } from '../../prisma'
import {
  SUBSCRIPTION_BOOSTS,
  type SubscriptionPlanSlug,
  resolvePendingExpiryMs,
} from '../economyConfig'
import { grantPending } from '../claims/claimService'

const TX_SERIAL: { isolationLevel: Prisma.TransactionIsolationLevel } = {
  isolationLevel: 'Serializable',
}

export type ActivePlan = SubscriptionPlanSlug | null

export type ActiveBoosts = {
  plan: ActivePlan
  /** Multiplier applied to coin earn deltas (1.0 = no boost). */
  coinsMultiplier: number
  /** Multiplier applied to XP earn deltas (1.0 = no boost). */
  xpMultiplier: number
}

/**
 * Resolve the currently active boost set for a user. Reads `Subscription`:
 * an `active` row whose `expiresAt > now` grants the configured boosts;
 * anything else returns the neutral 1.0/1.0 boost. Pro takes precedence
 * over Basic when both are somehow set (single-row schema means this is
 * defensive only).
 */
export async function resolveActiveBoosts(
  userId: string,
  now: Date = new Date(),
): Promise<ActiveBoosts> {
  const row = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true, expiresAt: true },
  })
  const inactive: ActiveBoosts = {
    plan: null,
    coinsMultiplier: 1,
    xpMultiplier: 1,
  }
  if (!row) return inactive
  if (row.status !== 'active' || row.expiresAt.getTime() <= now.getTime()) {
    return inactive
  }
  if (row.plan === 'pro') {
    return {
      plan: 'pro',
      coinsMultiplier: SUBSCRIPTION_BOOSTS.pro.coinsMultiplier,
      xpMultiplier: SUBSCRIPTION_BOOSTS.pro.xpMultiplier,
    }
  }
  if (row.plan === 'basic') {
    return {
      plan: 'basic',
      coinsMultiplier: SUBSCRIPTION_BOOSTS.basic.coinsMultiplier,
      xpMultiplier: SUBSCRIPTION_BOOSTS.basic.xpMultiplier,
    }
  }
  return inactive
}

/**
 * Apply the user's active earn boost to a base (coin, xp) reward pair. Used
 * by earn services (chat / participation / daily) before writing the
 * `PendingReward`. Boost <1 is never applied — boosts are strictly
 * generous in this MVP.
 */
export async function applyEarnBoost(
  userId: string,
  base: { coinAmount?: number; xpAmount?: number },
  now: Date = new Date(),
): Promise<{ coinAmount: number; xpAmount: number; boosts: ActiveBoosts }> {
  const boosts = await resolveActiveBoosts(userId, now)
  const coinAmount = Math.max(
    0,
    Math.floor((base.coinAmount ?? 0) * Math.max(1, boosts.coinsMultiplier)),
  )
  const xpAmount = Math.max(
    0,
    Math.floor((base.xpAmount ?? 0) * Math.max(1, boosts.xpMultiplier)),
  )
  return { coinAmount, xpAmount, boosts }
}

/**
 * Grant the monthly subscription chest as a `PendingReward(kind=
 * 'subscription_chest')` for an active subscriber. Idempotent per
 * `(userId, plan, yyyy-mm)` — re-running on the same calendar month is a
 * no-op. Returns null when the user has no active sub.
 */
export async function grantMonthlyChestIfDue(
  userId: string,
  now: Date = new Date(),
): Promise<{ pendingRewardId: string; granted: boolean; plan: ActivePlan } | null> {
  const boosts = await resolveActiveBoosts(userId, now)
  if (!boosts.plan) return null
  const ym = `${now.getUTCFullYear()}-${`${now.getUTCMonth() + 1}`.padStart(2, '0')}`
  const idempotencyKey = `subscription_chest:${boosts.plan}:${userId}:${ym}`
  const chestCfg =
    boosts.plan === 'pro' ? SUBSCRIPTION_BOOSTS.pro : SUBSCRIPTION_BOOSTS.basic
  return prisma.$transaction(async (tx) => {
    const result = await grantPending(
      tx,
      {
        userId,
        kind: 'subscription_chest',
        coinAmount: chestCfg.monthlyChestCoins,
        xpAmount: chestCfg.monthlyChestXp,
        idempotencyKey,
        sourceRef: `${boosts.plan}:${ym}`,
        metadata: { plan: boosts.plan, month: ym },
        expiresAt: new Date(now.getTime() + resolvePendingExpiryMs('subscription_chest')),
      },
      now,
    )
    return {
      pendingRewardId: result.pendingRewardId,
      granted: !result.idempotentReplay,
      plan: boosts.plan,
    }
  }, TX_SERIAL)
}
