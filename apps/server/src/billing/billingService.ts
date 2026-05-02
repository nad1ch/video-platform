import type { Prisma } from '@prisma/client'
import { isDatabaseConfigured, prisma } from '../prisma'
import { BillingHttpError } from './httpError'
import {
  approvePaymentRequestInTx,
  rejectPaymentRequestInTx,
  sweepExpiredRequests,
  tryAutoMatchTransaction,
} from './billingMatcher'
import {
  sendBillingAdminNotification,
  sendSubscriptionCancelledNotification,
  sendUserBillingNotification,
  type BillingAdminEventType,
  type BillingAdminNotificationContext,
} from './billingMailer'
import {
  fetchRecentStatement,
  normalizeWebhookStatementItem,
  readPersonalConfig,
  type NormalizedStatementItem,
} from './monoPersonalClient'
import {
  CURRENCY_UAH,
  ELIGIBLE_FOR_MATCH,
  PLAN_PRO,
  PROVIDER_MONO_JAR,
  type AdminListDto,
  type AdminPaymentRequestRow,
  type AdminSubscriptionListDto,
  type AdminSubscriptionRow,
  type AdminTransactionRow,
  type BillingConfigDto,
  type MarkPaidDto,
  type OwnedPaymentRequestDto,
  type PaymentRequestDto,
  type PaymentRequestStatus,
  type SubscriptionDto,
  type SubscriptionStatus,
  type TransactionDirection,
} from './types'

const DEFAULT_PRICE_UAH = 99
const DEFAULT_MATCH_WINDOW_MINUTES = 15

function ensureDatabase(): void {
  if (!isDatabaseConfigured()) {
    throw new BillingHttpError(503, 'DATABASE_UNAVAILABLE', 'Database is not configured')
  }
}

function readPriceUah(): number {
  const raw = process.env.PRO_PRICE_UAH
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PRICE_UAH
}

function readPriceKopecks(): number {
  return Math.round(readPriceUah() * 100)
}

function readMatchWindowMinutes(): number {
  const raw = process.env.PAYMENT_MATCH_WINDOW_MINUTES
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : DEFAULT_MATCH_WINDOW_MINUTES
}

function readJarUrl(): string {
  const raw = process.env.MONO_JAR_URL
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new BillingHttpError(
      503,
      'MONO_JAR_NOT_CONFIGURED',
      'MONO_JAR_URL is not configured on the server',
    )
  }
  return raw.trim()
}

function fmtUahLabel(amountKopecks: number): string {
  // Always 2-decimal so the FE can render it verbatim without locale guessing.
  return (amountKopecks / 100).toFixed(2)
}

function toIso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null
}

function deriveSubscriptionDto(
  row: { plan: string; status: string; expiresAt: Date } | null,
  now: Date,
): SubscriptionDto {
  if (!row) {
    return { status: null, plan: null, expiresAt: null, isActive: false }
  }
  const expiresMs = row.expiresAt.getTime()
  // Reconcile lazily on read: an `active` row with `expiresAt <= now` is
  // surfaced as `expired`. We deliberately do NOT mutate the DB on read paths
  // — `isActive` is the authoritative answer for callers anyway.
  let status: SubscriptionStatus
  if (row.status === 'active') {
    status = expiresMs > now.getTime() ? 'active' : 'expired'
  } else if (row.status === 'inactive') {
    status = 'inactive'
  } else {
    status = 'expired'
  }
  return {
    status,
    plan: row.plan === PLAN_PRO ? PLAN_PRO : null,
    expiresAt: row.expiresAt.toISOString(),
    isActive: status === 'active',
  }
}

function readDurationDaysSafe(): number {
  const raw = process.env.PRO_DURATION_DAYS
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 30
}

/**
 * `GET /api/billing/config`. Authoritative billing config snapshot derived
 * from the current process env. The FE pricing card and modal label read
 * from this — no hardcoded amount/duration anywhere on the client.
 *
 * Returns even when DB is not configured (dev/manual-review mode) — the
 * pricing card is purely informational and must not depend on Postgres.
 * `MONO_JAR_URL` is intentionally NOT exposed; only `jarConfigured`. The
 * actual Jar URL ships per-request via `create-payment-request`.
 */
