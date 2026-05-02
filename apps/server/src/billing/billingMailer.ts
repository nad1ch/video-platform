import { sendEmailIfConfigured } from '../email/transport'

/**
 * Best-effort billing admin-notification mailer.
 *
 * One email is sent to `BILLING_NOTIFICATION_EMAIL` for every important
 * StreamAssist Pro billing transition (auto_matched / needs_review / approved /
 * rejected). Idempotency is enforced by the caller (`billingService.sendStatusEmailIfNotSent`)
 * via single-flight `*EmailSentAt` claims on the PaymentRequest row.
 *
 * Failures are logged and SWALLOWED — billing/subscription mutations have
 * already happened in their own DB transaction by the time this is called, so
 * an SMTP outage must NEVER crash or rollback the payment flow. This is the
 * key behavioral difference vs the auth mailer (which fails closed in prod):
 * auth registration must fail when email cannot send; billing activation must
 * NOT.
 *
 * SMTP transport itself lives in `apps/server/src/email/transport.ts` and is
 * shared with the auth flow — same env keys, same nodemailer setup, no second
 * email subsystem.
 */

const DEV_LOG_TAG = '[billing][mail]'

function envValue(name: string): string {
  const v = process.env[name]
  return typeof v === 'string' ? v.trim() : ''
}

function billingNotificationRecipient(): string | null {
  const v = envValue('BILLING_NOTIFICATION_EMAIL')
  return v.length > 0 ? v : null
}

function adminReviewUrl(): string | null {
  const v = envValue('ADMIN_BILLING_REVIEW_URL')
  return v.length > 0 ? v : null
}

