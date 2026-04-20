import type { Express, Request, Response } from 'express'
import { clientPublicOrigin } from '../auth/clientOrigin'
import { clearGlobalSessionCookie, setGlobalSessionCookie } from '../auth/session/cookies'
import { handleGetNadleMe } from '../auth/session/me'
import { signSession, NADLE_SESSION_MAX_AGE_SEC } from '../auth/session/sessionJwt'
import { twitchExchangeCode, twitchFetchSessionUser } from '../auth/twitchClient'
import { persistTwitchOAuthUser } from '../auth/persistOAuthUser'
import { withSessionRole } from '../auth/session/withSessionRole'
import { getIngestChannelForStreamer } from './tmiChat'
import { readTwitchChatGuessCooldownMs } from './tmiGuessThrottle'

const isProd = process.env.NODE_ENV === 'production'

function nadleTwitchRedirectUri(): string {
  const explicit = process.env.TWITCH_OAUTH_REDIRECT_URI
  if (typeof explicit === 'string' && explicit.trim().length > 0) {
    return explicit.trim()
  }
  if (isProd) {
    throw new Error(
      'TWITCH_OAUTH_REDIRECT_URI must be set in production (nadle Twitch callback URL registered in Twitch console).',
    )
  }
  return `${clientPublicOrigin()}/api/nadle/auth/callback`
}

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

  app.get('/api/nadle/auth/callback', async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : ''
    if (!code) {
      res.status(400).send('Missing code')
      return
    }

    try {
      const redirectUri = nadleTwitchRedirectUri()
      const accessToken = await twitchExchangeCode(code, redirectUri)
      const profile = await twitchFetchSessionUser(accessToken)
      await persistTwitchOAuthUser(profile)
      const user = withSessionRole(profile)
      const token = signSession(user, NADLE_SESSION_MAX_AGE_SEC)
      setGlobalSessionCookie(res, token)
      const defaultSlug = (process.env.NADLE_DEFAULT_STREAMER_USERNAME || 'nad1ch').trim().toLowerCase() || 'nad1ch'
      res.redirect(`${clientPublicOrigin()}/nadle/${encodeURIComponent(defaultSlug)}`)
    } catch (e) {
      console.error('[auth] [twitch] nadle OAuth callback error', e)
      res.status(500).send('OAuth failed')
    }
  })

  app.get('/api/nadle/me', handleGetNadleMe)

  /** @deprecated Prefer POST /api/auth/logout — clears the same global session cookie. */
  app.post('/api/nadle/logout', (_req: Request, res: Response) => {
    clearGlobalSessionCookie(res)
    res.status(204).end()
  })
}