export function getBillingConfigDto(): BillingConfigDto {
  const priceUah = readPriceUah()
  const amount = readPriceKopecks()
  const jarRaw = process.env.MONO_JAR_URL
  return {
    priceUah,
    amount,
    amountUah: fmtUahLabel(amount),
    currency: CURRENCY_UAH,
    durationDays: readDurationDaysSafe(),
    matchWindowMinutes: readMatchWindowMinutes(),
    jarConfigured: typeof jarRaw === 'string' && jarRaw.trim().length > 0,
  }
}

/**
 * `GET /api/billing/subscription/me`. Falls back to a "not active" snapshot
 * when DB isn't configured so dev/manual-review modes never crash.
 */
export async function getSubscriptionDtoForUser(userId: string): Promise<SubscriptionDto> {
  if (!isDatabaseConfigured()) {
    return { status: null, plan: null, expiresAt: null, isActive: false }
  }
  const row = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true, expiresAt: true },
  })
  return deriveSubscriptionDto(row, new Date())
}

/**
 * `GET /api/billing/jar/payment-request/:id`. Owner-only snapshot used by the
 * FE modal to poll request status WITHOUT also re-running the matcher (unlike
 * `mark-paid`). Sweeps expired requests first so an out-of-window row is
 * surfaced as `expired` consistently. Returns 404 — never 403 — when the row
 * does not exist or belongs to another user, so existence is not leaked.
 *
 * The DTO intentionally omits `internalReference`, admin note, matched
 * transaction details, etc. — those are admin-only concerns. The user only
 * needs to see status, expiresAt, amount, and the current subscription.
 */
export async function getOwnedPaymentRequestSnapshot(
  userId: string,
  paymentRequestId: string,
): Promise<OwnedPaymentRequestDto> {
  ensureDatabase()
  if (typeof paymentRequestId !== 'string' || paymentRequestId.length === 0) {
    throw new BillingHttpError(400, 'BAD_REQUEST', 'paymentRequestId is required')
  }
  // Sweep before reading so a row past `expiresAt` reports as `expired` even
  // when no other call has touched the table since the deadline passed.
  await sweepExpiredRequests(new Date())
  const row = await prisma.paymentRequest.findUnique({
    where: { id: paymentRequestId },
    select: {
      id: true,
      userId: true,
      status: true,
      expiresAt: true,
      amount: true,
      currency: true,
    },
  })
  if (!row || row.userId !== userId) {
    throw new BillingHttpError(404, 'NOT_FOUND', 'Payment request not found')
  }
  const subscription = await getSubscriptionDtoForUser(userId)
  return {
    paymentRequestId: row.id,
    status: row.status as PaymentRequestStatus,
    expiresAt: row.expiresAt.toISOString(),
    amount: row.amount,
    amountUah: fmtUahLabel(row.amount),
    currency: CURRENCY_UAH,
    subscription,
  }
}

/**
 * Build the public payment-request DTO. The `internalReference` is intentionally
 * NOT exposed — it's there to support a future "comment-coded" variant but the
 * matcher does not consume it, so leaking it would be misleading.
 */
function buildPublicDto(
  req: { id: string; status: string; expiresAt: Date; amount: number },
  jarUrl: string,
): PaymentRequestDto {
  return {
    paymentRequestId: req.id,
    amount: req.amount,
    amountUah: fmtUahLabel(req.amount),
    currency: CURRENCY_UAH,
    jarUrl,
    status: req.status as PaymentRequestStatus,
    expiresAt: req.expiresAt.toISOString(),
  }
}

/**
 * Idempotent "create or reuse" semantics: while the user has an active
 * waiting_payment/checking request that is not yet expired, return that. This
 * prevents accidental fan-out when "Buy Pro" is clicked multiple times. Expired
 * leftovers are reaped in the same call so the next click starts a fresh window.
 */
