import type { PrismaClient } from '@prisma/client'
import { normalizeEatFirstSlot } from './slot'

function stripKey<T extends Record<string, unknown>>(o: T): T {
  const c = { ...o }
  delete c.key
  return c
}

function sanitizeRoom(room: unknown): Record<string, unknown> {
  if (!room || typeof room !== 'object' || Array.isArray(room)) return {}
  return stripKey({ ...(room as Record<string, unknown>) }) as Record<string, unknown>
}

function sanitizePlayerData(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
  return stripKey({ ...(data as Record<string, unknown>) }) as Record<string, unknown>
}

export type EatFirstSnapshot = {
  room: Record<string, unknown>
  players: Array<Record<string, unknown> & { id: string }>
  votes: Array<Record<string, unknown> & { id: string }>
}

export async function eatFirstSnapshot(prisma: PrismaClient, gameId: string): Promise<EatFirstSnapshot> {
  const g = await prisma.eatFirstGame.findUnique({
    where: { id: gameId },
    include: { players: true, votes: true },
  })
  if (!g) {
    return { room: {}, players: [], votes: [] }
  }
  const room = sanitizeRoom(g.room)
  const players = g.players
    .map((p) => {
      const id = normalizeEatFirstSlot(p.slotId)
      return { id, ...sanitizePlayerData(p.data) } as Record<string, unknown> & { id: string }
    })
    .sort((a, b) =>
      String(a.id).localeCompare(String(b.id), undefined, { numeric: true, sensitivity: 'base' }),
    )
  const votes = g.votes
    .map((v) => {
      const base =
        typeof v.data === 'object' && v.data !== null && !Array.isArray(v.data)
          ? (v.data as Record<string, unknown>)
          : {}
      return { id: normalizeEatFirstSlot(v.voterSlotId), ...stripKey({ ...base }) } as Record<
        string,
        unknown
      > & { id: string }
    })
    .sort((a, b) =>
      String(a.id).localeCompare(String(b.id), undefined, { numeric: true, sensitivity: 'base' }),
    )
  return { room, players, votes }
}