function billingFromOverride(): string | null {
  const v = envValue('SMTP_FROM')
  return v.length > 0 ? v : null
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtUah(amountKopecks: number): string {
  return (amountKopecks / 100).toFixed(2)
}

function fmtIso(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toISOString()
}

function fmtVal(v: string | null | undefined): string {
  return v && v.length > 0 ? v : '—'
}

export type BillingAdminEventType =
  | 'auto_matched'
  | 'needs_review'
  | 'approved'
  | 'rejected'

/**
 * Full snapshot the admin email needs. Caller is responsible for assembling
 * this from a single DB read so retries never produce inconsistent context.
 */
export type BillingAdminNotificationContext = {
  event: BillingAdminEventType
  paymentRequest: {
    id: string
    status: string
    amountKopecks: number
    currency: string
    createdAt: Date
    expiresAt: Date
    markedPaidAt: Date | null
    checkedAt: Date | null
    autoMatchedAt: Date | null
    approvedAt: Date | null
    rejectedAt: Date | null
    adminNote: string | null
  }
  user: {
    id: string
    email: string | null
    displayName: string | null
    twitchHandle: string | null
  }
  transaction: {
    id: string
    monoTransactionId: string
    amountKopecks: number
    currency: string
    operationTime: Date
  } | null
  subscription: {
    plan: string
    expiresAt: Date | null
    isActive: boolean
  } | null
}

const SUBJECTS: Record<BillingAdminEventType, string> = {
  auto_matched: 'StreamAssist: Pro activated automatically',
  needs_review: 'StreamAssist: payment needs review',
  approved: 'StreamAssist: Pro activated manually',
  rejected: 'StreamAssist: payment rejected',
}

const REASONS: Record<BillingAdminEventType, string> = {
  auto_matched: 'Payment was safely matched automatically.',
  needs_review: 'Payment could not be matched safely and requires manual review.',
  approved: 'Payment was manually approved by admin.',
  rejected: 'Payment was manually rejected by admin.',
}

function renderBody(ctx: BillingAdminNotificationContext): { text: string; html: string } {
  const reviewUrl = adminReviewUrl()
  const pr = ctx.paymentRequest
  const u = ctx.user
  const t = ctx.transaction
  const s = ctx.subscription

  const subscriptionExpiresLine =
    s && s.expiresAt && s.isActive
      ? fmtIso(s.expiresAt)
      : s && s.expiresAt
        ? `${fmtIso(s.expiresAt)} (inactive)`
        : '—'

  const lines: string[] = [
    'A StreamAssist billing event occurred.',
    '',
    `Event: ${ctx.event}`,
    `Status: ${pr.status}`,
    '',
    'User:',
    `- ID: ${fmtVal(u.id)}`,
    `- Email: ${fmtVal(u.email)}`,
    `- Name: ${fmtVal(u.displayName)}`,
    `- Twitch: ${fmtVal(u.twitchHandle)}`,
    '',
    'Payment:',
    `- Request ID: ${pr.id}`,
    `- Amount: ${fmtUah(pr.amountKopecks)} ${pr.currency}`,
    `- Created at: ${fmtIso(pr.createdAt)}`,
    `- Marked paid at: ${fmtIso(pr.markedPaidAt)}`,
    `- Checked at: ${fmtIso(pr.checkedAt)}`,
    `- Auto-matched at: ${fmtIso(pr.autoMatchedAt)}`,
    `- Approved at: ${fmtIso(pr.approvedAt)}`,
    `- Rejected at: ${fmtIso(pr.rejectedAt)}`,
    `- Expires at: ${fmtIso(pr.expiresAt)}`,
    pr.adminNote ? `- Admin note: ${pr.adminNote}` : '',
    '',
    'Transaction:',
    t
      ? `- Mono transaction ID: ${t.monoTransactionId}\n- Amount: ${fmtUah(t.amountKopecks)} ${t.currency}\n- Operation time: ${fmtIso(t.operationTime)}`
      : '- (none)',
    '',
    'Subscription:',
    `- Plan: ${s ? s.plan : '—'}`,
    `- Active until: ${subscriptionExpiresLine}`,
    '',
    `Context: ${REASONS[ctx.event]}`,
  ]
  if (reviewUrl) {
    lines.push('', `Review: ${reviewUrl}`)
  }
  const text = lines.filter((l) => l !== '').join('\n').replace(/\n\n\n+/g, '\n\n')

  const safe = (v: string): string => escapeHtml(v)
  const txnHtml = t
    ? `<li>Mono transaction ID: <code>${safe(t.monoTransactionId)}</code></li><li>Amount: <strong>${safe(fmtUah(t.amountKopecks))}</strong> ${safe(t.currency)}</li><li>Operation time: ${safe(fmtIso(t.operationTime))}</li>`
    : '<li>(none)</li>'
  const subUntilHtml =
    s && s.expiresAt && s.isActive
      ? safe(fmtIso(s.expiresAt))
      : s && s.expiresAt
        ? `${safe(fmtIso(s.expiresAt))} (inactive)`
        : '—'
  const html = [
    `<p><strong>A StreamAssist billing event occurred.</strong></p>`,
    `<p>Event: <strong>${safe(ctx.event)}</strong> · Status: <strong>${safe(pr.status)}</strong></p>`,
    `<h4>User</h4><ul>`,
    `<li>ID: <code>${safe(u.id)}</code></li>`,
    `<li>Email: ${safe(fmtVal(u.email))}</li>`,
    `<li>Name: ${safe(fmtVal(u.displayName))}</li>`,
    `<li>Twitch: ${safe(fmtVal(u.twitchHandle))}</li>`,
    `</ul>`,
    `<h4>Payment</h4><ul>`,
    `<li>Request ID: <code>${safe(pr.id)}</code></li>`,
    `<li>Amount: <strong>${safe(fmtUah(pr.amountKopecks))}</strong> ${safe(pr.currency)}</li>`,
    `<li>Created at: ${safe(fmtIso(pr.createdAt))}</li>`,
    `<li>Marked paid at: ${safe(fmtIso(pr.markedPaidAt))}</li>`,
    `<li>Checked at: ${safe(fmtIso(pr.checkedAt))}</li>`,
    `<li>Auto-matched at: ${safe(fmtIso(pr.autoMatchedAt))}</li>`,
    `<li>Approved at: ${safe(fmtIso(pr.approvedAt))}</li>`,
    `<li>Rejected at: ${safe(fmtIso(pr.rejectedAt))}</li>`,
    `<li>Expires at: ${safe(fmtIso(pr.expiresAt))}</li>`,
    pr.adminNote ? `<li>Admin note: <em>${safe(pr.adminNote)}</em></li>` : '',
    `</ul>`,
    `<h4>Transaction</h4><ul>${txnHtml}</ul>`,
    `<h4>Subscription</h4><ul>`,
    `<li>Plan: ${s ? safe(s.plan) : '—'}</li>`,
    `<li>Active until: ${subUntilHtml}</li>`,
    `</ul>`,
    `<p><strong>Context:</strong> ${safe(REASONS[ctx.event])}</p>`,
    reviewUrl ? `<p>Review: <a href="${safe(reviewUrl)}">${safe(reviewUrl)}</a></p>` : '',
  ]
    .filter((l) => l !== '')
    .join('')

  return { text, html }
}

/**
 * Send a single admin notification for a billing event.
 *
 * Returns:
 *   - `true`  → SMTP accepted the message
 *   - `false` → not configured / not sent / SMTP failed (already logged)
 *
 * The caller has already single-flight-claimed the corresponding `*EmailSentAt`
 * timestamp on the PaymentRequest row, so a `false` here means the admin will
 * not be re-notified for this transition (intentional — re-sending requires
 * clearing the timestamp via admin tooling). Trade-off: avoids spam during
 * SMTP outages; ops must monitor the warn log to catch lost notifications.
 */
export async function sendBillingAdminNotification(
  ctx: BillingAdminNotificationContext,
): Promise<boolean> {
  const to = billingNotificationRecipient()
  if (!to) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(
        '[billing][mail] BILLING_NOTIFICATION_EMAIL not configured; skipping',
        ctx.event,
        ctx.paymentRequest.id,
      )
    }
    return false
  }
  const { text, html } = renderBody(ctx)
  try {
    return await sendEmailIfConfigured(
      {
        to,
        subject: SUBJECTS[ctx.event],
        text,
        html,
        fromOverride: billingFromOverride(),
      },
      { throwInProduction: false, devLogTag: DEV_LOG_TAG },
    )
  } catch (err) {
    // Auth-style throws (network/SMTP error) are caught here so billing flow
    // is never rolled back. Logged with subject + recipient so ops can re-send
    // manually by clearing `<event>EmailSentAt` on the PaymentRequest.
    console.warn(
      '[billing][mail] send failed',
      SUBJECTS[ctx.event],
      'to=',
      to,
      'err=',
      (err as Error).message,
    )
    return false
  }
}

