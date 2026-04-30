import { isDatabaseConfigured, prisma } from '../prisma'
import type { NadrawRoomSnapshot } from './nadrawGameStore'

const SCHEMA_VERSION = 1
const skippedLiveRoomStreamerIds = new Set<string>()

export type PersistedNadrawDraw = {
  phase: 'start' | 'move' | 'end'
  strokeId: string
  x: number
  y: number
  color?: string
  lineWidth?: number
  erase?: boolean
  op?: 'stroke' | 'fill' | 'rect' | 'ellipse'
  x2?: number
  y2?: number
}

export type PersistedNadrawChatEvent =
  | { kind: 'chat'; userId: string; displayName: string; text: string }
  | {
      kind: 'feedback'
      userId: string
      displayName: string
      text: string
      feedbackKind: 'rate_limit' | 'guess_locked' | 'heat' | 'win' | 'wrong'
      heat?: 'cold' | 'warm' | 'hot'
    }

export type PersistedNadrawLiveRoom = {
  room: NadrawRoomSnapshot
  drawOps: PersistedNadrawDraw[]
  chatEvents: PersistedNadrawChatEvent[]
}

type Snapshot = PersistedNadrawLiveRoom & {
  schemaVersion: typeof SCHEMA_VERSION
}

export function parseNadrawLiveRoomSnapshot(value: unknown): PersistedNadrawLiveRoom | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const snapshot = value as {
    schemaVersion?: unknown
    room?: unknown
    drawOps?: unknown
    chatEvents?: unknown
  }
  if (snapshot.schemaVersion !== SCHEMA_VERSION || !snapshot.room) {
    return null
  }
  return {
    room: snapshot.room as NadrawRoomSnapshot,
    drawOps: Array.isArray(snapshot.drawOps) ? (snapshot.drawOps as PersistedNadrawDraw[]) : [],
    chatEvents: Array.isArray(snapshot.chatEvents)
      ? (snapshot.chatEvents as PersistedNadrawChatEvent[])
      : [],
  }
}

async function canPersistLiveRoomForStreamer(streamerId: string): Promise<boolean> {
  const streamer = await prisma.streamer.findUnique({ where: { id: streamerId }, select: { id: true } })
  if (streamer) {
    skippedLiveRoomStreamerIds.delete(streamerId)
    return true
  }
  if (!skippedLiveRoomStreamerIds.has(streamerId)) {
    skippedLiveRoomStreamerIds.add(streamerId)
    console.warn('[nadraw-show] skip live room persistence: streamer row not found', { streamerId })
  }
  return false
}

export async function loadNadrawLiveRoom(streamerId: string): Promise<PersistedNadrawLiveRoom | null> {
  if (!isDatabaseConfigured()) {
    return null
  }
  try {
    const row = await prisma.nadrawLiveRoom.findUnique({ where: { streamerId } })
    return parseNadrawLiveRoomSnapshot(row?.state)
  } catch (error) {
    console.error('[nadraw-show] load live room failed', { streamerId, error })
    return null
  }
}

export function persistNadrawLiveRoom(streamerId: string, snapshot: PersistedNadrawLiveRoom): void {
  if (!isDatabaseConfigured()) {
    return
  }
  const state: Snapshot = { schemaVersion: SCHEMA_VERSION, ...snapshot }
  void (async () => {
    if (!(await canPersistLiveRoomForStreamer(streamerId))) {
      return
    }
    await prisma.nadrawLiveRoom.upsert({
      where: { streamerId },
      create: { streamerId, state },
      update: { state },
    })
  })()
    .catch((error) => {
      console.error('[nadraw-show] persist live room failed', { streamerId, error })
    })
}
