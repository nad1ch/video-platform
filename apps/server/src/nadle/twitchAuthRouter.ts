import type { Express, Request, Response } from 'express'
import { clearGlobalSessionCookie } from '../auth/session/cookies'
import { handleGetNadleMe } from '../auth/session/me'
import { getIngestChannelForStreamer } from './tmiChat'
import { readTwitchChatGuessCooldownMs } from './tmiGuessThrottle'

export function mountTwitchNadleAuth(app: Express): void {
  app.get('/api/nadle/public-config', (req: Request, res: Response) => {
    const streamerId = typeof req.query.streamerId === 'string' ? req.query.streamerId.trim() : ''
    if (!streamerId) {
      res.status(400).json({ error: 'streamerId_required' })
      return
    }
    res.json({
      ingestChannel: getIngestChannelForStreamer(streamerId),
      chatGuessCooldownMs: readTwitchChatGuessCooldownMs(),
    })
  })

  app.get('/api/nadle/me', handleGetNadleMe)

  app.post('/api/nadle/logout', (_req: Request, res: Response) => {
    clearGlobalSessionCookie(res)
    res.status(204).end()
  })
}
