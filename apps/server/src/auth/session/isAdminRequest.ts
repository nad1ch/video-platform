import { resolveUserRole } from '../resolveUserRole'
import { resolvePrismaUserIdFromSession } from '../resolvePrismaUserFromSession'
import { isDatabaseConfigured, prisma } from '../../prisma'
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
export async function isSessionAdminFromCookie(cookieHeader: string | undefined): Promise<boolean> {
  const s = readSessionFromCookie(cookieHeader)
  if (!s) {
    return false
  }
  if (resolveUserRole(roleInput(s)) === 'admin') {
    return true
  }
  if (!isDatabaseConfigured()) {
    return false
  }
  const prismaUserId = await resolvePrismaUserIdFromSession(s)
  if (!prismaUserId) {
    return false
  }
  const user = await prisma.user.findUnique({
    where: { id: prismaUserId },
    select: { role: true },
  })
  return user?.role === 'admin'
}
