import { resolveUserRole } from '../resolveUserRole'
import { readSessionFromCookie, type SessionPayload } from './sessionJwt'

function roleInput(s: SessionPayload) {
  return {
    provider: s.provider,
    id: s.id,
    email: s.email,
    twitchId:
      s.provider === 'twitch'
        ? typeof s.twitch_id === 'string' && s.twitch_id.length > 0
          ? s.twitch_id
          : s.id
        : undefined,
  }
}

/** Поточна роль з allowlist (як у GET /api/auth/me), не лише поле в JWT. */
export function isSessionAdminFromCookie(cookieHeader: string | undefined): boolean {
  const s = readSessionFromCookie(cookieHeader)
  if (!s) {
    return false
  }
  return resolveUserRole(roleInput(s)) === 'admin'
}
