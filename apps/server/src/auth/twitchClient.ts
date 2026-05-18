
export type TwitchProfileForSession = {
  id: string
  login: string
  display_name: string
  profile_image_url: string
  broadcaster_type: string
  provider: 'twitch'
}

export type TwitchStreamStatus = {
  isLive: boolean
  currentOnline: number | null
}

function requiredEnv(name: string): string {
  const v = process.env[name]
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`Missing required env: ${name}`)
  }
  return v
}




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

export async function twitchFetchSessionUser(accessToken: string): Promise<TwitchProfileForSession> {
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
      login?: string
      display_name?: string
      profile_image_url?: string
      broadcaster_type?: string
    }>
  }
  const u = json.data?.[0]
  if (!u?.id || !u.login || !u.display_name || u.profile_image_url === undefined) {
    throw new Error('Twitch user payload incomplete')
  }

  return {
    id: u.id,
    login: u.login,
    display_name: u.display_name,
    profile_image_url: u.profile_image_url,
    broadcaster_type: u.broadcaster_type ?? '',
    provider: 'twitch',
  }
}

/**
 * Result of a follower-count probe used to gate Twitch auto-streamer
 * assignment in `persistTwitchOAuthUser`. Shape is intentionally
 * discriminated so the caller can branch on `ok` without inspecting
 * thrown errors — Twitch API failures never propagate out of this
 * helper (fail-closed is enforced by the caller via the `ok: false`
 * path).
 */
export type TwitchFollowerCountResult =
  | { ok: true; total: number }
  | { ok: false; reason: 'api_error' | 'invalid_payload' | 'missing_token' | 'missing_twitch_id' }

/**
 * Get the total follower count for a Twitch channel by calling the
 * current Helix endpoint:
 *
 *   GET https://api.twitch.tv/helix/channels/followers?broadcaster_id=<id>
 *
 * Auth model used here: pass the OAuth-login user's own access token
 * AND set `broadcaster_id` to that same user's Twitch id. Per Twitch's
 * Helix docs, when the broadcaster id in the query matches the user in
 * the token, the request is permitted without the
 * `moderator:read:followers` scope and the response still includes the
 * `total` field. This avoids requesting any new scopes on the OAuth
 * authorize URL.
 *
 * Never throws. On any failure (network, 401/403, missing payload field)
 * returns `{ ok: false, reason }` so the caller can fail-closed without
 * blocking login. Logs only safe summary fields — never the access
 * token, never the raw Twitch JSON.
 */
export async function twitchFetchFollowerCount(
  accessToken: string,
  broadcasterId: string,
): Promise<TwitchFollowerCountResult> {
  if (!accessToken) return { ok: false, reason: 'missing_token' }
  if (!broadcasterId) return { ok: false, reason: 'missing_twitch_id' }
  let clientId: string
  try {
    clientId = requiredEnv('TWITCH_CLIENT_ID')
  } catch {
    return { ok: false, reason: 'api_error' }
  }
  const p = new URLSearchParams({ broadcaster_id: broadcasterId })
  let res: Response
  try {
    res = await fetch(`https://api.twitch.tv/helix/channels/followers?${p.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Client-Id': clientId,
      },
    })
  } catch {
    return { ok: false, reason: 'api_error' }
  }
  if (!res.ok) {
    return { ok: false, reason: 'api_error' }
  }
  let json: unknown
  try {
    json = await res.json()
  } catch {
    return { ok: false, reason: 'invalid_payload' }
  }
  const total = (json as { total?: unknown } | null)?.total
  if (typeof total !== 'number' || !Number.isFinite(total) || total < 0) {
    return { ok: false, reason: 'invalid_payload' }
  }
  return { ok: true, total: Math.floor(total) }
}

export async function twitchFetchStreamStatus(
  accessToken: string,
  twitchUserId: string,
): Promise<TwitchStreamStatus> {
  const clientId = requiredEnv('TWITCH_CLIENT_ID')
  const p = new URLSearchParams({ user_id: twitchUserId })
  const res = await fetch(`https://api.twitch.tv/helix/streams?${p.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': clientId,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Twitch /helix/streams failed: ${res.status} ${text}`)
  }

  const json = (await res.json()) as {
    data?: Array<{
      type?: string
      viewer_count?: number
    }>
  }
  const stream = json.data?.[0]
  const isLive = stream?.type === 'live'
  return {
    isLive,
    currentOnline: isLive && typeof stream?.viewer_count === 'number' ? stream.viewer_count : null,
  }
}