export async function createOrReusePaymentRequest(userId: string): Promise<PaymentRequestDto> {
  ensureDatabase()
  const jarUrl = readJarUrl() // throw early if jar URL missing
  const now = new Date()
  await sweepExpiredRequests(now)

  const reusable = await prisma.paymentRequest.findFirst({
    where: {
      userId,
      provider: PROVIDER_MONO_JAR,
      status: { in: ELIGIBLE_FOR_MATCH as unknown as PaymentRequestStatus[] },
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, expiresAt: true, amount: true },
  })
  if (reusable) {
    return buildPublicDto(reusable, jarUrl)
  }

  const amount = readPriceKopecks()
  const expiresAt = new Date(now.getTime() + readMatchWindowMinutes() * 60 * 1000)
  const created = await prisma.paymentRequest.create({
    data: {
      userId,
      provider: PROVIDER_MONO_JAR,
      amount,
      currency: CURRENCY_UAH,
      status: 'waiting_payment' satisfies PaymentRequestStatus,
      expiresAt,
    },
    select: { id: true, status: true, expiresAt: true, amount: true },
  })
  return buildPublicDto(created, jarUrl)
}

/**
 * `POST /api/billing/jar/mark-paid`. Owner-only. Idempotent.
 *
 * Behavior matrix (status before → status after / side effect):
 *   waiting_payment  → checking + markedPaidAt + immediate match attempt
 *   checking         → unchanged + match attempt (idempotent)
 *   needs_review     → unchanged (admin owns terminal state)
 *   auto_matched     → unchanged (already activated)
 *   approved         → unchanged
 *   rejected         → unchanged
 *   expired          → unchanged; client should create a new request
 */
export async function markPaymentRequestAsPaid(
  userId: string,
  paymentRequestId: string,
): Promise<MarkPaidDto> {
  ensureDatabase()
  if (typeof paymentRequestId !== 'string' || paymentRequestId.length === 0) {
    throw new BillingHttpError(400, 'BAD_REQUEST', 'paymentRequestId is required')
  }
  const now = new Date()
  await sweepExpiredRequests(now)

  const req = await prisma.paymentRequest.findUnique({
    where: { id: paymentRequestId },
    select: { id: true, userId: true, status: true, expiresAt: true, amount: true },
  })
  if (!req) {
    throw new BillingHttpError(404, 'NOT_FOUND', 'Payment request not found')
  }
  if (req.userId !== userId) {
    // Always 404 — never leak existence of someone else's row.
    throw new BillingHttpError(404, 'NOT_FOUND', 'Payment request not found')
  }

  // Transition to `checking` only from `waiting_payment` (single-flight via filter).
  if (req.status === 'waiting_payment' && req.expiresAt.getTime() > now.getTime()) {
    await prisma.paymentRequest.updateMany({
      where: { id: req.id, status: 'waiting_payment' as PaymentRequestStatus },
      data: {
        status: 'checking' satisfies PaymentRequestStatus,
        markedPaidAt: now,
        checkedAt: now,
      },
    })
  } else if (req.status === 'checking') {
    // Repeated click — bump checkedAt only.
    await prisma.paymentRequest.updateMany({
      where: { id: req.id, status: 'checking' as PaymentRequestStatus },
      data: { checkedAt: now },
    })
  }

  // Best-effort statement pull + matching pass. Both swallow errors internally
  // so a Mono outage cannot crash mark-paid.
  const cfg = readPersonalConfig()
  const monoConfigured = cfg !== null
  if (cfg) {
    try {
      await pollAndMatchOnce(now)
    } catch (err) {
      console.warn('[billing] pollAndMatchOnce failed', (err as Error).message)
    }
  }

  // Re-read terminal state for response.
  const fresh = await prisma.paymentRequest.findUnique({
    where: { id: req.id },
    select: { id: true, status: true, expiresAt: true, amount: true, autoMatchedAt: true },
  })
  const finalReq = fresh ?? req
  const subscription = await getSubscriptionDtoForUser(userId)

  // Best-effort outbound email when this exact transition just landed in
  // `auto_matched`. We persist the timestamp first (single-flight) so retries
  // never double-send.
  if (fresh && fresh.status === 'auto_matched') {
    await sendStatusEmailIfNotSent(fresh.id, 'auto_matched')
  }

  return {
    paymentRequestId: finalReq.id,
    status: finalReq.status as PaymentRequestStatus,
    expiresAt: finalReq.expiresAt.toISOString(),
    subscription,
    monoConfigured,
  }
}

/**
 * Persist a normalized statement item idempotently and run a single matcher
 * pass against it. Webhook + polling both go through this helper so duplicate
 * deliveries / overlap with `mark-paid` cannot double-activate.
 */
