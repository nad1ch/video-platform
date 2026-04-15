import type { SessionPayload } from './sessionJwt'
import type { GlobalAuthUser } from './types'

export function sessionToGlobalAuthUser(session: SessionPayload): GlobalAuthUser {
  const provider = session.provider
  const p =
    provider === 'twitch' || provider === 'google' || provider === 'apple' || provider === 'email'
      ? provider
      : null
  const trimmed = session.profile_image_url.trim()
  const role = session.role === 'admin' || session.role === 'user' ? session.role : 'user'
  const twitchId =
    p === 'twitch' ? (session.twitch_id ?? session.id) : undefined
  return {
    id: session.id,
    displayName: session.display_name,
    ...(trimmed.length > 0 ? { avatar: trimmed } : {}),
    provider: p,
    role,
    ...(typeof twitchId === 'string' && twitchId.length > 0 ? { twitchId } : {}),
  }
}

/** Legacy JSON for GET /api/me and GET /api/wordle/me. */
export function sessionToLegacyApiUser(session: SessionPayload): {
  id: string
  display_name: string
  profile_image_url: string
  provider: 'twitch' | 'google' | 'apple' | 'email' | null
  role: 'admin' | 'user'
  twitch_id?: string
} {
  const role = session.role === 'admin' || session.role === 'user' ? session.role : 'user'
  const twitch_id =
    session.provider === 'twitch' ? (session.twitch_id ?? session.id) : undefined
  return {
    id: session.id,
    display_name: session.display_name,
    profile_image_url: session.profile_image_url,
    provider: session.provider ?? null,
    role,
    ...(typeof twitch_id === 'string' && twitch_id.length > 0 ? { twitch_id } : {}),
  }
}
