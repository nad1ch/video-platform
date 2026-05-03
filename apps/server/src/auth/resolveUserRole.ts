



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
 * - Google / email password: match `email` against ADMIN_EMAILS (case-insensitive).
 */
export function resolveUserRole(input: {
  provider?: SessionUser['provider']
  id: string
  email?: string
  
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
    return 'admin'
  }

  return 'user'
}
