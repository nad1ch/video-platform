import type { Prisma } from '@prisma/client'
import { levelFromXp } from './levelCurve'
import type { WalletApplyInput, WalletApplyResult } from './types'

/**
 * XP ledger writer — the single function permitted to mutate `XpBalance`.
 * Mirrors `walletService.applyDelta` for coins but with two differences:
 *
 *   1. Auto-ensures the `XpBalance` row on first write (callers do not need
 *      to call an `ensureUserXp` first). XP is granted from many call sites
 *      and an explicit ensure call would create one extra DB round-trip per
 *      grant for no value.
 *   2. Recomputes the materialized `level` column from the new amount via
 *      `levelCurve.levelFromXp` so reads do not need to redo the math.
 *
 * Caller contract:
 *   - Must run inside a Prisma transaction (`Serializable` preferred for
 *     contended writes).
 *   - `delta` is truncated to an integer; non-finite throws.
 *   - `delta < 0` is supported (admin revoke), refuses to drive balance < 0.
 *
 * Idempotency, source/sourceRef/metadata handling matches `applyDelta`.
 */
export async function applyXpDelta(
  tx: Prisma.TransactionClient,
  userId: string,
  input: WalletApplyInput,
): Promise<WalletApplyResult> {
  const delta = Math.trunc(input.delta)
  if (!Number.isFinite(delta)) {
    throw new Error(
      `xpService.applyXpDelta: non-finite delta (received ${input.delta})`,
    )
  }
  if (typeof input.source !== 'string' || input.source.length === 0) {
    throw new Error('xpService.applyXpDelta: source is required')
  }

  const idempotencyKey =
    typeof input.idempotencyKey === 'string' && input.idempotencyKey.length > 0
      ? input.idempotencyKey
      : null

  if (idempotencyKey !== null) {
    const existing = await tx.xpTransaction.findUnique({
      where: { idempotencyKey },
      select: { id: true, balanceBefore: true, balanceAfter: true },
    })
    if (existing) {
      return {
        balanceBefore: existing.balanceBefore,
        balanceAfter: existing.balanceAfter,
        transactionId: existing.id,
        idempotentReplay: true,
      }
    }
  }

  await tx.xpBalance.upsert({
    where: { userId },
    create: { userId, amount: 0, level: 0 },
    update: {},
  })
  const balance = await tx.xpBalance.findUniqueOrThrow({
    where: { userId },
    select: { amount: true },
  })
  const balanceBefore = balance.amount
  const balanceAfter = balanceBefore + delta
  if (balanceAfter < 0) {
    throw new Error(
      `xpService.applyXpDelta: refusing negative XP balance for user ${userId} (would be ${balanceAfter})`,
    )
  }
  const nextLevel = levelFromXp(balanceAfter)

  if (delta !== 0) {
    await tx.xpBalance.update({
      where: { userId },
      data: { amount: balanceAfter, level: nextLevel },
    })
  }

  const sourceRef =
    typeof input.sourceRef === 'string' && input.sourceRef.length > 0
      ? input.sourceRef
      : null

  const created = await tx.xpTransaction.create({
    data: {
      userId,
      delta,
      balanceBefore,
      balanceAfter,
      source: input.source,
      sourceRef,
      idempotencyKey,
      metadata: input.metadata ?? undefined,
    },
    select: { id: true },
  })

  return {
    balanceBefore,
    balanceAfter,
    transactionId: created.id,
    idempotentReplay: false,
  }
}
