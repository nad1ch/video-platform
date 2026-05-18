import type { Prisma } from '@prisma/client'

/**
 * Known coin movement sources. Keep the literal union narrow so call sites
 * read clearly; the trailing `(string & {})` allows future branches to
 * introduce new sources (e.g. `chat_activity`, `prediction_payout`) without
 * having to land a `types.ts` edit in the same diff.
 */
export type CoinTransactionSource =
  | 'daily_spin'
  | 'case_open'
  | 'claim_pending'
  | 'admin_grant'
  | 'admin_revoke'
  | 'migration_seed'
  | (string & {})

export type WalletApplyInput = {
  delta: number
  source: CoinTransactionSource
  sourceRef?: string | null
  idempotencyKey?: string | null
  metadata?: Prisma.InputJsonValue | null
}

export type WalletApplyResult = {
  balanceBefore: number
  balanceAfter: number
  transactionId: string
  /**
   * True when this call observed an existing CoinTransaction with the same
   * `idempotencyKey` and returned its snapshot instead of writing a new row.
   * False for the normal "first write wins" path.
   */
  idempotentReplay: boolean
}

/**
 * Raised when a spend (`delta < 0`) would drive `CoinBalance.amount` below
 * zero. Callers should surface this as a 409 to the HTTP layer; the existing
 * CoinHub call sites only credit, so this is dormant in MVP.
 */
export class WalletInsufficientFundsError extends Error {
  override name = 'WalletInsufficientFundsError'
  constructor(
    public readonly userId: string,
    public readonly requested: number,
    public readonly available: number,
  ) {
    super(
      `Wallet for user ${userId} cannot apply delta=${requested}: only ${available} available`,
    )
  }
}
