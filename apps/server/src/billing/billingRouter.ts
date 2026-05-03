import type { Express, Request, Response } from 'express'
import { resolvePrismaUserIdFromSession } from '../auth/resolvePrismaUserFromSession'
import { readSessionFromCookie } from '../auth/session/sessionJwt'
import {
  createOrReusePaymentRequest,
  getBillingConfigDto,
  getOwnedPaymentRequestSnapshot,
  getSubscriptionDtoForUser,
  ingestStatementWebhook,
  markPaymentRequestAsPaid,
  setUserBillingEmail,
} from './billingService'
import { BillingHttpError } from './httpError'

/**
 * HTTP layer for the StreamAssist Pro Jar billing module.
 *
 * Routes:
 *   GET  /api/billing/config                       — auth; current price/duration/window snapshot
 *   POST /api/billing/jar/create-payment-request  — auth; create-or-reuse intent
 *   POST /api/billing/jar/mark-paid               — auth; idempotent "I paid"
 *   GET  /api/billing/jar/payment-request/:id     — auth; owner-only status poll
 *   GET  /api/billing/subscription/me             — auth; subscription snapshot
 *   POST /api/billing/billing-email                — auth; set/clear billing notification email
 *   GET  /api/billing/mono-personal/webhook       — public; monobank verification ping
 *   POST /api/billing/mono-personal/webhook       — public; monobank StatementItem
 *
 * Activation safety: the webhook handler always returns 200 quickly. Activation
 * is gated entirely by the matcher (`tryAutoMatchTransaction`) which re-reads
 * authoritative state from DB inside a Serializable transaction, so untrusted
 * webhook fields cannot tilt activation outcomes.
 *
 * Admin routes (`/api/admin/billing/*`) live in `billingAdminRouter.ts`.
 */
