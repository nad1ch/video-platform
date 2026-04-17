import { resolveUserRole } from '../auth/resolveUserRole'
import { resolvePrismaUserIdFromSession } from '../auth/resolvePrismaUserFromSession'
import { readSessionFromCookie, type SessionPayload } from '../auth/session/sessionJwt'
import { prisma } from '../prisma'

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

/** Allowlist admin, or `User.role` is `host` / `admin` in Postgres. */
export async function eatFirstSessionCanHost(cookieHeader: string | undefined): Promise<boolean> {
  const session = readSessionFromCookie(cookieHeader)
  if (!session) return false
  if (resolveUserRole(roleInput(session)) === 'admin') return true
  const prismaUserId = await resolvePrismaUserIdFromSession(session)
  if (!prismaUserId) return false
  const u = await prisma.user.findUnique({
    where: { id: prismaUserId },
    select: { role: true },
  })
  const r = u?.role ?? ''
  return r === 'host' || r === 'admin'
}
