import type { Express, Request, Response } from 'express'
import { isDatabaseConfigured, prisma } from '../prisma'
import { normalizeTwitchLogin } from '../streamerIdentity'
import { DEV_FALLBACK_STREAMER_ID } from './streamerContext'





export function mountStreamerApiRoutes(app: Express): void {
  app.get('/api/streamer/:username', async (req: Request, res: Response) => {
    const username = normalizeTwitchLogin(String(req.params.username ?? ''))
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
        name: devLogin,
        isActive: true,
      })
      return
    }

    try {
      const row = await prisma.streamer.findFirst({
        where: {
          isActive: true,
          OR: [{ name: username }, { username }],
        },
        select: { id: true, twitchId: true, username: true, name: true, isActive: true },
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