/* -------------------------------------------------------------------------- */
/* User-facing payment notifications                                          */
/* -------------------------------------------------------------------------- */

/**
 * Context for the user-facing email sent on a billing event. Lean: only the
 * fields the UA copy actually uses. Caller must already have ensured the
 * recipient address is non-empty (Twitch logins without email simply skip
 * this branch — admin still gets notified).
 *
 * Idempotency: the user notification piggy-backs on the same single-flight
 * `*EmailSentAt` claim that gates the admin notification. So both fire
 * together exactly once per `(PaymentRequest, event)` pair — repeated
 * webhook deliveries / repeated admin approve/reject clicks cannot cause
 * duplicate user emails.
 */
/**
 * User-facing event union — superset of `BillingAdminEventType`. Adds two
 * subscription-lifecycle events that don't map to a PaymentRequest:
 *   - `subscription_cancelled` — admin clicked "Скасувати Pro".
 *   - `subscription_expired`   — natural end of the paid window.
 *
 * The admin notification uses the narrower `BillingAdminEventType` because
 * the admin-side cancellation has its own dedicated context+template (see
 * `sendSubscriptionCancelledNotification`); this union is user-side only.
 */
export type UserBillingEventType =
  | BillingAdminEventType
  | 'subscription_cancelled'
  | 'subscription_expired'

export type UserBillingNotificationContext = {
  event: UserBillingEventType
  to: string
  displayName: string
  amountKopecks: number
  currency: string
  /** Active subscription expiresAt for activation/expiry events; ignored otherwise. */
  subscriptionExpiresAt: Date | null
  /** Optional admin note shown in rejection / cancellation email bodies. */
  adminNote: string | null
}

