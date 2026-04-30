import { isDatabaseConfigured, prisma } from '../prisma'
import type { Game, PlayerState, Store } from './types'

const SCHEMA_VERSION = 1
const skippedLiveGameStreamerIds = new Set<string>()

type PersistedNadleLiveGame = {
  schemaVersion: typeof SCHEMA_VERSION
  currentGame: Game
  players: Record<string, PlayerState>
}

function isGame(value: unknown): value is Game {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const game = value as { id?: unknown; word?: unknown; startedAt?: unknown }
  return typeof game.id === 'string' && typeof game.word === 'string' && typeof game.startedAt === 'number'
}

function isPlayer(value: unknown): value is PlayerState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const player = value as {
    userId?: unknown
    displayName?: unknown
    attempts?: unknown
    guessed?: unknown
    rows?: unknown
    game?: unknown
  }
  return (
    typeof player.userId === 'string' &&
    typeof player.displayName === 'string' &&
    typeof player.attempts === 'number' &&
    typeof player.guessed === 'boolean' &&
    Array.isArray(player.rows) &&
    (player.game === undefined || isGame(player.game))
  )
}

export function parseNadleLiveGameSnapshot(value: unknown): PersistedNadleLiveGame | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const snapshot = value as {
    schemaVersion?: unknown
    currentGame?: unknown
    players?: unknown
  }
  if (snapshot.schemaVersion !== SCHEMA_VERSION || !isGame(snapshot.currentGame)) {
    return null
  }
  if (!snapshot.players || typeof snapshot.players !== 'object' || Array.isArray(snapshot.players)) {
    return null
  }
  const players: Record<string, PlayerState> = {}
  for (const [key, player] of Object.entries(snapshot.players)) {
    if (!isPlayer(player)) {
      return null
    }
    players[key] = player
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    currentGame: snapshot.currentGame,
    players,
  }
}

function toSnapshot(store: Store): PersistedNadleLiveGame {
  return {
    schemaVersion: SCHEMA_VERSION,
    currentGame: store.currentGame,
    players: store.players,
  }
}

async function canPersistLiveGameForStreamer(streamerId: string): Promise<boolean> {
  const streamer = await prisma.streamer.findUnique({ where: { id: streamerId }, select: { id: true } })
  if (streamer) {
    skippedLiveGameStreamerIds.delete(streamerId)
    return true
  }
  if (!skippedLiveGameStreamerIds.has(streamerId)) {
    skippedLiveGameStreamerIds.add(streamerId)
    console.warn('[nadle] skip live game persistence: streamer row not found', { streamerId })
  }
  return false
}

export async function loadNadleLiveGame(streamerId: string): Promise<Store | null> {
  if (!isDatabaseConfigured()) {
    return null
  }
  try {
    const row = await prisma.nadleLiveGame.findUnique({ where: { streamerId } })
    const parsed = parseNadleLiveGameSnapshot(row?.state)
    return parsed ? { currentGame: parsed.currentGame, players: parsed.players } : null
  } catch (error) {
    console.error('[nadle] load live game failed', { streamerId, error })
    return null
  }
}

export function persistNadleLiveGame(streamerId: string, store: Store): void {
  if (!isDatabaseConfigured()) {
    return
  }
  const state = toSnapshot(store)
  void (async () => {
    if (!(await canPersistLiveGameForStreamer(streamerId))) {
      return
    }
    await prisma.nadleLiveGame.upsert({
      where: { streamerId },
      create: { streamerId, state },
      update: { state },
    })
  })()
    .catch((error) => {
      console.error('[nadle] persist live game failed', { streamerId, error })
    })
}
