import type { Prisma } from '@prisma/client'
import {
  WalletInsufficientFundsError,
  type WalletApplyInput,
  type WalletApplyResult,
} from './types'

/**
 * Wallet ledger writer — the single function permitted to mutate
 * `CoinBalance.amount`. Every call writes exactly one `CoinTransaction` row
 * inside the supplied Prisma transaction client so balance and ledger move
 * together atomically.
 *
 * Hard rules enforced here:
 *   1. Exactly one `CoinTransaction` row per balance mutation.
 *   2. `balanceAfter = balanceBefore + delta` (recorded both in the row and
 *      applied to `CoinBalance.amount`).
 *   3. When `delta < 0` and the wallet would go negative, throws
 *      `WalletInsufficientFundsError` — neither the balance nor the ledger
 *      is touched.
 *   4. When `idempotencyKey` is supplied and a row already exists with that
 *      key, the existing snapshot is returned and nothing new is written.
 *
 * Caller contract:
 *   - Must run inside a Prisma transaction (`Serializable` preferred for
 *     contended writes; the existing CoinHub service uses `TX_SERIAL`).
 *   - Must have ensured the `CoinBalance` row exists for `userId` before
 *     calling (CoinHub does this via `ensureUserCoinHub`).
 *   - `delta` is truncated to an integer; non-finite values throw.
 *
 * Concurrency note: the unique constraint on `CoinTransaction.idempotencyKey`
 * is the real guarantor of "at most one row per key" under racing writers.
 * The pre-check below short-circuits the common case where the key has
 * already been used by an earlier committed transaction; if two concurrent
 * Serializable transactions both pass the pre-check and try to insert, one
 * fails with P2002 — the caller's `prisma.$transaction` surfaces that as a
 * thrown error, which is the right behavior (the second writer should know
 * its operation was rejected).
 */
export async function applyDelta(
  tx: Prisma.TransactionClient,
  userId: string,
  input: WalletApplyInput,
): Promise<WalletApplyResult> {
  const delta = Math.trunc(input.delta)
  if (!Number.isFinite(delta)) {
    throw new Error(
      `walletService.applyDelta: non-finite delta (received ${input.delta})`,
    )
  }
  if (typeof input.source !== 'string' || input.source.length === 0) {
    throw new Error('walletService.applyDelta: source is required')
  }

  const idempotencyKey =
    typeof input.idempotencyKey === 'string' && input.idempotencyKey.length > 0
      ? input.idempotencyKey
      : null

  if (idempotencyKey !== null) {
    const existing = await tx.coinTransaction.findUnique({
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

  const balance = await tx.coinBalance.findUniqueOrThrow({
    where: { userId },
    select: { amount: true },
  })
  const balanceBefore = balance.amount
  const balanceAfter = balanceBefore + delta

  if (balanceAfter < 0) {
    throw new WalletInsufficientFundsError(userId, delta, balanceBefore)
  }

  if (delta !== 0) {
    await tx.coinBalance.update({
      where: { userId },
      data: { amount: balanceAfter },
    })
  }

  const sourceRef =
    typeof input.sourceRef === 'string' && input.sourceRef.length > 0
      ? input.sourceRef
      : null

  const created = await tx.coinTransaction.create({
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