const USER_SUBJECTS: Record<UserBillingEventType, string> = {
  auto_matched: 'StreamAssist Pro активовано',
  approved: 'StreamAssist Pro активовано адміністратором',
  needs_review: 'Перевіряємо ваш платіж за StreamAssist Pro',
  rejected: 'Платіж за StreamAssist Pro відхилено',
  subscription_cancelled: 'StreamAssist Pro скасовано',
  subscription_expired: 'StreamAssist Pro закінчився',
}

function fmtUahWithCcy(amountKopecks: number, currency: string): string {
  const ccy = currency === 'UAH' ? '₴' : currency
  // Drop trailing ".00" for whole-UAH amounts (e.g. "99 ₴" instead of "99.00 ₴")
  const decimal = (amountKopecks / 100).toFixed(2).replace(/\.00$/, '')
  return `${decimal} ${ccy}`
}

function fmtUserDate(d: Date | null): string {
  if (!d) return '—'
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
}

function renderUserBody(
  ctx: UserBillingNotificationContext,
): { text: string; html: string } {
  const safeName = escapeHtml(ctx.displayName)
  const amount = fmtUahWithCcy(ctx.amountKopecks, ctx.currency)
  const safeAmount = escapeHtml(amount)
  const expires = ctx.subscriptionExpiresAt
    ? fmtUserDate(ctx.subscriptionExpiresAt)
    : null
  const safeExpires = expires ? escapeHtml(expires) : null

  if (ctx.event === 'auto_matched') {
    const text = `Привіт, ${ctx.displayName}! Ми отримали ваш платіж на ${amount} і автоматично активували StreamAssist Pro.${
      expires ? ` Доступ діє до ${expires}.` : ''
    } Дякуємо за підтримку!`
    const html = `<p>Привіт, ${safeName}!</p><p>Ми отримали ваш платіж на <strong>${safeAmount}</strong> і автоматично активували StreamAssist Pro.</p>${
      safeExpires ? `<p>Доступ діє до <strong>${safeExpires}</strong>.</p>` : ''
    }<p>Дякуємо за підтримку.</p>`
    return { text, html }
  }
  if (ctx.event === 'approved') {
    const text = `Привіт, ${ctx.displayName}! Адміністратор підтвердив ваш платіж на ${amount}. StreamAssist Pro активовано${
      expires ? ` — доступ діє до ${expires}.` : '.'
    }`
    const html = `<p>Привіт, ${safeName}!</p><p>Адміністратор підтвердив ваш платіж на <strong>${safeAmount}</strong>. StreamAssist Pro активовано${
      safeExpires ? ` — доступ діє до <strong>${safeExpires}</strong>.` : '.'
    }</p>`
    return { text, html }
  }
  if (ctx.event === 'needs_review') {
    const text = `Привіт, ${ctx.displayName}! Ми отримали запит на оплату ${amount}. Платіж зараз на ручній перевірці у нашого адміністратора — це може зайняти трохи часу. Ми надішлемо лист, коли підтвердимо активацію.`
    const html = `<p>Привіт, ${safeName}!</p><p>Ми отримали запит на оплату <strong>${safeAmount}</strong>. Платіж зараз на ручній перевірці у нашого адміністратора — це може зайняти трохи часу.</p><p>Ми надішлемо окремий лист, коли підтвердимо активацію.</p>`
    return { text, html }
  }
  if (ctx.event === 'subscription_cancelled') {
    const noteText = ctx.adminNote ? ` Коментар адміністратора: ${ctx.adminNote}` : ''
    const noteHtml = ctx.adminNote
      ? `<p>Коментар адміністратора: <em>${escapeHtml(ctx.adminNote)}</em></p>`
      : ''
    const text = `Привіт, ${ctx.displayName}. Адміністратор скасував вашу підписку StreamAssist Pro — доступ до Pro більше не активний.${noteText} Якщо ви вважаєте, що сталася помилка — зверніться у підтримку.`
    const html = `<p>Привіт, ${safeName}.</p><p>Адміністратор скасував вашу підписку <strong>StreamAssist Pro</strong> — доступ до Pro більше не активний.</p>${noteHtml}<p>Якщо ви вважаєте, що сталася помилка — зверніться у підтримку.</p>`
    return { text, html }
  }
  if (ctx.event === 'subscription_expired') {
    const text = `Привіт, ${ctx.displayName}. Ваш період StreamAssist Pro закінчився${
      expires ? ` ${expires}` : ''
    }. Поновіть, щоб продовжити користуватися Pro: відкрийте розділ білінгу в застосунку.`
    const html = `<p>Привіт, ${safeName}.</p><p>Ваш період <strong>StreamAssist Pro</strong> закінчився${
      safeExpires ? ` <strong>${safeExpires}</strong>` : ''
    }.</p><p>Поновіть, щоб продовжити користуватися Pro — відкрийте розділ білінгу в застосунку.</p>`
    return { text, html }
  }
  // rejected (default fall-through for the original BillingAdminEventType set)
  const noteText = ctx.adminNote ? ` Коментар адміністратора: ${ctx.adminNote}` : ''
  const noteHtml = ctx.adminNote
    ? `<p>Коментар адміністратора: <em>${escapeHtml(ctx.adminNote)}</em></p>`
    : ''
  const text = `Привіт, ${ctx.displayName}. На жаль, запит на платіж ${amount} за StreamAssist Pro відхилено.${noteText} Якщо ви вважаєте, що сталася помилка — зверніться у підтримку.`
  const html = `<p>Привіт, ${safeName}.</p><p>На жаль, запит на платіж <strong>${safeAmount}</strong> за StreamAssist Pro відхилено.</p>${noteHtml}<p>Якщо ви вважаєте, що сталася помилка — зверніться у підтримку.</p>`
  return { text, html }
}

