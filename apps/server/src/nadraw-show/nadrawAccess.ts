import { isDatabaseConfigured, prisma } from '../prisma'
import type { SessionPayload } from '../auth/session/sessionJwt'
import { resolvePrismaUserIdFromSession } from '../auth/resolvePrismaUserFromSession'





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
