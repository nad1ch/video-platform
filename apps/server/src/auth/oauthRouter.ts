import type { Express, Request, Response } from 'express'
import {
  signOAuthReturnPath,
  signSession,
  verifyOAuthReturnPath,
  WORDLE_SESSION_MAX_AGE_SEC,
} from './session/sessionJwt'
import { clearGlobalSessionCookie, setGlobalSessionCookie } from './session/cookies'
import { handleGetApiAuthMe, handleGetApiMeLegacy } from './session/me'
import { clientPublicOrigin } from './clientOrigin'
import { exchangeCodeForToken, getGoogleAuthUrl, getUserProfile, resolveGoogleOAuthRedirectUri } from './googleOAuth'
import { twitchExchangeCode, twitchFetchSessionUser } from './twitchClient'

const isProd = process.env.NODE_ENV === 'production'
const isDev = process.env.NODE_ENV !== 'production'

function twitchAppRedirectUri(): string {
  const explicit = process.env.TWITCH_AUTH_REDIRECT_URI
  if (typeof explicit === 'string' && explicit.trim().length > 0) {
    return explicit.trim()
  }
  if (isProd) {
    throw new Error('TWITCH_AUTH_REDIRECT_URI must be set in production (full callback URL registered in Twitch console).')
  }
  return `${clientPublicOrigin()}/api/auth/twitch/callback`
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

export function mountAppOAuth(app: Express): void {
  /** Global session (camelCase); preferred for new clients. */
  app.get('/api/auth/me', handleGetApiAuthMe)

  /** @deprecated Prefer GET /api/auth/me — same cookie, snake_case user object. */
  app.get('/api/me', handleGetApiMeLegacy)

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    clearGlobalSessionCookie(res)
    res.status(204).end()
  })

  app.get('/api/auth/twitch', (req: Request, res: Response) => {
    if (!twitchConfigured()) {
      res.status(503).type('text/plain').send('Twitch OAuth is not configured (TWITCH_CLIENT_ID / SECRET).')
      return
    }
    let redirectUri: string
    try {
      redirectUri = twitchAppRedirectUri()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'OAuth misconfigured'
      res.status(503).type('text/plain').send(msg)
      return
    }
    const clientId = process.env.TWITCH_CLIENT_ID as string
    const returnPath = sanitizePostLoginPath(
      typeof req.query.redirect === 'string' ? req.query.redirect : undefined,
    )
    const state = signOAuthReturnPath(returnPath)
    if (isDev) {
      console.log('[auth] [twitch] authorize', { redirectUri, returnPath })
    }
    const p = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: '',
      /** Twitch: user must confirm authorize again (closest to “pick account” / no silent re-login). */
      force_verify: 'true',
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
      setGlobalSessionCookie(res, token)
      const path = sanitizePostLoginPath(verifyOAuthReturnPath(state))
      res.redirect(302, `${clientPublicOrigin()}${path}`)
    } catch (e) {
      console.error('[auth] [twitch] callback error', e)
      res.status(500).type('text/plain').send('OAuth failed')
    }
  })

  app.get('/api/auth/google', (req: Request, res: Response) => {
    if (!googleConfigured()) {
      res.status(503).type('text/plain').send('Google OAuth is not configured.')
      return
    }
    let redirectUri: string
    try {
      redirectUri = resolveGoogleOAuthRedirectUri()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'OAuth misconfigured'
      res.status(503).type('text/plain').send(msg)
      return
    }
    const returnPath = sanitizePostLoginPath(
      typeof req.query.redirect === 'string' ? req.query.redirect : undefined,
    )
    const state = signOAuthReturnPath(returnPath)
    if (isDev) {
      console.log('[auth] [google] authorize', { redirectUri, returnPath })
    }
    res.redirect(302, getGoogleAuthUrl(state))
  })

  app.get('/api/auth/google/callback', async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : ''
    const state = typeof req.query.state === 'string' ? req.query.state : undefined
    if (!code) {
      res.status(400).type('text/plain').send('Missing code')
      return
    }
    try {
      const accessToken = await exchangeCodeForToken(code)
      const user = await getUserProfile(accessToken)
      const token = signSession(user, WORDLE_SESSION_MAX_AGE_SEC)
      setGlobalSessionCookie(res, token)
      const path = sanitizePostLoginPath(verifyOAuthReturnPath(state))
      res.redirect(302, `${clientPublicOrigin()}${path}`)
    } catch (e) {
      console.error('[auth] [google] callback error', e)
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