/**
 * Send the user-facing email for a billing event. Same fail-open contract as
 * the admin-side notification: SMTP failure is swallowed and logged — billing
 * state is never rolled back by an email outage.
 *
 * Returns:
 *   - `true`  → SMTP accepted the message
 *   - `false` → SMTP not configured / send failed (already logged)
 *
 * The caller must skip this entirely when the user has no email on record.
 */
export async function sendUserBillingNotification(
  ctx: UserBillingNotificationContext,
): Promise<boolean> {
  const { text, html } = renderUserBody(ctx)
  try {
    return await sendEmailIfConfigured(
      {
        to: ctx.to,
        subject: USER_SUBJECTS[ctx.event],
        text,
        html,
        // User-facing emails reuse the canonical EMAIL_FROM; SMTP_FROM stays
        // dedicated to admin/ops mail when both are configured.
        fromOverride: null,
      },
      { throwInProduction: false, devLogTag: DEV_LOG_TAG },
    )
  } catch (err) {
    console.warn(
      '[billing][mail] user send failed',
      USER_SUBJECTS[ctx.event],
      'to=',
      ctx.to,
      'err=',
      (err as Error).message,
    )
    return false
  }
}

/* -------------------------------------------------------------------------- */
/* Subscription-cancellation notification                                     */
/* -------------------------------------------------------------------------- */

/**
 * Context for a manual subscription cancellation. Distinct from the
 * payment-request notification context (no `paymentRequest` block, no
 * matching transaction) so the existing renderer is unchanged.
 *
 * Idempotency: the caller (`cancelAdminSubscription`) only invokes this on
 * the actual `active → inactive` transition, gated by a single-flight
 * `updateMany`. Repeat calls observe `count=0` and skip the email entirely,
 * so we never need a `cancelledEmailSentAt` column.
 */
export type SubscriptionCancelledNotificationContext = {
  subscription: {
    id: string
    plan: string
    previousStatus: 'active' | 'inactive' | 'expired'
    newStatus: 'active' | 'inactive' | 'expired'
    /** New `expiresAt` after the cancel — for "active until" display. */
    expiresAt: Date
    startsAt: Date
  }
  user: {
    id: string
    email: string | null
    displayName: string | null
  }
}

