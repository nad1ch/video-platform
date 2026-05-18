import type { Express, Request, Response } from 'express'
import { resolvePrismaUserIdFromSession } from '../../auth/resolvePrismaUserFromSession'
import { readSessionFromCookie } from '../../auth/session/sessionJwt'
import { createRateLimiter } from '../../utils/rateLimit'
import { isStreamerOwner } from '../streamerOwnership'
import { getStreamerSettings, upsertStreamerSettings } from './streamerSettingsService'

const readLimiter = createRateLimiter({
  label: 'economy:streamer:settings:read',
  windowMs: 60_000,
  limit: 60,
})
const writeLimiter = createRateLimiter({
  label: 'economy:streamer:settings:write',
  windowMs: 60_000,
  limit: 20,
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

export function mountStreamerEconomyRoutes(app: Express): void {
  const base = '/api/streamers/:streamerId/economy/settings'

  app.get(base, (req, res) => {
    void (async () => {
      try {
        const userId = await resolveUserIdOr401(req, res)
        if (userId == null) return
        const streamerId = String(req.params.streamerId ?? '').trim()
        if (!streamerId) {
          res
            .status(400)
            .json({ error: { code: 'BAD_REQUEST', message: 'streamerId is required' } })
          return
        }
        const rl = readLimiter.tryConsume(`user:${userId}`)
        if (!rl.allowed) {
          denyRateLimited(res, rl.retryAfterSec)
          return
        }
        const owns = await isStreamerOwner(userId, streamerId)
        if (!owns) {
          res
            .status(403)
            .json({ error: { code: 'FORBIDDEN', message: 'Not the streamer owner' } })
          return
        }
        const settings = await getStreamerSettings(streamerId)
        res.json({ settings })
      } catch (err) {
        console.error('[economy][streamer-settings] GET', err)
        res.status(500).json({ error: { code: 'INTERNAL', message: 'Error' } })
      }
    })()
  })

  app.patch(base, (req, res) => {
    void (async () => {
      try {
        const userId = await resolveUserIdOr401(req, res)
        if (userId == null) return
        const streamerId = String(req.params.streamerId ?? '').trim()
        if (!streamerId) {
          res
            .status(400)
            .json({ error: { code: 'BAD_REQUEST', message: 'streamerId is required' } })
          return
        }
        const rl = writeLimiter.tryConsume(`user:${userId}`)
        if (!rl.allowed) {
          denyRateLimited(res, rl.retryAfterSec)
          return
        }
        const owns = await isStreamerOwner(userId, streamerId)
        if (!owns) {
          res
            .status(403)
            .json({ error: { code: 'FORBIDDEN', message: 'Not the streamer owner' } })
          return
        }
        const body = (req.body ?? {}) as Record<string, unknown>
        const settings = await upsertStreamerSettings(streamerId, {
          chatRewardsEnabled:
            typeof body.chatRewardsEnabled === 'boolean'
              ? body.chatRewardsEnabled
              : undefined,
          predictionsEnabled:
            typeof body.predictionsEnabled === 'boolean'
              ? body.predictionsEnabled
              : undefined,
          caseDropsEnabled:
            typeof body.caseDropsEnabled === 'boolean'
              ? body.caseDropsEnabled
              : undefined,
          maxCoinsPerViewerPerStream:
            typeof body.maxCoinsPerViewerPerStream === 'number'
              ? body.maxCoinsPerViewerPerStream
              : undefined,
          maxPredictionStake:
            typeof body.maxPredictionStake === 'number'
              ? body.maxPredictionStake
              : undefined,
          maxActivePredictions:
            typeof body.maxActivePredictions === 'number'
              ? body.maxActivePredictions
              : undefined,
        })
        res.json({ settings })
      } catch (err) {
        console.error('[economy][streamer-settings] PATCH', err)
        res.status(500).json({ error: { code: 'INTERNAL', message: 'Error' } })
      }
    })()
  })
}
