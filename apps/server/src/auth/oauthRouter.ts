import type { Express, Request, Response } from 'express'
import { Router } from 'express'
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
import { handleEmailLogin, handleEmailRegister } from './email/emailAuthHandlers'
import { withSessionRole } from './session/withSessionRole'

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

/** Final browser URL: client origin + safe path + `authSuccess=1` (for SPA hints). */
function buildPostLoginRedirectUrl(signedReturnPath: string): string {
  const origin = clientPublicOrigin()
  const path = sanitizePostLoginPath(signedReturnPath)
  const url = new URL(`${origin}${path}`)
  url.searchParams.set('authSuccess', '1')
  return url.toString()
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

/**
 * Global OAuth + session API. Mount with:
 * `app.use('/api/auth', oauthRouter)`
 */
export const oauthRouter = Router()

oauthRouter.get('/me', handleGetApiAuthMe)

oauthRouter.post('/logout', (_req: Request, res: Response) => {
  clearGlobalSessionCookie(res)
  res.status(204).end()
})

oauthRouter.post('/register', handleEmailRegister)
oauthRouter.post('/login', handleEmailLogin)

oauthRouter.get('/twitch', (req: Request, res: Response) => {
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
    console.log('[auth][twitch] authorize', { redirectUri, returnPath })
  }
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: '',
    force_verify: 'true',
    state,
  })
  res.redirect(302, `https://id.twitch.tv/oauth2/authorize?${p.toString()}`)
})

oauthRouter.get('/twitch/callback', async (req: Request, res: Response) => {
  const code = typeof req.query.code === 'string' ? req.query.code : ''
  const state = typeof req.query.state === 'string' ? req.query.state : undefined
  if (!code) {
    res.status(400).type('text/plain').send('Missing code')
    return
  }
  try {
    const redirectUri = twitchAppRedirectUri()
    const accessToken = await twitchExchangeCode(code, redirectUri)
    const profile = await twitchFetchSessionUser(accessToken)
    /** `role` + `twitch_id` from {@link withSessionRole} → `resolveUserRole` (Helix `id` vs ADMIN_TWITCH_IDS). */
    const finalUser = withSessionRole(profile)
    const token = signSession(finalUser, WORDLE_SESSION_MAX_AGE_SEC)
    setGlobalSessionCookie(res, token)
    const path = verifyOAuthReturnPath(state)
    res.redirect(302, buildPostLoginRedirectUrl(path))
  } catch (e) {
    console.error('[auth][twitch] callback error', e)
    res.status(500).type('text/plain').send('OAuth failed')
  }
})

oauthRouter.get('/google', (req: Request, res: Response) => {
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
    console.log('[auth][google] authorize', { redirectUri, returnPath })
  }
  res.redirect(302, getGoogleAuthUrl(state))
})

oauthRouter.get('/google/callback', async (req: Request, res: Response) => {
  const code = typeof req.query.code === 'string' ? req.query.code : ''
  const state = typeof req.query.state === 'string' ? req.query.state : undefined
  if (!code) {
    res.status(400).type('text/plain').send('Missing code')
    return
  }
  try {
    const accessToken = await exchangeCodeForToken(code)
    const profile = await getUserProfile(accessToken)
    const finalUser = withSessionRole(profile)
    const token = signSession(finalUser, WORDLE_SESSION_MAX_AGE_SEC)
    setGlobalSessionCookie(res, token)
    const path = verifyOAuthReturnPath(state)
    res.redirect(302, buildPostLoginRedirectUrl(path))
  } catch (e) {
    console.error('[auth][google] callback error', e)
    res.status(500).type('text/plain').send('OAuth failed')
  }
})

oauthRouter.get('/apple', (_req: Request, res: Response) => {
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

/**
 * Mount global auth:
 * - `GET/POST /api/auth/*` via {@link oauthRouter}
 * - `GET /api/me` legacy (same cookie), not under `/api/auth`
 */
export function mountGlobalAuth(app: Express): void {
  app.use('/api/auth', oauthRouter)
  app.get('/api/me', handleGetApiMeLegacy)
}

/** @deprecated Use {@link mountGlobalAuth} */
export const mountAppOAuth = mountGlobalAuth
