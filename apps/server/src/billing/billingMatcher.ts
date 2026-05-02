import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import {
  CURRENCY_UAH,
  ELIGIBLE_FOR_MATCH,
  PLAN_PRO,
  type PaymentRequestStatus,
  type SubscriptionStatus,
} from './types'

type Tx = Prisma.TransactionClient

const TX_SERIALIZABLE: { isolationLevel: Prisma.TransactionIsolationLevel } = {
  isolationLevel: 'Serializable',
}

/**
 * Outcome of matching a single transaction. Distinct from the per-transaction
 * matching loop result so callers can render audit-quality logs.
 */
export type MatchTxnOutcome =
  | { kind: 'matched'; transactionId: string; paymentRequestId: string; userId: string; activated: boolean }
  | { kind: 'needs_review'; transactionId: string; paymentRequestIds: string[] }
  | { kind: 'skipped'; transactionId: string; reason: 'already_matched' | 'no_candidates' | 'ineligible_amount' }

/**
 * Eligibility: only positive incoming UAH transactions belonging to the
 * configured account can ever auto-match. Negative/outgoing/non-UAH or
 * different account ids are stored for forensic admin review but cannot
 * trigger activation by design.
 */
function transactionEligibleForAutoMatch(t: {
  direction: string
  currency: string
  amount: number
  accountId: string
  matchedPaymentRequestId: string | null
}, expectedAccountId: string): boolean {
  if (t.matchedPaymentRequestId !== null) return false
  if (t.direction !== 'incoming') return false
  if (t.currency !== CURRENCY_UAH) return false
  if (t.amount <= 0) return false
  if (t.accountId !== expectedAccountId) return false
  return true
}

function readDurationDays(): number {
  const raw = process.env.PRO_DURATION_DAYS
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 30
}

/**
 * Activate (or extend) Pro for a user inside an outer transaction.
 *
 * Idempotency: `paymentRequestUpdateMany` upstream guarantees only the row that
 * wins the `waiting_payment|checking → auto_matched` race reaches this helper.
 * Repeated webhook/poll calls for the same request hit `count === 0` and bail
 * out before activation — see `tryAutoMatchTransaction` below.
 */
async function activateProInTx(
  tx: Tx,
  userId: string,
  now: Date,
): Promise<void> {
  const durationMs = readDurationDays() * 24 * 60 * 60 * 1000
  const fromNowExpires = now.getTime() + durationMs
  const existing = await tx.subscription.findUnique({
    where: { userId },
    select: { expiresAt: true, status: true },
  })

  // Stack (extend) when there is an active future window; otherwise start now.
  const stillActive =
    existing != null &&
    existing.status === 'active' &&
    existing.expiresAt.getTime() > now.getTime()
  const expiresAt = stillActive
    ? new Date(existing!.expiresAt.getTime() + durationMs)
    : new Date(fromNowExpires)
  const startsAt = stillActive ? existing!.expiresAt : now

  await tx.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan: PLAN_PRO,
      status: 'active' satisfies SubscriptionStatus,
      startsAt,
      expiresAt,
    },
    update: {
      plan: PLAN_PRO,
      status: 'active' satisfies SubscriptionStatus,
      // Do NOT rewrite startsAt for renewals — preserves the historical timeline.
      expiresAt,
      // Reset email single-flight claims so the NEXT future expiry / cancellation
      // fires its user notification. Without this, a user who lets Pro lapse
      // (or has it cancelled), then re-pays and lapses again, would silently
      // miss the second "Pro закінчився" / "Pro скасовано" email because the
      // claim timestamp from the previous lifecycle is still set.
      expiredEmailSentAt: null,
      cancelledEmailSentAt: null,
    },
  })
}

/**
 * Attempt to auto-match a single transaction against currently-eligible payment
 * requests. The whole evaluation runs inside a Serializable DB transaction so
 * concurrent webhooks/polls cannot double-activate.
 *
 * Outcomes:
 *   - `matched`    → exactly one compatible request, attached + auto_matched + Pro activated.
 *   - `needs_review` → 2+ compatible requests, all marked `needs_review`, transaction stays unmatched.
 *   - `skipped`    → 0 compatible requests; transaction stays unmatched.
 *
 * Compatibility rules (also re-checked inside the transaction):
 *   - request.status ∈ {waiting_payment, checking}
 *   - request.amount === transaction.amount (exact kopecks)
 *   - request.currency === "UAH"
 *   - request.matchedTransactionId === null
 *   - transaction.operationTime > request.createdAt
 *   - transaction.operationTime < request.expiresAt
 */
