import { normalizeCheckersState, type CheckersState } from 'checkers-core'
import { isDatabaseConfigured, prisma } from '../prisma'
import type { CheckersBotDifficulty } from './checkersGameStore'

const SCHEMA_VERSION = 1

export type PersistedCheckersRoomMeta = {
  mode: 'friend' | 'bot' | 'local'
  player1?: string
  player2?: string
  rated?: boolean
  readyClientIds?: string[]
  displayNames?: Record<string, string>
  rematchAccepted: string[]
  lastMove: { from: { row: number; col: number }; to: { row: number; col: number } } | null
  botDifficulty: CheckersBotDifficulty
}

export type PersistedCheckersLiveRoom = {
  state: CheckersState
  meta: PersistedCheckersRoomMeta
}

type Snapshot = PersistedCheckersLiveRoom & {
  schemaVersion: typeof SCHEMA_VERSION
}

function isMode(value: unknown): value is PersistedCheckersRoomMeta['mode'] {
  return value === 'friend' || value === 'bot' || value === 'local'
}

function isBotDifficulty(value: unknown): value is CheckersBotDifficulty {
  return value === 'easy' || value === 'medium' || value === 'hard'
}

export function parseCheckersLiveRoomSnapshot(value: unknown): PersistedCheckersLiveRoom | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const snapshot = value as {
    schemaVersion?: unknown
    state?: unknown
    meta?: unknown
  }
  if (snapshot.schemaVersion !== SCHEMA_VERSION || !snapshot.state) {
    return null
  }
  const meta = snapshot.meta as {
    mode?: unknown
    player1?: unknown
    player2?: unknown
    rated?: unknown
    readyClientIds?: unknown
    displayNames?: unknown
    rematchAccepted?: unknown
    lastMove?: unknown
    botDifficulty?: unknown
  } | null
  if (!meta || !isMode(meta.mode)) {
    return null
  }
  return {
    state: normalizeCheckersState(snapshot.state as CheckersState),
    meta: {
      mode: meta.mode,
      player1: typeof meta.player1 === 'string' ? meta.player1 : undefined,
      player2: typeof meta.player2 === 'string' ? meta.player2 : undefined,
      rated: meta.rated === true,
      readyClientIds: Array.isArray(meta.readyClientIds)
        ? meta.readyClientIds.filter((id): id is string => typeof id === 'string')
        : [],
      displayNames:
        meta.displayNames && typeof meta.displayNames === 'object' && !Array.isArray(meta.displayNames)
          ? Object.fromEntries(
              Object.entries(meta.displayNames).filter(
                (entry): entry is [string, string] => typeof entry[1] === 'string',
              ),
            )
          : {},
      rematchAccepted: Array.isArray(meta.rematchAccepted)
        ? meta.rematchAccepted.filter((id): id is string => typeof id === 'string')
        : [],
      lastMove: meta.lastMove as PersistedCheckersRoomMeta['lastMove'],
      botDifficulty: isBotDifficulty(meta.botDifficulty) ? meta.botDifficulty : 'medium',
    },
  }
}

export async function loadCheckersLiveRoom(roomId: string): Promise<PersistedCheckersLiveRoom | null> {
  if (!isDatabaseConfigured()) {
    return null
  }
  try {
    const row = await prisma.checkersLiveRoom.findUnique({ where: { roomId } })
    return parseCheckersLiveRoomSnapshot(row?.state)
  } catch (error) {
    console.error('[checkers] load live room failed', { roomId, error })
    return null
  }
}

export function persistCheckersLiveRoom(roomId: string, snapshot: PersistedCheckersLiveRoom): void {
  if (!isDatabaseConfigured()) {
    return
  }
  const state: Snapshot = {
    schemaVersion: SCHEMA_VERSION,
    state: normalizeCheckersState(snapshot.state),
    meta: snapshot.meta,
  }
  void prisma.checkersLiveRoom
    .upsert({
      where: { roomId },
      create: { roomId, state },
      update: { state },
    })
    .catch((error) => {
      console.error('[checkers] persist live room failed', { roomId, error })
    })
}
