import { prisma } from '../prisma'

/**
 * Returns `true` when `userId` is the active owner of `streamerId` — either
 * via `Streamer.ownerId === userId` or an `OWNER`-role row in
 * `StreamerMember`. Both checks honor `Streamer.isActive`.
 *
 * Reused by predictions creation/resolve and streamer-settings endpoints so
 * the "host authority" predicate is centralized.
 */
export async function isStreamerOwner(
  userId: string,
  streamerId: string,
): Promise<boolean> {
  if (!userId || !streamerId) return false
  const row = await prisma.streamer.findFirst({
    where: {
      id: streamerId,
      isActive: true,
      OR: [
        { ownerId: userId },
        { ownerMemberships: { some: { userId, role: 'OWNER' } } },
      ],
    },
    select: { id: true },
  })
  return !!row
}
