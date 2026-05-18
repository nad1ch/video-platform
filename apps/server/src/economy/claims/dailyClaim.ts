import type { Prisma } from '@prisma/client'
import { prisma } from '../../prisma'
import { DAILY_CLAIM } from '../economyConfig'
import { grantPending } from './claimService'

const TX_SERIAL: { isolationLevel: Prisma.TransactionIsolationLevel } = {
  isolationLevel: 'Serializable',
}

/**
 * UTC "yyyy-mm-dd" bucket — used to scope the daily grant to a calendar day
 * regardless of viewer timezone. Two viewers logging in at 23:59 and 00:01
 * UTC each get their own grant; one viewer reloading at 23:59 then 00:01
 * gets two grants on consecutive days.
 */
export function utcDayKey(d: Date): string {
  const y = d.getUTCFullYear()
  const m = `${d.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${d.getUTCDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

export type DailyClaimResult =
  | { granted: true; pendingRewardId: string; coinAmount: number; xpAmount: number }
  | { granted: false; reason: 'already_claimed_today'; pendingRewardId: string }

/**
 * Grant the once-per-UTC-day "daily" PendingReward. Idempotency is enforced
 * by the unique `idempotencyKey = 'daily:<userId>:<utcDay>'` constraint on
 * PendingReward — the second writer (two-tab race or repeated POST) sees an
 * existing row and returns `granted: false` without producing a duplicate.
 *
 * Returns a structured result so the HTTP layer can distinguish "first
 * grant of today" (201/200 + new pending row) from "already had today's"
 * (200 + existing pending row id).
 *
 * NOTE: this only creates the PendingReward — it does NOT credit the wallet.
 * The viewer claims it later via `POST /api/economy/claims/all` (or the
 * legacy `POST /api/coinhub/claim`). This keeps the "earn → claim" flow
 * consistent across daily, chat, game, and prediction rewards.
 */
export async function grantDailyClaim(
  userId: string,
  now: Date = new Date(),
): Promise<DailyClaimResult> {
  const day = utcDayKey(now)
  const idempotencyKey = `daily:${userId}:${day}`
  const coinAmount = DAILY_CLAIM.coins
  const xpAmount = DAILY_CLAIM.xp

  return prisma.$transaction(async (tx) => {
    const result = await grantPending(
      tx,
      {
        userId,
        kind: 'daily',
        coinAmount,
        xpAmount,
        idempotencyKey,
        sourceRef: day,
      },
      now,
    )
    if (result.idempotentReplay) {
      return {
        granted: false,
        reason: 'already_claimed_today',
        pendingRewardId: result.pendingRewardId,
      }
    }
    return {
      granted: true,
      pendingRewardId: result.pendingRewardId,
      coinAmount,
      xpAmount,
    }
  }, TX_SERIAL)
}
