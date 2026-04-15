import type { Express, Request, Response } from 'express'
import { clientPublicOrigin } from '../auth/clientOrigin'
import { clearGlobalSessionCookie, setGlobalSessionCookie } from '../auth/session/cookies'
import { handleGetWordleMe } from '../auth/session/me'
import { signSession, WORDLE_SESSION_MAX_AGE_SEC } from '../auth/session/sessionJwt'
import { twitchExchangeCode, twitchFetchSessionUser } from '../auth/twitchClient'
import { persistTwitchOAuthUser } from '../auth/persistOAuthUser'
import { withSessionRole } from '../auth/session/withSessionRole'
import { getWordleIngestChannel } from './tmiChat'
import { readTwitchChatGuessCooldownMs } from './tmiGuessThrottle'

const isProd = process.env.NODE_ENV === 'production'

function wordleTwitchRedirectUri(): string {
  const explicit = process.env.TWITCH_OAUTH_REDIRECT_URI
  if (typeof explicit === 'string' && explicit.trim().length > 0) {
    return explicit.trim()
  }
  if (isProd) {
    throw new Error(
      'TWITCH_OAUTH_REDIRECT_URI must be set in production (Wordle Twitch callback URL registered in Twitch console).',
    )
  }
  return `${clientPublicOrigin()}/api/wordle/auth/callback`
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
      const redirectUri = wordleTwitchRedirectUri()
      const accessToken = await twitchExchangeCode(code, redirectUri)
      const profile = await twitchFetchSessionUser(accessToken)
      await persistTwitchOAuthUser(profile)
      const user = withSessionRole(profile)
      const token = signSession(user, WORDLE_SESSION_MAX_AGE_SEC)
      setGlobalSessionCookie(res, token)
      res.redirect(`${clientPublicOrigin()}/wordle`)
    } catch (e) {
      console.error('[auth] [twitch] wordle OAuth callback error', e)
      res.status(500).send('OAuth failed')
    }
  })

  app.get('/api/wordle/me', handleGetWordleMe)

  /** @deprecated Prefer POST /api/auth/logout — clears the same global session cookie. */
  app.post('/api/wordle/logout', (_req: Request, res: Response) => {
    clearGlobalSessionCookie(res)
    res.status(204).end()
  })
}
