import type { SessionUser } from './session/types'

type GoogleProfileForSession = Omit<SessionUser, 'role'>
import { clientPublicOrigin } from './clientOrigin'

function requiredEnv(name: string): string {
  const v = process.env[name]
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`Missing required env: ${name}`)
  }
  return v
}

/** Must match the Authorized redirect URI in Google Cloud (and token exchange). */
export function resolveGoogleOAuthRedirectUri(): string {
  const explicit = process.env.GOOGLE_OAUTH_REDIRECT_URI
  if (typeof explicit === 'string' && explicit.trim().length > 0) {
    return explicit.trim()
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('GOOGLE_OAUTH_REDIRECT_URI must be set in production.')
  }
  return `${clientPublicOrigin()}/api/auth/google/callback`
}

/**
 * Step 1: Google OAuth 2.0 authorization URL (Authorization Code flow).
 * `state` should carry signed post-login path (see `signOAuthReturnPath` in auth/session/sessionJwt).
 */
export function getGoogleAuthUrl(state: string): string {
  const clientId = requiredEnv('GOOGLE_CLIENT_ID')
  const redirectUri = resolveGoogleOAuthRedirectUri()
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    /** Account picker + consent: avoids silent re-pick of the same Google session after app logout. */
    prompt: 'select_account consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`
}

/** Step 2: exchange authorization code for access token. */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const clientId = requiredEnv('GOOGLE_CLIENT_ID')
  const clientSecret = requiredEnv('GOOGLE_CLIENT_SECRET')
  const redirectUri = resolveGoogleOAuthRedirectUri()

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google token exchange failed: ${res.status} ${text}`)
  }

  const data = (await res.json()) as { access_token?: string }
  if (typeof data.access_token !== 'string') {
    throw new Error('Google token response missing access_token')
  }
  return data.access_token
}

/**
 * Step 3: userinfo → SessionUser (same JWT / cookie shape as Twitch).
 * Maps conceptually: id, name → display_name, picture → profile_image_url, provider "google".
 */
export async function getUserProfile(accessToken: string): Promise<GoogleProfileForSession> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google userinfo failed: ${res.status} ${text}`)
  }

  const u = (await res.json()) as {
    id?: string
    name?: string
    email?: string
    picture?: string
  }

  if (typeof u.id !== 'string' || u.id.length === 0) {
    throw new Error('Google userinfo missing id')
  }

  const displayName =
    typeof u.name === 'string' && u.name.trim().length > 0
      ? u.name.trim()
      : typeof u.email === 'string'
        ? u.email
        : u.id

  const avatar = typeof u.picture === 'string' ? u.picture : ''
  const emailRaw = typeof u.email === 'string' ? u.email.trim().toLowerCase() : ''

  return {
    id: u.id,
    display_name: displayName,
    profile_image_url: avatar,
    provider: 'google',
    ...(emailRaw.length > 0 ? { email: emailRaw } : {}),
  }
}
