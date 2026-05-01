import { isDatabaseConfigured, prisma } from '../prisma'
import type { SessionPayload } from './session/sessionJwt'
import type { AuthStreamerContext } from './session/types'

const STREAMER_OWNER_ROLE = 'OWNER'

/**
 * Maps a signed-in session to a `User.id` in Postgres (OAuth rows use provider ids in JWT, not Prisma cuid).
 */
export async function resolvePrismaUserIdFromSession(session: SessionPayload): Promise<string | null> {
  if (!isDatabaseConfigured()) {
    return null
  }
  const byId = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true },
  })
  if (byId) {
    return byId.id
  }

  const provider = session.provider
  if (provider === 'twitch') {
    const tid =
      typeof session.twitch_id === 'string' && session.twitch_id.length > 0 ? session.twitch_id : session.id
    const byTwitch = await prisma.user.findFirst({
      where: { twitchId: tid },
      select: { id: true },
    })
    return byTwitch?.id ?? null
  }

  if (provider === 'google' || provider === 'apple') {
    const byProvider = await prisma.user.findFirst({
      where: { provider, providerUserId: session.id },
      select: { id: true },
    })
    return byProvider?.id ?? null
  }

  if (provider === 'email') {
    const byEmailId = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true },
    })
    return byEmailId?.id ?? null
  }

  return null
}

export async function resolveUserStreamerContext(userId: string): Promise<AuthStreamerContext | null> {
  if (!isDatabaseConfigured()) {
    return null
  }
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })
  if (!u) {
    return null
  }
  const or: Array<
    | { ownerId: string }
    | { ownerMemberships: { some: { userId: string; role: string } } }
  > = [
    { ownerId: userId },
    { ownerMemberships: { some: { userId, role: STREAMER_OWNER_ROLE } } },
  ]
  const row = await prisma.streamer.findFirst({
    where: { isActive: true, OR: or },
    select: {
      id: true,
      twitchId: true,
      username: true,
      displayName: true,
      profileImageUrl: true,
      broadcasterType: true,
      followersCount: true,
      currentOnline: true,
      avgOnline7d: true,
      isLive: true,
      tier: true,
    },
    orderBy: { id: 'asc' },
  })
  if (!row) {
    return null
  }
  return row
}

/** Nadle room + IRC context derived from the backend-owned streamer resolver. */
export async function resolveNadleStreamerContextForUserId(
  userId: string,
): Promise<{ nadleStreamerId: string; nadleStreamerName: string } | null> {
  if (!isDatabaseConfigured()) {
    return null
  }
  const owned = await prisma.streamer.findFirst({
    where: {
      isActive: true,
      OR: [
        { ownerId: userId },
        { ownerMemberships: { some: { userId, role: STREAMER_OWNER_ROLE } } },
      ],
    },
    select: { id: true, name: true, username: true },
    orderBy: { id: 'asc' },
  })
  if (owned) {
    return { nadleStreamerId: owned.id, nadleStreamerName: owned.name || owned.username }
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { streamerId: true },
  })
  if (!user?.streamerId) {
    return null
  }
  const assigned = await prisma.streamer.findFirst({
    where: { id: user.streamerId, isActive: true },
    select: { id: true, name: true, username: true },
  })
  return assigned ? { nadleStreamerId: assigned.id, nadleStreamerName: assigned.name || assigned.username } : null
}
