import type { SessionUser } from '../wordle/types'

function requiredEnv(name: string): string {
  const v = process.env[name]
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`Missing required env: ${name}`)
  }
  return v
}

export function googleAuthorizeUrl(redirectUri: string, state: string): string {
  const clientId = requiredEnv('GOOGLE_CLIENT_ID')
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    include_granted_scopes: 'true',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`
}

export async function googleExchangeCode(code: string, redirectUri: string): Promise<string> {
  const clientId = requiredEnv('GOOGLE_CLIENT_ID')
  const clientSecret = requiredEnv('GOOGLE_CLIENT_SECRET')

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

export async function googleFetchSessionUser(accessToken: string): Promise<SessionUser> {
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

  const display =
    typeof u.name === 'string' && u.name.trim().length > 0
      ? u.name.trim()
      : typeof u.email === 'string'
        ? u.email
        : u.id

  return {
    id: `google:${u.id}`,
    display_name: display,
    profile_image_url: typeof u.picture === 'string' ? u.picture : '',
    provider: 'google',
  }
}
