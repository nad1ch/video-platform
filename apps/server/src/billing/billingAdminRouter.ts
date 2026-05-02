import type { Express, Request, Response } from 'express'
import { isSessionAdminFromCookie } from '../auth/session/isAdminRequest'
import {
  adminApprovePaymentRequest,
  adminRejectPaymentRequest,
  cancelAdminSubscription,
  forceAdminPollAndMatch,
  listAdminPaymentRequests,
  listAdminSubscriptions,
} from './billingService'
import { BillingHttpError } from './httpError'

/**
 * Admin/operator endpoints for the Jar billing module. Gated by the same
 * `isSessionAdminFromCookie` allowlist as `/api/admin/*` so we don't mint a
 * second authority ladder. (Future: extend to STREAMER role with their own
 * scoped views — out of scope for this PR.)
 */
export function mountBillingAdminRoutes(app: Express): void {
  const base = '/api/admin/billing'

  async function requireAdmin(req: Request, res: Response): Promise<boolean> {
    if (!(await isSessionAdminFromCookie(req.headers.cookie))) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin only' } })
      return false
    }
    return true
  }

  function sendError(res: Response, err: unknown): void {
    if (err instanceof BillingHttpError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } })
      return
    }
    const e = err as Error
    console.error('[billing][admin]', e)
    res.status(500).json({ error: { code: 'INTERNAL', message: e.message || 'Error' } })
  }

  function readAdminNote(req: Request): string | null {
    const body = (req.body ?? {}) as { adminNote?: unknown }
    if (typeof body.adminNote !== 'string') return null
    const trimmed = body.adminNote.trim()
    if (trimmed.length === 0) return null
    // Cap to avoid unbounded text in audit fields.
    return trimmed.slice(0, 500)
  }

  app.get(`${base}/payment-requests`, (req, res) => {
    void (async () => {
      try {
        if (!(await requireAdmin(req, res))) return
        const limitRaw = req.query.limit
        const limit = typeof limitRaw === 'string' ? Number.parseInt(limitRaw, 10) : undefined
        const out = await listAdminPaymentRequests({
          limit: Number.isFinite(limit) ? limit : undefined,
        })
        res.json(out)
      } catch (err) {
        sendError(res, err)
      }
    })()
  })

  app.post(`${base}/payment-requests/:id/approve`, (req, res) => {
    void (async () => {
      try {
        if (!(await requireAdmin(req, res))) return
        const id = typeof req.params.id === 'string' ? req.params.id : ''
        if (id.length === 0) {
          res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'id is required' } })
          return
        }
        const out = await adminApprovePaymentRequest(id, readAdminNote(req))
        res.json(out)
      } catch (err) {
        sendError(res, err)
      }
    })()
  })

  app.post(`${base}/payment-requests/:id/reject`, (req, res) => {
    void (async () => {
      try {
        if (!(await requireAdmin(req, res))) return
        const id = typeof req.params.id === 'string' ? req.params.id : ''
        if (id.length === 0) {
          res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'id is required' } })
          return
        }
        const out = await adminRejectPaymentRequest(id, readAdminNote(req))
        res.json(out)
      } catch (err) {
        sendError(res, err)
      }
    })()
  })

  // Admin: list every Subscription (active first). Read-only — never mutates.
  app.get(`${base}/subscriptions`, (req, res) => {
    void (async () => {
      try {
        if (!(await requireAdmin(req, res))) return
        const limitRaw = req.query.limit
        const limit = typeof limitRaw === 'string' ? Number.parseInt(limitRaw, 10) : undefined
        const out = await listAdminSubscriptions({
          limit: Number.isFinite(limit) ? limit : undefined,
        })
        res.json(out)
      } catch (err) {
        sendError(res, err)
      }
    })()
  })

  // Admin: force re-poll monobank statement now. Bypasses the in-process
  // 60s cool-down for ONE call (the cool-down for subsequent automatic calls
  // is preserved). Useful for unblocking a `checking` request stuck behind
  // the rate limiter or to verify configuration after changing
  // MONO_ACCOUNT_ID. Matching logic is unchanged — same pipeline as the
  // automatic path.
  app.post(`${base}/poll-mono`, (req, res) => {
    void (async () => {
      try {
        if (!(await requireAdmin(req, res))) return
        const out = await forceAdminPollAndMatch()
        res.json(out)
      } catch (err) {
        sendError(res, err)
      }
    })()
  })

  // Admin: cancel an active Pro subscription. Idempotent — repeated calls
  // collapse to no-ops at the service layer (`updateMany` single-flight).
  app.post(`${base}/subscriptions/:id/cancel`, (req, res) => {
    void (async () => {
      try {
        if (!(await requireAdmin(req, res))) return
        const id = typeof req.params.id === 'string' ? req.params.id : ''
        if (id.length === 0) {
          res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'id is required' } })
          return
        }
        const out = await cancelAdminSubscription(id)
        res.json(out)
      } catch (err) {
        sendError(res, err)
      }
    })()
  })
}
