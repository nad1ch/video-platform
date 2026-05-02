import nodemailer, { type Transporter } from 'nodemailer'

/**
 * Shared low-level SMTP transport — single source of truth for the StreamAssist
 * mailer. Both the auth flow (`auth/email/emailVerificationMailer.ts`) and the
 * billing notification flow (`billing/billingMailer.ts`) call into this module.
 *
 * Two behavioral knobs let callers preserve their distinct error policies
 * without forking the SMTP plumbing:
 *
 *   - `dispatchEmail()` is the raw send. It THROWS on any SMTP failure. Auth
 *     wraps this so registration fails-closed when email cannot be delivered.
 *
 *   - `sendEmailIfConfigured()` is the high-level "do nothing if SMTP is not
 *     configured" wrapper. Auth keeps its `throwInProduction: true` contract
 *     (registration must fail in prod when SMTP is missing). Billing uses
 *     `throwInProduction: false` and a try/catch so billing/subscription
 *     mutations are never rolled back by an SMTP outage.
 *
 * Env keys consumed (unchanged from the previous separate mailers):
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, EMAIL_FROM
 *
 * `EMAIL_FROM` is the canonical "From:" header. Callers may pass an override
 * (`fromOverride`) for domain-specific addresses (e.g. billing → `billing@…`),
 * resolved by `getEmailFromOrThrow()` below.
 */

function envValue(name: string): string {
  const v = process.env[name]
  return typeof v === 'string' ? v.trim() : ''
}

export function isSmtpConfigured(): boolean {
  return envValue('SMTP_HOST').length > 0 && envValue('SMTP_PORT').length > 0
}

function smtpSecure(): boolean {
  const v = envValue('SMTP_SECURE').toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

/**
 * Resolve the "From:" header.
 *
 * Priority:
 *   1. explicit `fromOverride` (when caller wants a domain-specific address;
 *      e.g. billing passes `process.env.SMTP_FROM` so ops emails can use a
 *      separate sender);
 *   2. `EMAIL_FROM` (existing canonical key, used by auth);
 *   3. Localhost no-reply (dev only) — throws in production when
 *      `requireInProduction: true` (auth contract).
 */
export function getEmailFromOrThrow(opts?: {
  fromOverride?: string | null
  requireInProduction?: boolean
}): string {
  const override = (opts?.fromOverride ?? '').trim()
  if (override.length > 0) return override
  const shared = envValue('EMAIL_FROM')
  if (shared.length > 0) return shared
  if (opts?.requireInProduction && process.env.NODE_ENV === 'production') {
    throw new Error('EMAIL_FROM must be set in production.')
  }
  return 'StreamAssist <no-reply@localhost>'
}

export type DispatchEmailInput = {
  to: string
  subject: string
  text: string
  html: string
  /** Resolved "From:" header. Use `getEmailFromOrThrow()` to derive. */
  from: string
}

/**
 * Raw SMTP send. THROWS on failure (network/SMTP error). Callers that need a
 * fail-open policy must wrap in try/catch. Re-creating the transporter per
 * call mirrors the previous auth mailer behavior — fine for our low volume,
 * avoids stale connection issues across long idle periods.
 */
export async function dispatchEmail(input: DispatchEmailInput): Promise<void> {
  const user = envValue('SMTP_USER')
  const pass = envValue('SMTP_PASS')
  const transporter: Transporter = nodemailer.createTransport({
    host: envValue('SMTP_HOST'),
    port: Number(envValue('SMTP_PORT')),
    secure: smtpSecure(),
    ...(user.length > 0 || pass.length > 0 ? { auth: { user, pass } } : {}),
  })
  await transporter.sendMail({
    from: input.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  })
}

export type SendEmailInput = Omit<DispatchEmailInput, 'from'> & {
  /** Optional override; falls back to EMAIL_FROM. */
  fromOverride?: string | null
}

export type SendEmailIfConfiguredOptions = {
  /** When true, throw in production if SMTP is not configured (auth contract). */
  throwInProduction: boolean
  /** Log tag for the dev "skipped" info line, e.g. `[auth][email]`. */
  devLogTag: string
}

/**
 * High-level wrapper that handles the "SMTP not configured" branch consistently.
 *
 * Behavior:
 *   - If SMTP is not configured AND we're in production AND `throwInProduction`
 *     is `true` → throws (auth fail-closed).
 *   - If SMTP is not configured otherwise → logs a one-line info and returns
 *     `false` (caller observes "not sent" without an exception).
 *   - If configured → calls `dispatchEmail`. THIS THROWS on SMTP failure;
 *     callers that want fail-open (billing) must wrap in their own try/catch.
 *
 * Returns `true` iff the email was actually accepted by the SMTP server.
 */
export async function sendEmailIfConfigured(
  input: SendEmailInput,
  opts: SendEmailIfConfiguredOptions,
): Promise<boolean> {
  if (!isSmtpConfigured()) {
    if (opts.throwInProduction && process.env.NODE_ENV === 'production') {
      throw new Error(
        'SMTP_HOST and SMTP_PORT must be set in production to send email.',
      )
    }
    console.info(`${opts.devLogTag} SMTP not configured; email was not sent.`, {
      subject: input.subject,
    })
    return false
  }
  const from = getEmailFromOrThrow({
    fromOverride: input.fromOverride ?? null,
    requireInProduction: opts.throwInProduction,
  })
  await dispatchEmail({
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    from,
  })
  return true
}