const SUBSCRIPTION_CANCELLED_SUBJECT = 'StreamAssist: Pro subscription cancelled manually'

function renderCancellationBody(
  ctx: SubscriptionCancelledNotificationContext,
): { text: string; html: string } {
  const reviewUrl = adminReviewUrl()
  const s = ctx.subscription
  const u = ctx.user
  const lines: string[] = [
    'A StreamAssist subscription was cancelled manually.',
    '',
    `Event: subscription_cancelled`,
    '',
    'User:',
    `- ID: ${fmtVal(u.id)}`,
    `- Email: ${fmtVal(u.email)}`,
    `- Name: ${fmtVal(u.displayName)}`,
    '',
    'Subscription:',
    `- ID: ${s.id}`,
    `- Plan: ${s.plan}`,
    `- Previous status: ${s.previousStatus}`,
    `- New status: ${s.newStatus}`,
    `- Starts at: ${fmtIso(s.startsAt)}`,
    `- Expires at (after cancel): ${fmtIso(s.expiresAt)}`,
    '',
    'Context: Pro access has been revoked by an admin via /app/admin/billing.',
  ]
  if (reviewUrl) {
    lines.push('', `Review: ${reviewUrl}`)
  }
  const text = lines.filter((l) => l !== '').join('\n').replace(/\n\n\n+/g, '\n\n')

  const safe = (v: string): string => escapeHtml(v)
  const html = [
    `<p><strong>A StreamAssist subscription was cancelled manually.</strong></p>`,
    `<p>Event: <strong>subscription_cancelled</strong></p>`,
    `<h4>User</h4><ul>`,
    `<li>ID: <code>${safe(u.id)}</code></li>`,
    `<li>Email: ${safe(fmtVal(u.email))}</li>`,
    `<li>Name: ${safe(fmtVal(u.displayName))}</li>`,
    `</ul>`,
    `<h4>Subscription</h4><ul>`,
    `<li>ID: <code>${safe(s.id)}</code></li>`,
    `<li>Plan: ${safe(s.plan)}</li>`,
    `<li>Previous status: ${safe(s.previousStatus)}</li>`,
    `<li>New status: ${safe(s.newStatus)}</li>`,
    `<li>Starts at: ${safe(fmtIso(s.startsAt))}</li>`,
    `<li>Expires at (after cancel): ${safe(fmtIso(s.expiresAt))}</li>`,
    `</ul>`,
    `<p><strong>Context:</strong> Pro access has been revoked by an admin via <code>/app/admin/billing</code>.</p>`,
    reviewUrl ? `<p>Review: <a href="${safe(reviewUrl)}">${safe(reviewUrl)}</a></p>` : '',
  ]
    .filter((l) => l !== '')
    .join('')
  return { text, html }
}

/**
 * Send the manual-cancellation notification. Same fail-open contract as
 * `sendBillingAdminNotification`: SMTP failure is swallowed and logged so
 * the cancellation itself is never rolled back. Reuses the same SMTP
 * transport (`sendEmailIfConfigured`), so this is NOT a second mailer.
 */
export async function sendSubscriptionCancelledNotification(
  ctx: SubscriptionCancelledNotificationContext,
): Promise<boolean> {
  const to = billingNotificationRecipient()
  if (!to) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(
        '[billing][mail] BILLING_NOTIFICATION_EMAIL not configured; skipping subscription_cancelled',
        ctx.subscription.id,
      )
    }
    return false
  }
  const { text, html } = renderCancellationBody(ctx)
  try {
    return await sendEmailIfConfigured(
      {
        to,
        subject: SUBSCRIPTION_CANCELLED_SUBJECT,
        text,
        html,
        fromOverride: billingFromOverride(),
      },
      { throwInProduction: false, devLogTag: DEV_LOG_TAG },
    )
  } catch (err) {
    console.warn(
      '[billing][mail] send failed',
      SUBSCRIPTION_CANCELLED_SUBJECT,
      'to=',
      to,
      'err=',
      (err as Error).message,
    )
    return false
  }
}

export const __testingOnly = {
  renderBody,
  renderCancellationBody,
}
