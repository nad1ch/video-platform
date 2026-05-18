import type { Express, Request, Response } from 'express'
import { resolvePrismaUserIdFromSession } from '../../auth/resolvePrismaUserFromSession'
import { readSessionFromCookie } from '../../auth/session/sessionJwt'
import { createRateLimiter } from '../../utils/rateLimit'
import {
  PredictionError,
  cancelPrediction,
  createPrediction,
  joinPrediction,
  listPredictionsForStreamer,
  lockPrediction,
  resolvePrediction,
} from './predictionService'

const createLimiter = createRateLimiter({
  label: 'economy:predictions:create',
  windowMs: 60_000,
  limit: 12,
})
const joinLimiter = createRateLimiter({
  label: 'economy:predictions:join',
  windowMs: 60_000,
  limit: 30,
})
const resolveLimiter = createRateLimiter({
  label: 'economy:predictions:resolve',
  windowMs: 60_000,
  limit: 30,
})
const readLimiter = createRateLimiter({
  label: 'economy:predictions:read',
  windowMs: 60_000,
  limit: 120,
})

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

function denyRateLimited(res: Response, retryAfterSec: number): void {
  res.setHeader('Retry-After', String(retryAfterSec))
  res
    .status(429)
    .json({ error: { code: 'RATE_LIMITED', message: 'Too many requests', retryAfterSec } })
}

function sendError(res: Response, err: unknown): void {
  if (err instanceof PredictionError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } })
    return
  }
  const e = err as Error
  console.error('[economy][predictions]', e)
  res.status(500).json({ error: { code: 'INTERNAL', message: e.message || 'Error' } })
}

export function mountPredictionRoutes(app: Express): void {
  const base = '/api/economy/predictions'

  /** Streamer-scoped read. Auth required. */
  app.get(`${base}`, (req, res) => {
    void (async () => {
      try {
        const userId = await resolveUserIdOr401(req, res)
        if (userId == null) return
        const rl = readLimiter.tryConsume(`user:${userId}`)
        if (!rl.allowed) {
          denyRateLimited(res, rl.retryAfterSec)
          return
        }
        const streamerId = typeof req.query.streamerId === 'string' ? req.query.streamerId : ''
        if (!streamerId) {
          res
            .status(400)
            .json({ error: { code: 'BAD_REQUEST', message: 'streamerId is required' } })
          return
        }
        const status = typeof req.query.status === 'string' ? req.query.status : undefined
        const rows = await listPredictionsForStreamer(streamerId, { status })
        res.json({ predictions: rows })
      } catch (err) {
        sendError(res, err)
      }
    })()
  })

  app.post(`${base}`, (req, res) => {
    void (async () => {
      try {
        const userId = await resolveUserIdOr401(req, res)
        if (userId == null) return
        const rl = createLimiter.tryConsume(`user:${userId}`)
        if (!rl.allowed) {
          denyRateLimited(res, rl.retryAfterSec)
          return
        }
        const body = (req.body ?? {}) as {
          streamerId?: unknown
          title?: unknown
          options?: unknown
          durationMs?: unknown
          minStake?: unknown
          maxStake?: unknown
        }
        const streamerId = typeof body.streamerId === 'string' ? body.streamerId : ''
        const title = typeof body.title === 'string' ? body.title : ''
        const options = Array.isArray(body.options)
          ? body.options.filter((s): s is string => typeof s === 'string')
          : []
        const durationMs = typeof body.durationMs === 'number' ? body.durationMs : 0
        const minStake = typeof body.minStake === 'number' ? body.minStake : undefined
        const maxStake = typeof body.maxStake === 'number' ? body.maxStake : undefined
        const result = await createPrediction(userId, {
          streamerId,
          title,
          options,
          durationMs,
          minStake,
          maxStake,
        })
        res.status(201).json(result)
      } catch (err) {
        sendError(res, err)
      }
    })()
  })

  app.post(`${base}/:id/join`, (req, res) => {
    void (async () => {
      try {
        const userId = await resolveUserIdOr401(req, res)
        if (userId == null) return
        const rl = joinLimiter.tryConsume(`user:${userId}`)
        if (!rl.allowed) {
          denyRateLimited(res, rl.retryAfterSec)
          return
        }
        const predictionId = String(req.params.id ?? '').trim()
        const body = (req.body ?? {}) as { optionId?: unknown; stake?: unknown }
        const optionId = typeof body.optionId === 'string' ? body.optionId : ''
        const stake = typeof body.stake === 'number' ? body.stake : 0
        const out = await joinPrediction(userId, { predictionId, optionId, stake })
        res.json(out)
      } catch (err) {
        sendError(res, err)
      }
    })()
  })

  app.post(`${base}/:id/lock`, (req, res) => {
    void (async () => {
      try {
        const userId = await resolveUserIdOr401(req, res)
        if (userId == null) return
        const rl = resolveLimiter.tryConsume(`user:${userId}`)
        if (!rl.allowed) {
          denyRateLimited(res, rl.retryAfterSec)
          return
        }
        const out = await lockPrediction(userId, String(req.params.id ?? '').trim())
        res.json(out)
      } catch (err) {
        sendError(res, err)
      }
    })()
  })

  app.post(`${base}/:id/resolve`, (req, res) => {
    void (async () => {
      try {
        const userId = await resolveUserIdOr401(req, res)
        if (userId == null) return
        const rl = resolveLimiter.tryConsume(`user:${userId}`)
        if (!rl.allowed) {
          denyRateLimited(res, rl.retryAfterSec)
          return
        }
        const body = (req.body ?? {}) as { winningOptionId?: unknown }
        const winningOptionId =
          typeof body.winningOptionId === 'string' ? body.winningOptionId : ''
        const out = await resolvePrediction(
          userId,
          String(req.params.id ?? '').trim(),
          winningOptionId,
        )
        res.json(out)
      } catch (err) {
        sendError(res, err)
      }
    })()
  })

  app.post(`${base}/:id/cancel`, (req, res) => {
    void (async () => {
      try {
        const userId = await resolveUserIdOr401(req, res)
        if (userId == null) return
        const rl = resolveLimiter.tryConsume(`user:${userId}`)
        if (!rl.allowed) {
          denyRateLimited(res, rl.retryAfterSec)
          return
        }
        const out = await cancelPrediction(userId, String(req.params.id ?? '').trim())
        res.json(out)
      } catch (err) {
        sendError(res, err)
      }
    })()
  })
}