export function mountBillingRoutes(app: Express): void {
  const base = '/api/billing'

  async function resolveUserIdOr401(req: Request, res: Response): Promise<string | null> {
    const session = readSessionFromCookie(req.headers.cookie)
    if (!session) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in' } })
      return null
    }
    const id = await resolvePrismaUserIdFromSession(session)
    if (!id) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No database user' } })
      return null
    }
    return id
  }

  function sendError(res: Response, err: unknown): void {
    if (err instanceof BillingHttpError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } })
      return
    }
    const e = err as Error
    console.error('[billing]', e)
    res.status(500).json({ error: { code: 'INTERNAL', message: e.message || 'Error' } })
  }

  // Authoritative billing config snapshot for the FE pricing card. Auth-gated
  // to match the rest of `/api/billing/*` (the `/app/billing` route is also
  // auth-gated, so unauthenticated callers cannot reach the page anyway).
  app.get(`${base}/config`, (req, res) => {
    void (async () => {
      try {
        const userId = await resolveUserIdOr401(req, res)
        if (userId == null) return
        res.json(getBillingConfigDto())
      } catch (err) {
        sendError(res, err)
      }
    })()
  })

  app.post(`${base}/jar/create-payment-request`, (req, res) => {
    void (async () => {
      try {
        const userId = await resolveUserIdOr401(req, res)
        if (userId == null) return
        const out = await createOrReusePaymentRequest(userId)
        res.json(out)
      } catch (err) {
        sendError(res, err)
      }
    })()
  })

  app.post(`${base}/jar/mark-paid`, (req, res) => {
    void (async () => {
      try {
        const userId = await resolveUserIdOr401(req, res)
        if (userId == null) return
        const body = (req.body ?? {}) as { paymentRequestId?: unknown }
        const paymentRequestId =
          typeof body.paymentRequestId === 'string' ? body.paymentRequestId : ''
        if (paymentRequestId.length === 0) {
          res
            .status(400)
            .json({ error: { code: 'BAD_REQUEST', message: 'paymentRequestId is required' } })
          return
        }
        const out = await markPaymentRequestAsPaid(userId, paymentRequestId)
        res.json(out)
      } catch (err) {
        sendError(res, err)
      }
    })()
  })

  // Owner-only request snapshot. Used by the FE modal to poll status so it can
  // react to admin reject / needs_review / expired immediately, without waiting
  // on a subscription `isActive` flip (which never happens for those statuses).
  app.get(`${base}/jar/payment-request/:id`, (req, res) => {
    void (async () => {
      try {
        const userId = await resolveUserIdOr401(req, res)
        if (userId == null) return
        const id = typeof req.params.id === 'string' ? req.params.id : ''
        if (id.length === 0) {
          res
            .status(400)
            .json({ error: { code: 'BAD_REQUEST', message: 'id is required' } })
          return
        }
        const out = await getOwnedPaymentRequestSnapshot(userId, id)
        res.json(out)
      } catch (err) {
        sendError(res, err)
      }
    })()
  })

  // Set/clear the billing notification email. Body: `{ "email": "..." }` or
  // `{ "email": "" }` to clear. Returns the same shape as `subscription/me`
  // so the FE can replace its singleton snapshot in one round-trip.
  app.post(`${base}/billing-email`, (req, res) => {
    void (async () => {
      try {
        const userId = await resolveUserIdOr401(req, res)
        if (userId == null) return
        const body = (req.body ?? {}) as { email?: unknown }
        const email = typeof body.email === 'string' ? body.email : ''
        const out = await setUserBillingEmail(userId, email)
        res.json(out)
      } catch (err) {
        sendError(res, err)
      }
    })()
  })

  app.get(`${base}/subscription/me`, (req, res) => {
    void (async () => {
      try {
        const userId = await resolveUserIdOr401(req, res)
        if (userId == null) return
        const out = await getSubscriptionDtoForUser(userId)
        res.json(out)
      } catch (err) {
        sendError(res, err)
      }
    })()
  })

  // Public verification endpoint: monobank Personal API webhook setup expects
  // a fast 200 to confirm the URL belongs to us. Intentionally unauthenticated
  // — Monobank's registration probe is a bare GET.
  app.get(`${base}/mono-personal/webhook`, (_req, res) => {
    res.status(200).json({ ok: true })
  })

  // Public statement webhook. ALWAYS return 200 quickly so monobank does not
  // hammer us — activation safety lives in the service layer.
  //
  // Defense-in-depth: when MONO_WEBHOOK_SECRET is configured, require a matching
  // `X-Mono-Secret` header (preferred) OR `?secret=<value>` query (fallback:
  // Mono's Personal API registers a single URL, so secret-in-URL is the
  // practical deployment path). Without this, an attacker who learned the
  // private MONO_ACCOUNT_ID could forge a StatementItem with the right amount
  // against a pending `PaymentRequest` and auto-activate Pro — the matcher's
  // account-id gate alone is not sufficient once the id leaks.
  //
  // Responses are always 200 (even on secret mismatch) so Mono does not
  // retry-storm when the secret rolls or the attacker probes.
  app.post(`${base}/mono-personal/webhook`, (req, res) => {
    // Reply first so monobank gets a fast 200 even if our matcher is slow.
    res.status(200).json({ ok: true })
    void (async () => {
      try {
        if (!verifyMonoWebhookSecret(req)) {
          return
        }
        await ingestStatementWebhook(req.body)
      } catch (err) {
        console.error('[billing] mono-personal webhook handler failed', err)
      }
    })()
  })
}

/**
 * Constant-time compare helper (prevents timing leaks on secret equality).
 * Falls back to a strict `===` check when inputs have different lengths.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

let warnedMissingMonoWebhookSecret = false

function verifyMonoWebhookSecret(req: Request): boolean {
  const expected = (process.env.MONO_WEBHOOK_SECRET ?? '').trim()
  if (expected.length === 0) {
    // Dev / not-yet-configured. Log once in production so the operator notices.
    if (process.env.NODE_ENV === 'production' && !warnedMissingMonoWebhookSecret) {
      warnedMissingMonoWebhookSecret = true
      console.warn(
        '[billing] MONO_WEBHOOK_SECRET is not set — webhook is unauthenticated in production. ' +
          'Configure MONO_WEBHOOK_SECRET and re-register the webhook URL with `?secret=<value>` or send `X-Mono-Secret`.',
      )
    }
    return true
  }
  const headerRaw = req.headers['x-mono-secret']
  const header =
    typeof headerRaw === 'string'
      ? headerRaw
      : Array.isArray(headerRaw)
        ? (headerRaw[0] ?? '')
        : ''
  if (header.length > 0 && constantTimeEqual(header, expected)) {
    return true
  }
  const query = typeof req.query.secret === 'string' ? req.query.secret : ''
  if (query.length > 0 && constantTimeEqual(query, expected)) {
    return true
  }
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[billing] mono-personal webhook secret mismatch — ignoring payload')
  }
  return false
}