async function persistAndMatchStatementItem(
  item: NormalizedStatementItem,
  accountId: string,
  now: Date,
): Promise<void> {
  // Upsert — repeated webhooks for the same id collapse to a no-op update.
  let stored: { id: string }
  try {
    const rawPayloadJson = item.raw as unknown as Prisma.InputJsonValue
    stored = await prisma.monoTransaction.upsert({
      where: { monoTransactionId: item.monoTransactionId },
      create: {
        monoTransactionId: item.monoTransactionId,
        accountId,
        amount: item.amount,
        direction: item.direction,
        currency: item.currency,
        description: item.description,
        operationTime: item.operationTime,
        rawPayload: rawPayloadJson,
      },
      update: {
        // Refresh forensic fields only — never mutate matchedPaymentRequestId here.
        amount: item.amount,
        direction: item.direction,
        currency: item.currency,
        description: item.description,
        operationTime: item.operationTime,
        rawPayload: rawPayloadJson,
      },
      select: { id: true },
    })
  } catch (err) {
    console.warn('[billing] monoTransaction upsert failed', (err as Error).message)
    return
  }

  const personalCfg = readPersonalConfig()
  if (!personalCfg) {
    // We have a transaction row but no account-id authority — leave it
    // unmatched; admin can still review.
    return
  }

  const outcome = await tryAutoMatchTransaction(stored.id, personalCfg.accountId, now)
  if (outcome.kind === 'matched') {
    await sendStatusEmailIfNotSent(outcome.paymentRequestId, 'auto_matched')
  } else if (outcome.kind === 'needs_review') {
    for (const id of outcome.paymentRequestIds) {
      await sendStatusEmailIfNotSent(id, 'needs_review')
    }
  }
}

/**
 * Polling helper: pull recent statement and run matcher per-item.
 *
 * Rate limiting is enforced inside `fetchRecentStatement` — a 60-second per-
 * account cool-down — so repeated `mark-paid` clicks cannot hammer the API.
 */
async function pollAndMatchOnce(now: Date): Promise<void> {
  const result = await fetchRecentStatement({ now: () => now.getTime() })
  if (!result.ok) return
  const cfg = readPersonalConfig()
  if (!cfg) return
  for (const item of result.items) {
    await persistAndMatchStatementItem(item, cfg.accountId, now)
  }
}

/**
 * Admin-only "force re-poll mono now". Bypasses the 60 s in-process cool-down
 * so an operator can manually re-trigger a fetch+match after correcting
 * config (e.g. setting MONO_ACCOUNT_ID to the actual jar id). Surfaces a
 * structured outcome so the admin UI can render a useful status line.
 *
 * Does NOT change matching/activation rules — runs the exact same pipeline
 * (`fetchRecentStatement` → `persistAndMatchStatementItem` → matcher) as the
 * automatic path. Just lifts the local rate-limiter for one call. Monobank's
 * own server-side rate limit (returns 429) is still respected and surfaced.
 */
export type AdminForcePollResult =
  | { ok: true; itemCount: number; accountId: string }
  | {
      ok: false
      reason: 'not_configured' | 'rate_limited' | 'error'
      message?: string
    }

export async function forceAdminPollAndMatch(): Promise<AdminForcePollResult> {
  ensureDatabase()
  const cfg = readPersonalConfig()
  if (!cfg) {
    return { ok: false, reason: 'not_configured' }
  }
  const now = new Date()
  const result = await fetchRecentStatement({
    now: () => now.getTime(),
    force: true,
  })
  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      message: result.reason === 'error' ? result.message : undefined,
    }
  }
  for (const item of result.items) {
    await persistAndMatchStatementItem(item, cfg.accountId, now)
  }
  return { ok: true, itemCount: result.items.length, accountId: cfg.accountId }
}

/**
 * Webhook ingestion. Returns quickly — the actual matching can be fire-and-
 * forget for monobank since we'll re-poll if needed; but doing it inline is
 * cheap (one Serializable txn) and gives a faster activation experience.
 *
 * Defence-in-depth: we always reach back to `tryAutoMatchTransaction` which
 * re-reads from DB, so attacker-controlled webhook fields can't tilt activation.
 */
