import type { Express, Request, Response } from 'express'
import { prisma } from '../prisma'
import { DEV_FALLBACK_STREAMER_ID } from './streamerContext'

function isDatabaseConfigured(): boolean {
  const u = process.env.DATABASE_URL
  return typeof u === 'string' && u.trim().length > 0
}

function normalizeTwitchUsername(raw: string): string | null {
  const t = raw.trim().replace(/^#/, '').toLowerCase()
  if (t.length < 2 || t.length > 25) {
    return null
  }
  if (!/^[a-z0-9_]+$/.test(t)) {
    return null
  }
  return t
}

/**
 * Public streamer card for routing + WebSocket `streamerId`.
 * `GET /api/streamer/:username`
 */
export function mountStreamerApiRoutes(app: Express): void {
  app.get('/api/streamer/:username', async (req: Request, res: Response) => {
    const username = normalizeTwitchUsername(String(req.params.username ?? ''))
    if (!username) {
      res.status(400).json({ error: 'invalid_username' })
      return
    }

    if (!isDatabaseConfigured()) {
      if (process.env.NODE_ENV === 'production') {
        res.status(503).json({ error: 'database_unconfigured' })
        return
      }
      const devLogin = (process.env.DEV_FALLBACK_STREAMER_USERNAME || 'nad1ch').toLowerCase()
      if (username !== devLogin) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      res.json({
        id: DEV_FALLBACK_STREAMER_ID,
        twitchId: 'dev',
        username: devLogin,
        isActive: true,
      })
      return
    }

    try {
      const row = await prisma.streamer.findFirst({
        where: { username, isActive: true },
        select: { id: true, twitchId: true, username: true, isActive: true },
      })
      if (!row) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      res.json(row)
    } catch (e) {
      console.error('[streamer] GET /api/streamer/:username', e)
      res.status(500).json({ error: 'server_error' })
    }
  })
}
