import type { Express, Request, Response } from 'express'
import { resolvePrismaUserIdFromSession } from '../auth/resolvePrismaUserFromSession'
import { readSessionFromCookie } from '../auth/session/sessionJwt'
import { createRateLimiter, type RateLimiter } from '../utils/rateLimit'
import { shouldBypassCoinHubMutations } from './coinHubAdminGate'
import { claimPending, getCoinHubSnapshot, openCase, spin } from './coinHubService'
import { CoinHubHttpError } from './httpError'

/**
 * Per-user HTTP rate limits on CoinHub mutations. Service-layer cooldowns
 * (daily spin, per-case cooldown) already reject most abuse, but spammy
 * POSTs still pay DB + cooldown-check cost per request. These thin HTTP
 * limits catch floods before they touch Prisma.
 */
const coinHubClaimLimiter: RateLimiter = createRateLimiter({
  label: 'coinhub:claim',
  windowMs: 60_000,
  limit: 20,
})
const coinHubSpinLimiter: RateLimiter = createRateLimiter({
  label: 'coinhub:spin',
  windowMs: 60_000,
  limit: 10,
})
const coinHubCaseLimiter: RateLimiter = createRateLimiter({
  label: 'coinhub:case-open',
  windowMs: 60_000,
  limit: 15,
})

function denyRateLimited(res: Response, retryAfterSec: number): void {
  res.setHeader('Retry-After', String(retryAfterSec))
  res
    .status(429)
    .json({ error: { code: 'RATE_LIMITED', message: 'Too many requests', retryAfterSec } })
}

/** HTTP layer for Coin Hub (router role; the repo server is Express, not NestJS). */
export function mountCoinHubRoutes(app: Express): void {
  const base = '/api/coinhub'

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
    if (err instanceof CoinHubHttpError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } })
      return
    }
    const e = err as Error
    console.error('[coinhub]', e)
    res.status(500).json({ error: { code: 'INTERNAL', message: e.message || 'Error' } })
  }

  app.get(base, (req, res) => {
    void (async () => {
      try {
        const userId = await resolveUserIdOr401(req, res)
        if (userId == null) return
        const out = await getCoinHubSnapshot(userId)
        res.json(out)
      } catch (err) {
        sendError(res, err)
      }
    })()
  })

  app.post(`${base}/claim`, (req, res) => {
    void (async () => {
      try {
        const userId = await resolveUserIdOr401(req, res)
        if (userId == null) return
        const rl = coinHubClaimLimiter.tryConsume(`user:${userId}`)
        if (!rl.allowed) {
          denyRateLimited(res, rl.retryAfterSec)
          return
        }
        const out = await claimPending(userId)
        res.json(out)
      } catch (err) {
        sendError(res, err)
      }
    })()
  })

  app.post(`${base}/spin`, (req, res) => {
    void (async () => {
      try {
        const userId = await resolveUserIdOr401(req, res)
        if (userId == null) return
        const rl = coinHubSpinLimiter.tryConsume(`user:${userId}`)
        if (!rl.allowed) {
          denyRateLimited(res, rl.retryAfterSec)
          return
        }
        const adminBypass = await shouldBypassCoinHubMutations()
        const out = await spin(userId, new Date(), { adminBypass })
        res.json(out)
      } catch (err) {
        sendError(res, err)
      }
    })()
  })

  app.post(`${base}/case/open`, (req, res) => {
    void (async () => {
      try {
        const userId = await resolveUserIdOr401(req, res)
        if (userId == null) return
        const rl = coinHubCaseLimiter.tryConsume(`user:${userId}`)
        if (!rl.allowed) {
          denyRateLimited(res, rl.retryAfterSec)
          return
        }
        const body = req.body as { caseId?: unknown }
        const caseId = typeof body.caseId === 'string' ? body.caseId : ''
        if (!caseId) {
          res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'caseId is required' } })
          return
        }
        const adminBypass = await shouldBypassCoinHubMutations()
        const out = await openCase(userId, caseId, new Date(), { adminBypass })
        res.json(out)
      } catch (err) {
        sendError(res, err)
      }
    })()
  })
}
