import type { Express, Request, Response } from 'express'
import { Router } from 'express'
import {
  signOAuthReturnPath,
  signSession,
  verifyOAuthState,
  NADLE_SESSION_MAX_AGE_SEC,
} from './session/sessionJwt'
import { clearGlobalSessionCookie, setGlobalSessionCookie } from './session/cookies'
import {
  clearOAuthNonceCookie,
  hashOAuthNonce,
  issueOAuthNonce,
  nonceHashMatches,
  readOAuthNonceCookie,
} from './session/oauthNonce'
import { handleGetApiAuthMe, handleGetApiMeLegacy } from './session/me'
import { clientPublicOrigin } from './clientOrigin'
import { exchangeCodeForToken, getGoogleAuthUrl, getUserProfile, resolveGoogleOAuthRedirectUri } from './googleOAuth'
import {
  twitchExchangeCode,
  twitchFetchFollowerCount,
  twitchFetchSessionUser,
  twitchFetchStreamStatus,
} from './twitchClient'
import { handleEmailLogin, handleEmailRegister } from './email/emailAuthHandlers'
import { handleSendEmailVerification, handleVerifyEmail } from './email/emailVerificationHandlers'
import { handleConfirmPasswordReset, handleSendPasswordReset } from './email/passwordResetHandlers'
import { persistGoogleOAuthUser, persistTwitchOAuthUser } from './persistOAuthUser'
import { withSessionRole } from './session/withSessionRole'
import { createIpRateLimitMiddleware } from '../utils/rateLimitMiddleware'

/**
 * Per-IP cap on OAuth authorize/callback endpoints (audit S7). These are
 * unauthenticated and trigger upstream RPCs to Twitch / Google. A scripted
 * abuser could otherwise pin a lot of outbound capacity. Legitimate users
 * hit these a few times per session at most; 30/min is generous.
 */
const oauthRateLimit = createIpRateLimitMiddleware({
  label: 'http:oauth',
  windowMs: 60 * 1000,
  limit: 30,
}).middleware

const oauthLogoutRateLimit = createIpRateLimitMiddleware({
  label: 'http:oauth:logout',
  windowMs: 60 * 1000,
  limit: 30,
}).middleware

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





export const oauthRouter = Router()

oauthRouter.get('/me', handleGetApiAuthMe)

oauthRouter.post('/logout', oauthLogoutRateLimit, (_req: Request, res: Response) => {
  clearGlobalSessionCookie(res)
  res.status(204).end()
})

oauthRouter.post('/register', handleEmailRegister)
oauthRouter.post('/login', handleEmailLogin)
oauthRouter.post('/email-verification/send', handleSendEmailVerification)
oauthRouter.get('/email-verification/verify', handleVerifyEmail)
oauthRouter.post('/password-reset/send', handleSendPasswordReset)
oauthRouter.post('/password-reset/confirm', handleConfirmPasswordReset)

oauthRouter.get('/twitch', oauthRateLimit, (req: Request, res: Response) => {
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
  let state: string
  try {
    const nonce = issueOAuthNonce(res)
    state = signOAuthReturnPath(returnPath, hashOAuthNonce(nonce))
  } catch (e) {
    console.error('[auth][twitch] authorize: cannot sign OAuth state (JWT secret?)', e)
    const msg = e instanceof Error ? e.message : 'Failed to sign OAuth state'
    res.status(503).type('text/plain').send(msg)
    return
  }
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

oauthRouter.get('/twitch/callback', oauthRateLimit, async (req: Request, res: Response) => {
  const code = typeof req.query.code === 'string' ? req.query.code : ''
  const state = typeof req.query.state === 'string' ? req.query.state : undefined
  if (!code) {
    res.status(400).type('text/plain').send('Missing code')
    return
  }
  const verified = verifyOAuthState(state)
  const cookieNonce = readOAuthNonceCookie(req)
  clearOAuthNonceCookie(res)
  if (
    !verified.ok ||
    typeof verified.nonceHash !== 'string' ||
    !cookieNonce ||
    !nonceHashMatches(verified.nonceHash, cookieNonce)
  ) {
    res.status(400).type('text/plain').send('Invalid OAuth state')
    return
  }
  try {
    const redirectUri = twitchAppRedirectUri()
    const accessToken = await twitchExchangeCode(code, redirectUri)
    const profile = await twitchFetchSessionUser(accessToken)
    const streamStatus = await twitchFetchStreamStatus(accessToken, profile.id).catch((e) => {
      console.warn('[auth][twitch] live status sync skipped', e)
      return null
    })
    /**
     * Follower-count probe gates auto Streamer creation/reactivation in
     * `persistTwitchOAuthUser`. The helper never throws; on any failure
     * we pass `null` so `persistTwitchOAuthUser` fail-closes (no new
     * Streamer, no reactivation). Login itself is never blocked.
     */
    const followerCount = await twitchFetchFollowerCount(accessToken, profile.id)
      .then((r) => (r.ok ? r.total : null))
      .catch((e) => {
        console.warn('[auth][twitch] follower count probe failed', e)
        return null
      })
    await persistTwitchOAuthUser(profile, { streamStatus, followerCount })

    const finalUser = withSessionRole(profile)
    const token = signSession(finalUser, NADLE_SESSION_MAX_AGE_SEC)
    setGlobalSessionCookie(res, token)
    res.redirect(302, buildPostLoginRedirectUrl(verified.redirectPath))
  } catch (e) {
    console.error('[auth][twitch] callback error', e)
    res.status(500).type('text/plain').send('OAuth failed')
  }
})

oauthRouter.get('/google', oauthRateLimit, (req: Request, res: Response) => {
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
  let state: string
  try {
    const nonce = issueOAuthNonce(res)
    state = signOAuthReturnPath(returnPath, hashOAuthNonce(nonce))
  } catch (e) {
    console.error('[auth][google] authorize: cannot sign OAuth state (JWT secret?)', e)
    const msg = e instanceof Error ? e.message : 'Failed to sign OAuth state'
    res.status(503).type('text/plain').send(msg)
    return
  }
  if (isDev) {
    console.log('[auth][google] authorize', { redirectUri, returnPath })
  }
  res.redirect(302, getGoogleAuthUrl(state))
})

oauthRouter.get('/google/callback', oauthRateLimit, async (req: Request, res: Response) => {
  const code = typeof req.query.code === 'string' ? req.query.code : ''
  const state = typeof req.query.state === 'string' ? req.query.state : undefined
  if (!code) {
    res.status(400).type('text/plain').send('Missing code')
    return
  }
  const verified = verifyOAuthState(state)
  const cookieNonce = readOAuthNonceCookie(req)
  clearOAuthNonceCookie(res)
  if (
    !verified.ok ||
    typeof verified.nonceHash !== 'string' ||
    !cookieNonce ||
    !nonceHashMatches(verified.nonceHash, cookieNonce)
  ) {
    res.status(400).type('text/plain').send('Invalid OAuth state')
    return
  }
  try {
    const accessToken = await exchangeCodeForToken(code)
    const profile = await getUserProfile(accessToken)
    await persistGoogleOAuthUser(profile)
    const finalUser = withSessionRole(profile)
    const token = signSession(finalUser, NADLE_SESSION_MAX_AGE_SEC)
    setGlobalSessionCookie(res, token)
    res.redirect(302, buildPostLoginRedirectUrl(verified.redirectPath))
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






export function mountGlobalAuth(app: Express): void {
  app.use('/api/auth', oauthRouter)
  app.get('/api/me', handleGetApiMeLegacy)
}


export const mountAppOAuth = mountGlobalAuth
