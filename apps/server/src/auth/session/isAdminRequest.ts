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


export async function isSessionAdminFromCookie(cookieHeader: string | undefined): Promise<boolean> {
  const s = readSessionFromCookie(cookieHeader)
  if (!s) {
    return false
  }

  // For non-email providers, the env allowlist match is final (Twitch is bound
  // to a server-verified Twitch id; Google/Apple require completing legitimate
  // provider OAuth). For email-password, admin authority requires DB-side
  // verification — see below.
  if (s.provider !== 'email' && resolveUserRole(roleInput(s)) === 'admin') {
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
    select: { role: true, emailVerified: true },
  })
  if (!user) {
    return false
  }

  if (s.provider === 'email') {
    // Email-provider admin (audit S1): both the env allowlist path and the
    // stored DB role require `emailVerified === true`. Without verification,
    // anyone could register the admin's email and assume admin authority.
    if (!user.emailVerified) {
      return false
    }
    if (user.role === 'admin') {
      return true
    }
    return resolveUserRole({ ...roleInput(s), emailVerified: true }) === 'admin'
  }

  return user.role === 'admin'
}