export async function tryAutoMatchTransaction(
  monoTransactionDbId: string,
  expectedAccountId: string,
  now: Date,
): Promise<MatchTxnOutcome> {
  return prisma.$transaction(async (tx) => {
    const txn = await tx.monoTransaction.findUnique({
      where: { id: monoTransactionDbId },
      select: {
        id: true,
        amount: true,
        currency: true,
        direction: true,
        accountId: true,
        operationTime: true,
        matchedPaymentRequestId: true,
      },
    })
    if (!txn) {
      return { kind: 'skipped', transactionId: monoTransactionDbId, reason: 'no_candidates' }
    }
    if (!transactionEligibleForAutoMatch(txn, expectedAccountId)) {
      // Negative / outgoing / wrong account / wrong currency / already matched.
      return {
        kind: 'skipped',
        transactionId: txn.id,
        reason: txn.matchedPaymentRequestId !== null ? 'already_matched' : 'ineligible_amount',
      }
    }

    const candidates = await tx.paymentRequest.findMany({
      where: {
        status: { in: ELIGIBLE_FOR_MATCH as unknown as PaymentRequestStatus[] },
        amount: txn.amount,
        currency: CURRENCY_UAH,
        matchedTransactionId: null,
        // operationTime > createdAt AND operationTime < expiresAt
        createdAt: { lt: txn.operationTime },
        expiresAt: { gt: txn.operationTime },
      },
      select: { id: true, userId: true, status: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    if (candidates.length === 0) {
      return { kind: 'skipped', transactionId: txn.id, reason: 'no_candidates' }
    }

    if (candidates.length > 1) {
      // Ambiguous — never auto-activate. Mark each currently-eligible candidate
      // as `needs_review` and leave transaction unmatched so admin can decide.
      const flagged: string[] = []
      for (const c of candidates) {
        const updated = await tx.paymentRequest.updateMany({
          where: {
            id: c.id,
            status: { in: ELIGIBLE_FOR_MATCH as unknown as PaymentRequestStatus[] },
            matchedTransactionId: null,
          },
          data: {
            status: 'needs_review' satisfies PaymentRequestStatus,
            checkedAt: now,
          },
        })
        if (updated.count > 0) flagged.push(c.id)
      }
      return { kind: 'needs_review', transactionId: txn.id, paymentRequestIds: flagged }
    }

    // Exactly one candidate.
    const winner = candidates[0]!

    // Single-flight on transaction (lose race → bail).
    const txnUpdate = await tx.monoTransaction.updateMany({
      where: { id: txn.id, matchedPaymentRequestId: null },
      data: { matchedPaymentRequestId: winner.id },
    })
    if (txnUpdate.count === 0) {
      return { kind: 'skipped', transactionId: txn.id, reason: 'already_matched' }
    }

    // Single-flight on request (lose race → roll back txn change via thrown error).
    const reqUpdate = await tx.paymentRequest.updateMany({
      where: {
        id: winner.id,
        status: { in: ELIGIBLE_FOR_MATCH as unknown as PaymentRequestStatus[] },
        matchedTransactionId: null,
      },
      data: {
        status: 'auto_matched' satisfies PaymentRequestStatus,
        autoMatchedAt: now,
        checkedAt: now,
        matchedTransactionId: txn.id,
      },
    })
    if (reqUpdate.count === 0) {
      // Roll back transaction attachment so it remains available for re-evaluation.
      await tx.monoTransaction.updateMany({
        where: { id: txn.id, matchedPaymentRequestId: winner.id },
        data: { matchedPaymentRequestId: null },
      })
      return { kind: 'skipped', transactionId: txn.id, reason: 'already_matched' }
    }

    await activateProInTx(tx, winner.userId, now)

    return {
      kind: 'matched',
      transactionId: txn.id,
      paymentRequestId: winner.id,
      userId: winner.userId,
      activated: true,
    }
  }, TX_SERIALIZABLE)
}

/**
 * Approve a `needs_review` (or other non-terminal) request manually. Idempotent:
 * if the request is already `auto_matched` or `approved` we return false without
 * mutating Subscription. Rejected/expired requests cannot be approved here (caller
 * must either reject explicitly or wait for the expiry sweeper).
 */
export async function approvePaymentRequestInTx(
  paymentRequestId: string,
  adminNote: string | null,
  now: Date,
): Promise<{ activated: boolean; finalStatus: PaymentRequestStatus }> {
  return prisma.$transaction(async (tx) => {
    const req = await tx.paymentRequest.findUnique({
      where: { id: paymentRequestId },
      select: { id: true, userId: true, status: true },
    })
    if (!req) {
      return { activated: false, finalStatus: 'rejected' as PaymentRequestStatus }
    }
    if (req.status === 'auto_matched' || req.status === 'approved') {
      // Already activated — never extend twice for the same request.
      return { activated: false, finalStatus: req.status as PaymentRequestStatus }
    }
    if (req.status === 'rejected' || req.status === 'expired') {
      return { activated: false, finalStatus: req.status as PaymentRequestStatus }
    }

    const updated = await tx.paymentRequest.updateMany({
      where: {
        id: req.id,
        status: { in: ['waiting_payment', 'checking', 'needs_review', 'created'] as PaymentRequestStatus[] },
      },
      data: {
        status: 'approved' satisfies PaymentRequestStatus,
        approvedAt: now,
        checkedAt: now,
        ...(adminNote ? { adminNote } : {}),
      },
    })
    if (updated.count === 0) {
      return { activated: false, finalStatus: req.status as PaymentRequestStatus }
    }

    await activateProInTx(tx, req.userId, now)
    return { activated: true, finalStatus: 'approved' as PaymentRequestStatus }
  }, TX_SERIALIZABLE)
}

/**
 * Reject a non-terminal request manually. Cannot reject `auto_matched` or
 * `approved` — there is no revoke/refund flow in MVP, so rejecting an active
 * Pro window would be misleading. Caller must surface a 409 in that case.
 */
export async function rejectPaymentRequestInTx(
  paymentRequestId: string,
  adminNote: string | null,
  now: Date,
): Promise<{ rejected: boolean; finalStatus: PaymentRequestStatus }> {
  return prisma.$transaction(async (tx) => {
    const req = await tx.paymentRequest.findUnique({
      where: { id: paymentRequestId },
      select: { id: true, status: true },
    })
    if (!req) {
      return { rejected: false, finalStatus: 'rejected' as PaymentRequestStatus }
    }
    if (req.status === 'auto_matched' || req.status === 'approved') {
      return { rejected: false, finalStatus: req.status as PaymentRequestStatus }
    }
    if (req.status === 'rejected') {
      return { rejected: true, finalStatus: 'rejected' as PaymentRequestStatus }
    }
    const updated = await tx.paymentRequest.updateMany({
      where: {
        id: req.id,
        status: {
          in: ['waiting_payment', 'checking', 'needs_review', 'created', 'expired'] as PaymentRequestStatus[],
        },
      },
      data: {
        status: 'rejected' satisfies PaymentRequestStatus,
        rejectedAt: now,
        checkedAt: now,
        ...(adminNote ? { adminNote } : {}),
      },
    })
    if (updated.count === 0) {
      return { rejected: false, finalStatus: req.status as PaymentRequestStatus }
    }
    return { rejected: true, finalStatus: 'rejected' as PaymentRequestStatus }
  }, TX_SERIALIZABLE)
}

/**
 * Mark waiting_payment/checking requests as `expired` once their `expiresAt`
 * has passed. Called lazily on every "user-facing" request creation/read so we
 * don't need a background job in MVP. Idempotent via `updateMany` filter.
 */
export async function sweepExpiredRequests(now: Date): Promise<number> {
  const r = await prisma.paymentRequest.updateMany({
    where: {
      status: { in: ELIGIBLE_FOR_MATCH as unknown as PaymentRequestStatus[] },
      expiresAt: { lte: now },
    },
    data: {
      status: 'expired' satisfies PaymentRequestStatus,
    },
  })
  return r.count
}
