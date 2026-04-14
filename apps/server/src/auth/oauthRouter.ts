import type { Express, Request, Response } from 'express'
import type { SessionUser } from '../wordle/types'
import {
  readSessionFromCookie,
  WORDLE_SESSION_COOKIE,
  WORDLE_SESSION_MAX_AGE_SEC,
  signOAuthReturnPath,
  signSession,
  verifyOAuthReturnPath,
} from '../wordle/sessionJwt'
import { googleAuthorizeUrl, googleExchangeCode, googleFetchSessionUser } from './googleOAuth'
import { twitchExchangeCode, twitchFetchSessionUser } from './twitchClient'

function clientOrigin(): string {
  const raw = process.env.BASE_URL ?? process.env.WORDLE_CLIENT_ORIGIN ?? 'http://localhost:5173'
  return raw.replace(/\/$/, '')
}

function twitchAppRedirectUri(): string {
  const explicit = process.env.TWITCH_AUTH_REDIRECT_URI
  if (typeof explicit === 'string' && explicit.trim().length > 0) {
    return explicit.trim()
  }
  return `${clientOrigin()}/api/auth/twitch/callback`
}

function googleRedirectUri(): string {
  const explicit = process.env.GOOGLE_OAUTH_REDIRECT_URI
  if (typeof explicit === 'string' && explicit.trim().length > 0) {
    return explicit.trim()
  }
  return `${clientOrigin()}/api/auth/google/callback`
}

/**
 * Only allow same-origin relative paths after login (blocks open redirects).
 */
export function sanitizePostLoginPath(raw: string | undefined): string {
  if (!raw || typeof raw !== 'string') {
    return '/'
  }
  const t = raw.trim()
  if (!t.startsWith('/') || t.startsWith('//')) {
    return '/'
  }
  return t
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

function clearSessionCookie(res: Response): void {
  res.clearCookie(WORDLE_SESSION_COOKIE, { path: '/' })
}

function twitchConfigured(): boolean {
  return Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET)
}

function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

function appleConfigured(): boolean {
  return Boolean(
    process.env.APPLE_CLIENT_ID &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_KEY_ID &&
      process.env.APPLE_PRIVATE_KEY,
  )
}

function sessionJson(session: SessionUser) {
  return {
    id: session.id,
    display_name: session.display_name,
    profile_image_url: session.profile_image_url,
    provider: session.provider ?? null,
  }
}

export function mountAppOAuth(app: Express): void {
  app.get('/api/me', (req: Request, res: Response) => {
    const session = readSessionFromCookie(req.headers.cookie)
    if (!session) {
      res.status(401).json({ authenticated: false })
      return
    }
    res.json({
      authenticated: true,
      user: sessionJson(session),
    })
  })

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    clearSessionCookie(res)
    res.json({ ok: true })
  })

  app.get('/api/auth/twitch', (req: Request, res: Response) => {
    if (!twitchConfigured()) {
      res.status(503).type('text/plain').send('Twitch OAuth is not configured (TWITCH_CLIENT_ID / SECRET).')
      return
    }
    const clientId = process.env.TWITCH_CLIENT_ID as string
    const redirectUri = twitchAppRedirectUri()
    const returnPath = sanitizePostLoginPath(
      typeof req.query.redirect === 'string' ? req.query.redirect : undefined,
    )
    const state = signOAuthReturnPath(returnPath)
    const p = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: '',
      state,
    })
    res.redirect(302, `https://id.twitch.tv/oauth2/authorize?${p.toString()}`)
  })

  app.get('/api/auth/twitch/callback', async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : ''
    const state = typeof req.query.state === 'string' ? req.query.state : undefined
    if (!code) {
      res.status(400).type('text/plain').send('Missing code')
      return
    }
    try {
      const redirectUri = twitchAppRedirectUri()
      const accessToken = await twitchExchangeCode(code, redirectUri)
      const user = await twitchFetchSessionUser(accessToken)
      const token = signSession(user, WORDLE_SESSION_MAX_AGE_SEC)
      setSessionCookie(res, token)
      const path = sanitizePostLoginPath(verifyOAuthReturnPath(state))
      res.redirect(302, `${clientOrigin()}${path}`)
    } catch (e) {
      console.error('[auth] Twitch callback error', e)
      res.status(500).type('text/plain').send('OAuth failed')
    }
  })

  app.get('/api/auth/google', (req: Request, res: Response) => {
    if (!googleConfigured()) {
      res.status(503).type('text/plain').send('Google OAuth is not configured.')
      return
    }
    const redirectUri = googleRedirectUri()
    const returnPath = sanitizePostLoginPath(
      typeof req.query.redirect === 'string' ? req.query.redirect : undefined,
    )
    const state = signOAuthReturnPath(returnPath)
    res.redirect(302, googleAuthorizeUrl(redirectUri, state))
  })

  app.get('/api/auth/google/callback', async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : ''
    const state = typeof req.query.state === 'string' ? req.query.state : undefined
    if (!code) {
      res.status(400).type('text/plain').send('Missing code')
      return
    }
    try {
      const redirectUri = googleRedirectUri()
      const accessToken = await googleExchangeCode(code, redirectUri)
      const user = await googleFetchSessionUser(accessToken)
      const token = signSession(user, WORDLE_SESSION_MAX_AGE_SEC)
      setSessionCookie(res, token)
      const path = sanitizePostLoginPath(verifyOAuthReturnPath(state))
      res.redirect(302, `${clientOrigin()}${path}`)
    } catch (e) {
      console.error('[auth] Google callback error', e)
      res.status(500).type('text/plain').send('OAuth failed')
    }
  })

  app.get('/api/auth/apple', (_req: Request, res: Response) => {
    if (!appleConfigured()) {
      res
        .status(503)
        .type('text/plain')
        .send(
          'Apple Sign In is not enabled. Set APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY (requires Apple Developer Program).',
        )
      return
    }
    res
      .status(501)
      .type('text/plain')
      .send(
        'Apple Sign In is not implemented yet. Remove this message and wire Sign in with Apple when you enable the env vars.',
      )
  })
}
