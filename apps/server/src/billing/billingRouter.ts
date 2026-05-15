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

  
  
  
  app.get(`${base}/mono-personal/webhook`, (_req, res) => {
    res.status(200).json({ ok: true })
  })

  
  // hammer us — activation safety lives in the service layer.
  
  
  
  
  
  
  
  
  
  
  
  app.post(`${base}/mono-personal/webhook`, (req, res) => {
    
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

/**
 * Verify the Monobank webhook secret.
 *
 * Accept-paths (in order): `?secret=…` query parameter, then `X-Mono-Secret`
 * header. Both are compared with `constantTimeEqual` against
 * `MONO_WEBHOOK_SECRET`.
 *
 * The Monobank Personal API does NOT document support for custom callback
 * headers (only the Acquiring/Corporate API does, via `X-Sign` ECDSA). The
 * intended authentication mechanism for `/personal/webhook` is the secrecy
 * of the registered `webHookUrl` itself — operators bake the secret into the
 * URL (query parameter is the convention) and the merchant verifies it on
 * callback. The header accept-path is retained as a defense-in-depth option
 * for setups that terminate Monobank traffic through a reverse proxy that
 * injects the header before reaching this server; it is NOT what real
 * Monobank Personal API callbacks send.
 *
 * Because the secret must travel in the URL, it would otherwise leak into
 * every log layer in the request path (Cloudflare, reverse proxies, our own
 * stdout). The in-process access log in `index.ts` redacts `?secret=…`
 * before logging (audit S2). Upstream log layers are an operations concern:
 * scrub the secret in Cloudflare/Nginx logs or rotate `MONO_WEBHOOK_SECRET`
 * on a schedule. See `docs/qa-mono-webhook.md` (TODO follow-up).
 *
 * Production semantics (fail-closed): when `MONO_WEBHOOK_SECRET` is unset or
 * empty in production, the webhook is REJECTED. Without the secret there is
 * no way to distinguish a real Monobank callback from a forged one, and a
 * forged StatementItem combined with a user-initiated `mark-paid` call could
 * cause the matcher to auto-activate Pro for an attacker. The matcher
 * re-reads authoritative state from DB inside a Serializable transaction,
 * but that is a defense-in-depth layer — it must not be the only layer.
 *
 * Dev semantics (fail-open with warning): when the secret is empty outside
 * production, the webhook is accepted so local development against a
 * monobank-personal sandbox / test fixtures works without configuration.
 * The boot-time warning ensures this is loud.
 */
function verifyMonoWebhookSecret(req: Request): boolean {
  const expected = (process.env.MONO_WEBHOOK_SECRET ?? '').trim()
  if (expected.length === 0) {
    if (process.env.NODE_ENV === 'production') {
      if (!warnedMissingMonoWebhookSecret) {
        warnedMissingMonoWebhookSecret = true
        console.error(
          '[billing] MONO_WEBHOOK_SECRET is not set — REJECTING all mono-personal webhook ' +
            'requests in production. Configure MONO_WEBHOOK_SECRET and re-register the webhook ' +
            'URL with `?secret=<value>` (Monobank Personal API does not deliver custom headers).',
        )
      }
      return false
    }
    return true
  }
  const query = typeof req.query.secret === 'string' ? req.query.secret : ''
  if (query.length > 0 && constantTimeEqual(query, expected)) {
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
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[billing] mono-personal webhook secret mismatch — ignoring payload')
  }
  return false
}