export async function ingestStatementWebhook(rawBody: unknown): Promise<{ accepted: boolean }> {
  ensureDatabase()
  const { accountId, item } = normalizeWebhookStatementItem(rawBody)
  if (!item || !accountId) {
    // Always respond 200 in the router so monobank doesn't retry-storm us, but
    // signal "not accepted" for logging.
    return { accepted: false }
  }
  const cfg = readPersonalConfig()
  // If the webhook account doesn't match our configured account, persist as
  // unmatched (still useful for admin forensic review).
  const ourAccountId = cfg?.accountId ?? accountId
  await persistAndMatchStatementItem(item, ourAccountId, new Date())
  return { accepted: true }
}

/* -------------------------------------------------------------------------- */
/* Email helpers                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Send the per-event admin notification, exactly once per (PaymentRequest, event)
 * pair. We single-flight-claim the timestamp BEFORE calling the mailer so that:
 *   - racing callers (webhook + polling, double-click, retry-storms) cannot
 *     send the same notification twice;
 *   - SMTP failure does NOT roll back the billing state machine — the email is
 *     simply lost, logged via the mailer's `console.warn`, and ops can re-send
 *     manually if needed (clearing the timestamp).
 */
async function sendStatusEmailIfNotSent(
  paymentRequestId: string,
  kind: BillingAdminEventType,
): Promise<void> {
  const sentFieldName: keyof BillingAdminNotificationClaimFields =
    kind === 'auto_matched'
      ? 'autoMatchedEmailSentAt'
      : kind === 'needs_review'
        ? 'needsReviewEmailSentAt'
        : kind === 'approved'
          ? 'approvedEmailSentAt'
          : 'rejectedEmailSentAt'

  // Single-flight claim: only the first concurrent call clears the null and
  // proceeds. Repeated webhook/polling/admin clicks return `count: 0` here.
  const claim = await prisma.paymentRequest.updateMany({
    where: { id: paymentRequestId, [sentFieldName]: null },
    data: { [sentFieldName]: new Date() },
  })
  if (claim.count === 0) return

  // Read full snapshot from DB AFTER claim so retries (admin replays) cannot
  // produce inconsistent context. Errors here just log and bail — the email
  // is best-effort and we already have the audit row.
  let row
  try {
    row = await prisma.paymentRequest.findUnique({
      where: { id: paymentRequestId },
      select: {
        id: true,
        userId: true,
        status: true,
        amount: true,
        currency: true,
        adminNote: true,
        createdAt: true,
        expiresAt: true,
        markedPaidAt: true,
        checkedAt: true,
        autoMatchedAt: true,
        approvedAt: true,
        rejectedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            twitchId: true,
          },
        },
        matchedTransaction: {
          select: {
            id: true,
            monoTransactionId: true,
            amount: true,
            currency: true,
            operationTime: true,
          },
        },
      },
    })
  } catch (err) {
    console.warn(
      '[billing][mail] context fetch failed',
      paymentRequestId,
      kind,
      (err as Error).message,
    )
    return
  }
  if (!row) return

  // Subscription is per-user; fetch separately so we don't widen the include
  // graph above. Only meaningful for activation events but we always include
  // it so `expired` / `inactive` is visible to ops on rejected/needs_review too.
  const sub = await prisma.subscription.findUnique({
    where: { userId: row.userId },
    select: { plan: true, expiresAt: true, status: true },
  })

  const now = new Date()
  const subscriptionCtx: BillingAdminNotificationContext['subscription'] = sub
    ? {
        plan: sub.plan,
        expiresAt: sub.expiresAt,
        isActive: sub.status === 'active' && sub.expiresAt.getTime() > now.getTime(),
      }
    : null

  const ctx: BillingAdminNotificationContext = {
    event: kind,
    paymentRequest: {
      id: row.id,
      status: row.status,
      amountKopecks: row.amount,
      currency: row.currency,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      markedPaidAt: row.markedPaidAt,
      checkedAt: row.checkedAt,
      autoMatchedAt: row.autoMatchedAt,
      approvedAt: row.approvedAt,
      rejectedAt: row.rejectedAt,
      adminNote: row.adminNote,
    },
    user: {
      id: row.user?.id ?? row.userId,
      email: row.user?.email ?? null,
      displayName: row.user?.displayName ?? null,
      twitchHandle: row.user?.twitchId ?? null,
    },
    transaction: row.matchedTransaction
      ? {
          id: row.matchedTransaction.id,
          monoTransactionId: row.matchedTransaction.monoTransactionId,
          amountKopecks: row.matchedTransaction.amount,
          currency: row.matchedTransaction.currency,
          operationTime: row.matchedTransaction.operationTime,
        }
      : null,
    subscription: subscriptionCtx,
  }

  await sendBillingAdminNotification(ctx)

  // User-facing notification — best-effort. Skipped silently when:
  //   - the user has no email on record (e.g. Twitch login without email);
  //   - SMTP is not configured (logged once by the shared transport).
  // Both admin and user emails are gated by the same single-flight claim
  // above, so repeated webhook deliveries / repeated admin approve/reject
  // clicks cannot cause a duplicate user email. SMTP failure here is
  // swallowed by the mailer — billing state never rolls back on email loss.
  const userEmail = row.user?.email ?? null
  if (userEmail) {
    await sendUserBillingNotification({
      event: kind,
      to: userEmail,
      displayName: row.user?.displayName ?? 'StreamAssist',
      amountKopecks: row.amount,
      currency: row.currency,
      // Activation events: pass the freshly-activated subscription expiry so
      // the user's email shows "active until …". needs_review/rejected pass
      // null — the templates omit the expiry line.
      subscriptionExpiresAt:
        (kind === 'auto_matched' || kind === 'approved') &&
        subscriptionCtx?.isActive
          ? subscriptionCtx.expiresAt
          : null,
      adminNote: kind === 'rejected' ? row.adminNote : null,
    })
  }
}

