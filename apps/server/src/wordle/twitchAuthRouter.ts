import type { Express, Request, Response } from 'express'
import type { SessionUser } from './types'
import {
  readSessionFromCookie,
  WORDLE_SESSION_COOKIE,
  WORDLE_SESSION_MAX_AGE_SEC,
  signSession,
} from './sessionJwt'
import { getWordleIngestChannel } from './tmiChat'
import { readTwitchChatGuessCooldownMs } from './tmiGuessThrottle'

function requiredEnv(name: string): string {
  const v = process.env[name]
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`Missing required env: ${name}`)
  }
  return v
}

async function twitchTokenExchange(code: string): Promise<{ access_token: string }> {
  const clientId = requiredEnv('TWITCH_CLIENT_ID')
  const clientSecret = requiredEnv('TWITCH_CLIENT_SECRET')
  const redirectUri = requiredEnv('TWITCH_OAUTH_REDIRECT_URI')

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  })

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Twitch token exchange failed: ${res.status} ${text}`)
  }

  const data = (await res.json()) as { access_token?: string }
  if (typeof data.access_token !== 'string') {
    throw new Error('Twitch token response missing access_token')
  }
  return { access_token: data.access_token }
}

async function twitchFetchMe(accessToken: string): Promise<SessionUser> {
  const clientId = requiredEnv('TWITCH_CLIENT_ID')
  const res = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': clientId,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Twitch /helix/users failed: ${res.status} ${text}`)
  }

  const json = (await res.json()) as {
    data?: Array<{
      id?: string
      display_name?: string
      profile_image_url?: string
    }>
  }
  const u = json.data?.[0]
  if (!u?.id || !u.display_name || u.profile_image_url === undefined) {
    throw new Error('Twitch user payload incomplete')
  }

  return {
    id: u.id,
    display_name: u.display_name,
    profile_image_url: u.profile_image_url,
  }
}

function clientOrigin(): string {
  return process.env.WORDLE_CLIENT_ORIGIN ?? 'http://localhost:5173'
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
      const { access_token } = await twitchTokenExchange(code)
      const user = await twitchFetchMe(access_token)
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
    })
  })

  app.post('/api/wordle/logout', (_req: Request, res: Response) => {
    res.clearCookie(WORDLE_SESSION_COOKIE, { path: '/' })
    res.json({ ok: true })
  })
}
