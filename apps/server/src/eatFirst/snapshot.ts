import type { PrismaClient } from '@prisma/client'
import {
  getEatFirstHostDisplaySeat,
  isEatFirstPlayerSlotId,
  resolveEatFirstEffectivePlayerOrder,
} from './playerOrder'
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
  /** Server-derived display metadata (not persisted as its own row). */
  display: { hostDisplaySeat: number; playerCount: number }
}

export async function eatFirstSnapshot(prisma: PrismaClient, gameId: string): Promise<EatFirstSnapshot> {
  const g = await prisma.eatFirstGame.findUnique({
    where: { id: gameId },
    include: { players: true, votes: true },
  })
  if (!g) {
    return { room: {}, players: [], votes: [], display: { hostDisplaySeat: 1, playerCount: 0 } }
  }
  const rawRoom =
    typeof g.room === 'object' && g.room !== null && !Array.isArray(g.room)
      ? (g.room as Record<string, unknown>)
      : {}
  const allowedSlotIds = new Set<string>()
  for (const p of g.players) {
    const id = normalizeEatFirstSlot(p.slotId)
    if (isEatFirstPlayerSlotId(id)) allowedSlotIds.add(id)
  }
  const effectivePlayerOrder = resolveEatFirstEffectivePlayerOrder(rawRoom.playerOrder, allowedSlotIds)
  const room = {
    ...sanitizeRoom(g.room),
    playerOrder: effectivePlayerOrder,
  }
  const players = g.players
    .filter((p) => isEatFirstPlayerSlotId(normalizeEatFirstSlot(p.slotId)))
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
  const display = {
    hostDisplaySeat: getEatFirstHostDisplaySeat(effectivePlayerOrder),
    playerCount: effectivePlayerOrder.length,
  }
  return { room, players, votes, display }
}