/** Type alias purely so the field-name lookup above stays type-safe. */
type BillingAdminNotificationClaimFields = {
  autoMatchedEmailSentAt: Date | null
  needsReviewEmailSentAt: Date | null
  approvedEmailSentAt: Date | null
  rejectedEmailSentAt: Date | null
}

/* -------------------------------------------------------------------------- */
/* Admin helpers                                                              */
/* -------------------------------------------------------------------------- */

function transactionToAdminRow(t: {
  id: string
  monoTransactionId: string
  amount: number
  currency: string
  direction: string
  description: string | null
  operationTime: Date
  matchedPaymentRequestId: string | null
}): AdminTransactionRow {
  return {
    id: t.id,
    monoTransactionId: t.monoTransactionId,
    amount: t.amount,
    amountUah: fmtUahLabel(t.amount),
    currency: t.currency,
    direction: t.direction as TransactionDirection,
    description: t.description,
    operationTime: t.operationTime.toISOString(),
    matchedPaymentRequestId: t.matchedPaymentRequestId,
  }
}

/**
 * Admin queue: requests that actually need operator attention, plus recent
 * unmatched transactions so the operator has reconciliation context.
 *
 * Only `checking` (user said "I paid", auto-match in flight) and `needs_review`
 * (matcher escalated due to ambiguity) are surfaced. `waiting_payment` rows
 * are deliberately EXCLUDED — they are created the moment the user opens the
 * payment modal, before any user action ("I paid"), and should not pollute
 * the manual-review queue. They remain eligible for auto-match server-side
 * (the matcher still considers them) and either transition naturally or
 * expire after `PAYMENT_MATCH_WINDOW_MINUTES`.
 *
 * We also surface "candidate transactions" per request (same amount, in window,
 * unmatched) — purely informational. Matching the candidate is still routed
 * through the explicit `approve` endpoint to preserve idempotency invariants.
 */
