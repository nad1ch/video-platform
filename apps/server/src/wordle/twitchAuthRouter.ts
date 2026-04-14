import type { Express, Request, Response } from 'express'
import {
  readSessionFromCookie,
  WORDLE_SESSION_COOKIE,
  WORDLE_SESSION_MAX_AGE_SEC,
  signSession,
} from './sessionJwt'
import { getWordleIngestChannel } from './tmiChat'
import { readTwitchChatGuessCooldownMs } from './tmiGuessThrottle'
import { twitchExchangeCode, twitchFetchSessionUser } from '../auth/twitchClient'

function requiredEnv(name: string): string {
  const v = process.env[name]
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`Missing required env: ${name}`)
  }
  return v
}

function clientOrigin(): string {
  const raw = process.env.BASE_URL ?? process.env.WORDLE_CLIENT_ORIGIN ?? 'http://localhost:5173'
  return raw.replace(/\/$/, '')
}

function setSessionCookie(res: Response, token: string): void {
  res.cookie(WORDLE_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: WORDLE_SESSION_MAX_AGE_SEC * 1000,
    path: '/',
  })
}

export function mountTwitchWordleAuth(app: Express): void {
  app.get('/api/wordle/public-config', (_req: Request, res: Response) => {
    res.json({
      ingestChannel: getWordleIngestChannel(),
      chatGuessCooldownMs: readTwitchChatGuessCooldownMs(),
    })
  })

  app.get('/api/wordle/auth/callback', async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : ''
    if (!code) {
      res.status(400).send('Missing code')
      return
    }

    try {
      const redirectUri = requiredEnv('TWITCH_OAUTH_REDIRECT_URI')
      const accessToken = await twitchExchangeCode(code, redirectUri)
      const user = await twitchFetchSessionUser(accessToken)
      const token = signSession(user, WORDLE_SESSION_MAX_AGE_SEC)
      setSessionCookie(res, token)
      res.redirect(`${clientOrigin()}/wordle`)
    } catch (e) {
      console.error('[wordle] OAuth callback error', e)
      res.status(500).send('OAuth failed')
    }
  })

  app.get('/api/wordle/me', (req: Request, res: Response) => {
    const session = readSessionFromCookie(req.headers.cookie)
    if (!session) {
      res.status(401).json({ authenticated: false })
      return
    }
    res.json({
      id: session.id,
      display_name: session.display_name,
      profile_image_url: session.profile_image_url,
      provider: session.provider ?? null,
    })
  })

  app.post('/api/wordle/logout', (_req: Request, res: Response) => {
    res.clearCookie(WORDLE_SESSION_COOKIE, { path: '/' })
    res.json({ ok: true })
  })
}
