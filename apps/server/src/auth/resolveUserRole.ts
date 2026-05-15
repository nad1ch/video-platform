



import type { SessionUser } from './session/types'


export function parseAdminEnvList(raw: string | undefined): string[] {
  if (raw == null || typeof raw !== 'string') {
    return []
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * Server-side admin resolution (source of truth). Uses env allowlists only.
 * - Twitch: match Helix user id (`twitchId` or `id`) against ADMIN_TWITCH_IDS (exact string).
 * - Google / Apple: match `email` against ADMIN_EMAILS (case-insensitive); legitimate
 *   provider OAuth already proves email control.
 * - Email password: match `email` against ADMIN_EMAILS AND require `emailVerified === true`.
 *   Without verification the admin role is never granted, since email-password
 *   registration is unauthenticated and would otherwise allow an admin takeover
 *   via an unverified address (audit S1).
 */
export function resolveUserRole(input: {
  provider?: SessionUser['provider']
  id: string
  email?: string
  emailVerified?: boolean

  twitchId?: string
}): 'admin' | 'user' {
  const adminEmails = parseAdminEnvList(process.env.ADMIN_EMAILS).map((e) => e.toLowerCase())
  const adminTwitchIds = parseAdminEnvList(process.env.ADMIN_TWITCH_IDS)

  if (input.provider === 'twitch') {
    const tid =
      typeof input.twitchId === 'string' && input.twitchId.length > 0 ? input.twitchId : input.id
    return adminTwitchIds.includes(tid) ? 'admin' : 'user'
  }

  const em = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  if (em.length > 0 && adminEmails.includes(em)) {
    if (input.provider === 'email' && input.emailVerified !== true) {
      return 'user'
    }
    return 'admin'
  }

  return 'user'
}
