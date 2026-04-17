import { prisma } from '../prisma'
import type { SessionPayload } from './session/sessionJwt'

function isDatabaseConfigured(): boolean {
  const u = process.env.DATABASE_URL
  return typeof u === 'string' && u.trim().length > 0
}

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

/** Wordle room + IRC context: streamer row owned by this user or tied to the same Twitch channel. */
export async function resolveWordleStreamerContextForUserId(
  userId: string,
): Promise<{ wordleStreamerId: string; wordleStreamerName: string } | null> {
  if (!isDatabaseConfigured()) {
    return null
  }
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { twitchId: true, streamerId: true },
  })
  if (!u) {
    return null
  }
  const or: Array<{ ownerId: string } | { twitchId: string } | { id: string }> = [{ ownerId: userId }]
  if (typeof u.twitchId === 'string' && u.twitchId.length > 0) {
    or.push({ twitchId: u.twitchId })
  }
  if (typeof u.streamerId === 'string' && u.streamerId.length > 0) {
    or.push({ id: u.streamerId })
  }
  const row = await prisma.streamer.findFirst({
    where: { isActive: true, OR: or },
    select: { id: true, name: true },
    orderBy: { id: 'asc' },
  })
  if (!row) {
    return null
  }
  return { wordleStreamerId: row.id, wordleStreamerName: row.name }
}
