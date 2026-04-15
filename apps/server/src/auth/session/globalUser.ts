import type { SessionPayload } from './sessionJwt'
import type { GlobalAuthUser } from './types'

export function sessionToGlobalAuthUser(session: SessionPayload): GlobalAuthUser {
  const provider = session.provider
  const p =
    provider === 'twitch' || provider === 'google' || provider === 'apple' ? provider : null
  const trimmed = session.profile_image_url.trim()
  return {
    id: session.id,
    displayName: session.display_name,
    ...(trimmed.length > 0 ? { avatar: trimmed } : {}),
    provider: p,
  }
}

/** Legacy JSON for GET /api/me and GET /api/wordle/me. */
export function sessionToLegacyApiUser(session: SessionPayload): {
  id: string
  display_name: string
  profile_image_url: string
  provider: 'twitch' | 'google' | 'apple' | null
} {
  return {
    id: session.id,
    display_name: session.display_name,
    profile_image_url: session.profile_image_url,
    provider: session.provider ?? null,
  }
}
