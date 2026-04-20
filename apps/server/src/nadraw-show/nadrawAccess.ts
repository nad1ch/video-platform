import { prisma } from '../prisma'
import type { SessionPayload } from '../auth/session/sessionJwt'
import { resolvePrismaUserIdFromSession } from '../auth/resolvePrismaUserFromSession'

function isDatabaseConfigured(): boolean {
  const u = process.env.DATABASE_URL
  return typeof u === 'string' && u.trim().length > 0
}

/**
 * Streamer may control the room if they own the streamer row, are linked as channel Twitch id,
 * or are a member user assigned to this streamer (same rules as nadle streamer context).
 */
export async function canUserControlNadrawRoom(
  session: SessionPayload | null,
  streamerId: string,
): Promise<boolean> {
  if (!session || !isDatabaseConfigured()) {
    return false
  }
  const userId = await resolvePrismaUserIdFromSession(session)
  if (!userId) {
    return false
  }
  const [streamer, user] = await Promise.all([
    prisma.streamer.findFirst({
      where: { id: streamerId, isActive: true },
      select: { twitchId: true, ownerId: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { twitchId: true, streamerId: true },
    }),
  ])
  if (!streamer || !user) {
    return false
  }
  if (streamer.ownerId === userId) {
    return true
  }
  if (user.streamerId === streamerId) {
    return true
  }
  if (typeof user.twitchId === 'string' && user.twitchId.length > 0 && user.twitchId === streamer.twitchId) {
    return true
  }
  return false
}