export async function listAdminPaymentRequests(
  opts?: { limit?: number },
): Promise<AdminListDto> {
  ensureDatabase()
  const limit = Math.max(1, Math.min(200, opts?.limit ?? 50))
  const now = new Date()
  await sweepExpiredRequests(now)

  const rows = await prisma.paymentRequest.findMany({
    where: {
      status: {
        in: ['checking', 'needs_review'] as PaymentRequestStatus[],
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      userId: true,
      amount: true,
      currency: true,
      status: true,
      internalReference: true,
      adminNote: true,
      createdAt: true,
      expiresAt: true,
      markedPaidAt: true,
      matchedTransactionId: true,
      user: { select: { email: true, displayName: true } },
      matchedTransaction: {
        select: {
          id: true,
          monoTransactionId: true,
          amount: true,
          currency: true,
          direction: true,
          description: true,
          operationTime: true,
          matchedPaymentRequestId: true,
        },
      },
    },
  })

  // Bulk fetch candidate transactions for every distinct amount/window.
  const candidatesByRequest = new Map<string, AdminTransactionRow[]>()
  for (const row of rows) {
    const candidates = await prisma.monoTransaction.findMany({
      where: {
        amount: row.amount,
        currency: CURRENCY_UAH,
        direction: 'incoming',
        matchedPaymentRequestId: null,
        operationTime: { gt: row.createdAt, lt: row.expiresAt },
      },
      orderBy: { operationTime: 'desc' },
      take: 5,
      select: {
        id: true,
        monoTransactionId: true,
        amount: true,
        currency: true,
        direction: true,
        description: true,
        operationTime: true,
        matchedPaymentRequestId: true,
      },
    })
    candidatesByRequest.set(row.id, candidates.map(transactionToAdminRow))
  }

  const requests: AdminPaymentRequestRow[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userEmail: r.user?.email ?? null,
    userDisplayName: r.user?.displayName ?? '',
    amount: r.amount,
    amountUah: fmtUahLabel(r.amount),
    currency: CURRENCY_UAH,
    status: r.status as PaymentRequestStatus,
    internalReference: r.internalReference,
    adminNote: r.adminNote,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    markedPaidAt: toIso(r.markedPaidAt),
    matchedTransactionId: r.matchedTransactionId,
    matchedTransaction: r.matchedTransaction ? transactionToAdminRow(r.matchedTransaction) : null,
    candidateTransactions: candidatesByRequest.get(r.id) ?? [],
  }))

  // Recent overall unmatched transactions for forensic context (e.g. someone
  // paid an unrelated amount).
  const unmatched = await prisma.monoTransaction.findMany({
    where: { matchedPaymentRequestId: null },
    orderBy: { operationTime: 'desc' },
    take: 50,
    select: {
      id: true,
      monoTransactionId: true,
      amount: true,
      currency: true,
      direction: true,
      description: true,
      operationTime: true,
      matchedPaymentRequestId: true,
    },
  })

  return {
    requests,
    unmatchedTransactions: unmatched.map(transactionToAdminRow),
  }
}

export async function adminApprovePaymentRequest(
  paymentRequestId: string,
  adminNote: string | null,
): Promise<{ status: PaymentRequestStatus; activated: boolean }> {
  ensureDatabase()
  if (typeof paymentRequestId !== 'string' || paymentRequestId.length === 0) {
    throw new BillingHttpError(400, 'BAD_REQUEST', 'paymentRequestId is required')
  }
  const now = new Date()
  const result = await approvePaymentRequestInTx(paymentRequestId, adminNote, now)
  if (result.activated) {
    await sendStatusEmailIfNotSent(paymentRequestId, 'approved')
  }
  return { status: result.finalStatus, activated: result.activated }
}

export async function adminRejectPaymentRequest(
  paymentRequestId: string,
  adminNote: string | null,
): Promise<{ status: PaymentRequestStatus; rejected: boolean }> {
  ensureDatabase()
  if (typeof paymentRequestId !== 'string' || paymentRequestId.length === 0) {
    throw new BillingHttpError(400, 'BAD_REQUEST', 'paymentRequestId is required')
  }
  // Block reject when already activated (no refund/revoke flow in MVP).
  const existing = await prisma.paymentRequest.findUnique({
    where: { id: paymentRequestId },
    select: { status: true },
  })
  if (!existing) {
    throw new BillingHttpError(404, 'NOT_FOUND', 'Payment request not found')
  }
  if (existing.status === 'auto_matched' || existing.status === 'approved') {
    throw new BillingHttpError(
      409,
      'ALREADY_ACTIVATED',
      'Cannot reject an already-activated request (no revoke flow in MVP)',
    )
  }
  const now = new Date()
  const result = await rejectPaymentRequestInTx(paymentRequestId, adminNote, now)
  if (result.rejected) {
    await sendStatusEmailIfNotSent(paymentRequestId, 'rejected')
  }
  return { status: result.finalStatus, rejected: result.rejected }
}

