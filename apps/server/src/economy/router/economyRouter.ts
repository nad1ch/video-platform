import type { Express, Request, Response } from 'express'
import { resolvePrismaUserIdFromSession } from '../../auth/resolvePrismaUserFromSession'
import { readSessionFromCookie } from '../../auth/session/sessionJwt'
import { createRateLimiter } from '../../utils/rateLimit'
import { grantDailyClaim } from '../claims/dailyClaim'
import {
  claimAllPendingTopLevel,
  claimPendingById,
} from '../claims/claimService'
import { getWalletSnapshot } from '../wallet/walletSnapshot'

/**
 * HTTP layer for the new Viewer Economy surfaces (wallet snapshot, claims,
 * daily grant). Mounted alongside (not replacing) the legacy `/api/coinhub`
 * routes — the existing CoinHub UI keeps working untouched.
 *
 * All routes are auth-gated by the same signed-cookie session resolver used
 * by `/api/coinhub`. Mutations are per-user rate-limited; reads are cheap.
 */

const claimAllLimiter = createRateLimiter({
  label: 'economy:claim-all',
  windowMs: 60_000,
  limit: 20,
})
const claimByIdLimiter = createRateLimiter({
  label: 'economy:claim-by-id',
  windowMs: 60_000,
  limit: 60,
})
const dailyLimiter = createRateLimiter({
  label: 'economy:daily',
  windowMs: 60_000,
  limit: 20,
})
const walletReadLimiter = createRateLimiter({
  label: 'economy:wallet:me',
  windowMs: 60_000,
  limit: 120,
})

function denyRateLimited(res: Response, retryAfterSec: number): void {
  res.setHeader('Retry-After', String(retryAfterSec))
  res
    .status(429)
    .json({ error: { code: 'RATE_LIMITED', message: 'Too many requests', retryAfterSec } })
}

async function resolveUserIdOr401(
  req: Request,
  res: Response,
): Promise<string | null> {
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
  const e = err as Error
  console.error('[economy]', e)
  res.status(500).json({ error: { code: 'INTERNAL', message: e.message || 'Error' } })
}

export function mountEconomyRoutes(app: Express): void {
  const base = '/api/economy'

  /**
   * Wallet snapshot — server-authoritative balance / XP / level / pending.
   * No mutations; safe to poll. Pending list is capped at 50 rows for UI;
   * the totals (`pendingCoins` / `pendingXp`) reflect the full unexpired set.
   */
  app.get(`${base}/wallet/me`, (req, res) => {
    void (async () => {
      try {
        const userId = await resolveUserIdOr401(req, res)
        if (userId == null) return
        const rl = walletReadLimiter.tryConsume(`user:${userId}`)
        if (!rl.allowed) {
          denyRateLimited(res, rl.retryAfterSec)
          return
        }
        const snapshot = await getWalletSnapshot(userId)
        res.json(snapshot)
      } catch (err) {
        sendError(res, err)
      }
    })()
  })

  /**
   * Claim every unexpired/unclaimed PendingReward for the user in one
   * Serializable transaction. Idempotent: two-tab race credits each row
   * at most once.
   */
  app.post(`${base}/claims/all`, (req, res) => {
    void (async () => {
      try {
        const userId = await resolveUserIdOr401(req, res)
        if (userId == null) return
        const rl = claimAllLimiter.tryConsume(`user:${userId}`)
        if (!rl.allowed) {
          denyRateLimited(res, rl.retryAfterSec)
          return
        }
        const summary = await claimAllPendingTopLevel(userId)
        const snapshot = await getWalletSnapshot(userId)
        res.json({ summary, wallet: snapshot })
      } catch (err) {
        sendError(res, err)
      }
    })()
  })

  /**
   * Claim one specific PendingReward by id. Server validates ownership; an
   * id belonging to another user returns the same "nothing to claim" shape
   * as a missing/expired/already-claimed row so existence is not leaked.
   */
  app.post(`${base}/claims/by-id`, (req, res) => {
    void (async () => {
      try {
        const userId = await resolveUserIdOr401(req, res)
        if (userId == null) return
        const rl = claimByIdLimiter.tryConsume(`user:${userId}`)
        if (!rl.allowed) {
          denyRateLimited(res, rl.retryAfterSec)
          return
        }
        const body = (req.body ?? {}) as { pendingRewardId?: unknown }
        const pendingRewardId =
          typeof body.pendingRewardId === 'string' ? body.pendingRewardId : ''
        if (pendingRewardId.length === 0) {
          res
            .status(400)
            .json({ error: { code: 'BAD_REQUEST', message: 'pendingRewardId is required' } })
          return
        }
        const summary = await claimPendingById(userId, pendingRewardId)
        const snapshot = await getWalletSnapshot(userId)
        res.json({ summary, wallet: snapshot })
      } catch (err) {
        sendError(res, err)
      }
    })()
  })

  /**
   * Daily claim. Creates the once-per-UTC-day PendingReward(kind='daily').
   * Does NOT directly credit the wallet — the user claims it via
   * `POST /api/economy/claims/all`. Returns 200 with `granted: false` if
   * today's grant already exists (idempotent).
   */
  app.post(`${base}/claims/daily`, (req, res) => {
    void (async () => {
      try {
        const userId = await resolveUserIdOr401(req, res)
        if (userId == null) return
        const rl = dailyLimiter.tryConsume(`user:${userId}`)
        if (!rl.allowed) {
          denyRateLimited(res, rl.retryAfterSec)
          return
        }
        const result = await grantDailyClaim(userId)
        const snapshot = await getWalletSnapshot(userId)
        res.json({ daily: result, wallet: snapshot })
      } catch (err) {
        sendError(res, err)
      }
    })()
  })
}
