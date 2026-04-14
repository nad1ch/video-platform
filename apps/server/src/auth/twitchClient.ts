import type { SessionUser } from '../wordle/types'

function requiredEnv(name: string): string {
  const v = process.env[name]
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`Missing required env: ${name}`)
  }
  return v
}

/**
 * Twitch OAuth token exchange (authorization code). `redirectUri` must match the authorize request.
 */
export async function twitchExchangeCode(code: string, redirectUri: string): Promise<string> {
  const clientId = requiredEnv('TWITCH_CLIENT_ID')
  const clientSecret = requiredEnv('TWITCH_CLIENT_SECRET')

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
  return data.access_token
}

export async function twitchFetchSessionUser(accessToken: string): Promise<SessionUser> {
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
    provider: 'twitch',
  }
}
