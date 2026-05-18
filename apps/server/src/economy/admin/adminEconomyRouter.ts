import type { Express, Request, Response } from 'express'
import { isSessionAdminFromCookie } from '../../auth/session/isAdminRequest'
import { resolvePrismaUserIdFromSession } from '../../auth/resolvePrismaUserFromSession'
import { readSessionFromCookie } from '../../auth/session/sessionJwt'
import { createIpRateLimitMiddleware } from '../../utils/rateLimitMiddleware'
import {
  AdminEconomyError,
  adminGrant,
  adminRevoke,
  getUserEconomyHistory,
} from './adminEconomyService'

const adminEconomyRateLimit = createIpRateLimitMiddleware({
  label: 'http:admin:economy',
  windowMs: 60_000,
  limit: 60,
}).middleware

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  if (!(await isSessionAdminFromCookie(req.headers.cookie))) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin only' } })
    return false
  }
  return true
}

async function resolveActorUserId(req: Request): Promise<string | null> {
  const session = readSessionFromCookie(req.headers.cookie)
  return session ? await resolvePrismaUserIdFromSession(session) : null
}

function sendError(res: Response, err: unknown): void {
  if (err instanceof AdminEconomyError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } })
    return
  }
  const e = err as Error
  console.error('[admin][economy]', e)
  res.status(500).json({ error: { code: 'INTERNAL', message: e.message || 'Error' } })
}

export function mountAdminEconomyRoutes(app: Express): void {
  const base = '/api/admin/economy'

  app.post(`${base}/users/:userId/grant`, adminEconomyRateLimit, (req, res) => {
    void (async () => {
      try {
        if (!(await requireAdmin(req, res))) return
        const actorUserId = await resolveActorUserId(req)
        if (!actorUserId) {
          res.status(403).json({ error: { code: 'FORBIDDEN', message: 'No actor user' } })
          return
        }
        const userId = String(req.params.userId ?? '').trim()
        if (!userId) {
          res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'userId is required' } })
          return
        }
        const body = (req.body ?? {}) as {
          coinAmount?: unknown
          xpAmount?: unknown
          reason?: unknown
          idempotencyKey?: unknown
        }
        const result = await adminGrant(actorUserId, {
          userId,
          coinAmount: typeof body.coinAmount === 'number' ? body.coinAmount : 0,
          xpAmount: typeof body.xpAmount === 'number' ? body.xpAmount : 0,
          reason: typeof body.reason === 'string' ? body.reason : null,
          idempotencyKey:
            typeof body.idempotencyKey === 'string' && body.idempotencyKey.length > 0
              ? body.idempotencyKey
              : null,
        })
        res.json(result)
      } catch (err) {
        sendError(res, err)
      }
    })()
  })

  app.post(`${base}/users/:userId/revoke`, adminEconomyRateLimit, (req, res) => {
    void (async () => {
      try {
        if (!(await requireAdmin(req, res))) return
        const actorUserId = await resolveActorUserId(req)
        if (!actorUserId) {
          res.status(403).json({ error: { code: 'FORBIDDEN', message: 'No actor user' } })
          return
        }
        const userId = String(req.params.userId ?? '').trim()
        if (!userId) {
          res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'userId is required' } })
          return
        }
        const body = (req.body ?? {}) as {
          coinAmount?: unknown
          xpAmount?: unknown
          reason?: unknown
          idempotencyKey?: unknown
        }
        const result = await adminRevoke(actorUserId, {
          userId,
          coinAmount: typeof body.coinAmount === 'number' ? body.coinAmount : 0,
          xpAmount: typeof body.xpAmount === 'number' ? body.xpAmount : 0,
          reason: typeof body.reason === 'string' ? body.reason : null,
          idempotencyKey:
            typeof body.idempotencyKey === 'string' && body.idempotencyKey.length > 0
              ? body.idempotencyKey
              : null,
        })
        res.json(result)
      } catch (err) {
        sendError(res, err)
      }
    })()
  })

  app.get(`${base}/users/:userId/history`, (req, res) => {
    void (async () => {
      try {
        if (!(await requireAdmin(req, res))) return
        const userId = String(req.params.userId ?? '').trim()
        if (!userId) {
          res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'userId is required' } })
          return
        }
        const limitRaw = Number(req.query.limit)
        const limit = Number.isFinite(limitRaw) ? limitRaw : 50
        const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null
        const out = await getUserEconomyHistory(userId, { limit, cursor })
        res.json(out)
      } catch (err) {
        sendError(res, err)
      }
    })()
  })
}