/* -------------------------------------------------------------------------- */
/* Admin: subscription management                                             */
/* -------------------------------------------------------------------------- */

function subscriptionToAdminRow(
  s: {
    id: string
    userId: string
    plan: string
    status: string
    startsAt: Date
    expiresAt: Date
    createdAt: Date
    updatedAt: Date
    user: { email: string | null; displayName: string } | null
  },
  now: Date,
): AdminSubscriptionRow {
  const dto = deriveSubscriptionDto(
    { plan: s.plan, status: s.status, expiresAt: s.expiresAt },
    now,
  )
  return {
    id: s.id,
    userId: s.userId,
    userEmail: s.user?.email ?? null,
    userDisplayName: s.user?.displayName ?? '',
    plan: s.plan,
    status: dto.status ?? 'expired',
    isActive: dto.isActive,
    startsAt: s.startsAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }
}

/**
 * Admin: list all subscriptions, active first. Read-only — does NOT mutate
 * `status` rows on read (the FE relies on `deriveSubscriptionDto` reconciling
 * "active row past expiry" → `expired` for display only).
 */
export async function listAdminSubscriptions(
  opts?: { limit?: number },
): Promise<AdminSubscriptionListDto> {
  ensureDatabase()
  const limit = Math.max(1, Math.min(500, opts?.limit ?? 100))
  const now = new Date()
  const rows = await prisma.subscription.findMany({
    take: limit,
    orderBy: [{ status: 'asc' }, { expiresAt: 'desc' }],
    select: {
      id: true,
      userId: true,
      plan: true,
      status: true,
      startsAt: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { email: true, displayName: true } },
    },
  })
  return {
    subscriptions: rows.map((r) => subscriptionToAdminRow(r, now)),
  }
}

/**
 * Admin: cancel/deactivate an active Pro subscription. Idempotent:
 *   - Active → inactive (status='inactive', expiresAt=now): full effect, email sent.
 *   - Already inactive/expired: no-op, no email, returns the existing snapshot.
 *
 * The single-flight `updateMany` filter (`status='active' AND expiresAt>now`)
 * is what gives us idempotency without an extra schema-level claim column —
 * concurrent / repeated cancels collapse to a single "active → inactive"
 * transition, so the email also fires at most once per actual deactivation.
 *
 * Does NOT delete `Subscription` rows or `PaymentRequest` history. Does NOT
 * implement refunds or roll back any payment-side state — the cancellation
 * only revokes future access by setting `expiresAt = now`.
 */
export async function cancelAdminSubscription(
  subscriptionId: string,
): Promise<{ subscription: AdminSubscriptionRow; cancelledNow: boolean }> {
  ensureDatabase()
  if (typeof subscriptionId !== 'string' || subscriptionId.length === 0) {
    throw new BillingHttpError(400, 'BAD_REQUEST', 'subscriptionId is required')
  }
  const now = new Date()

  // Single-flight: only an active+future-expiry row gets transitioned. Already
  // inactive / past-expiry rows return count=0 → idempotent no-op below.
  const updated = await prisma.subscription.updateMany({
    where: { id: subscriptionId, status: 'active', expiresAt: { gt: now } },
    data: { status: 'inactive', expiresAt: now },
  })
  const cancelledNow = updated.count > 0

  const row = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      id: true,
      userId: true,
      plan: true,
      status: true,
      startsAt: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { email: true, displayName: true } },
    },
  })
  if (!row) {
    throw new BillingHttpError(404, 'NOT_FOUND', 'Subscription not found')
  }
  if (cancelledNow) {
    // Best-effort admin notification — failures are swallowed by the mailer
    // so the cancellation is never rolled back by an SMTP outage.
    void sendSubscriptionCancelledNotification({
      subscription: {
        id: row.id,
        plan: row.plan,
        previousStatus: 'active',
        newStatus: 'inactive',
        expiresAt: row.expiresAt,
        startsAt: row.startsAt,
      },
      user: {
        id: row.userId,
        email: row.user?.email ?? null,
        displayName: row.user?.displayName ?? null,
      },
    })
  }
  return {
    subscription: subscriptionToAdminRow(row, now),
    cancelledNow,
  }
}
