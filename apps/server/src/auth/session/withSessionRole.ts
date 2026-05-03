import { resolveUserRole } from '../resolveUserRole'
import type { SessionUser } from './types'


export function withSessionRole(user: Omit<SessionUser, 'role'>): SessionUser {
  const twitchId = user.provider === 'twitch' ? user.id : undefined
  const withTwitchId =
    user.provider === 'twitch' ? { ...user, twitch_id: user.id } : user
  return {
    ...withTwitchId,
    role: resolveUserRole({
      provider: user.provider,
      id: user.id,
      email: user.email,
      twitchId,
    }),
  }
}
