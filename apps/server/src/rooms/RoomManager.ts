import type { PooledWorker } from '../mediasoup/mediasoupWorkerTypes'
import type { MediasoupWorkerPool } from '../mediasoup/workerPool'
import { removePeerFromNetwork, type SignalingDeps } from '../signaling/messageHandlers'
import { newDiagnosticEventId, recordDiagnosticEvent } from '../signaling/roomDiagnosticsBus'
import { Room } from './Room'

function gameTypeForRoomId(roomId: string): 'mafia' | 'game-room' | 'eat-first' | null {
  if (roomId.startsWith('mafia:')) return 'mafia'
  if (roomId.startsWith('gameroom:')) return 'game-room'
  if (roomId.startsWith('eat:')) return 'eat-first'
  return null
}

/** Best-effort server emit; never throws into the caller path. */
function emitRoomLifecycle(
  roomId: string,
  type: 'room_created' | 'room_closed',
  context: Record<string, unknown> = {},
): void {
  try {
    recordDiagnosticEvent({
      id: newDiagnosticEventId(),
      reportVersion: 1,
      timestamp: Date.now(),
      source: 'server',
      level: 'info',
      area: 'room',
      type,
      roomId,
      gameType: gameTypeForRoomId(roomId),
      peerId: null,
      userId: null,
      sessionId: null,
      correlationId: null,
      message: type,
      context,
    })
  } catch {
    /* never throw from diagnostics */
  }
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>()
  private readonly pendingRooms = new Map<string, Promise<Room>>()
  /**
   * Which pooled worker each in-flight `Room.create` is bound to. Lets
   * `evacuateRoomsForDeadWorker` invalidate pending rooms whose worker died
   * mid-creation, so a subsequent `getOrCreateRoom` can start over on a
   * live worker instead of awaiting a Promise that may never settle.
   */
  private readonly pendingRoomWorkers = new Map<string, PooledWorker>()
  private signalingDeps: SignalingDeps | null = null

  constructor(private readonly workerPool: MediasoupWorkerPool) {}

  /** Required for evacuating WebSockets when a mediasoup worker process dies. */
  bindSignalingDeps(deps: SignalingDeps): void {
    this.signalingDeps = deps
  }

  async getOrCreateRoom(roomId: string): Promise<Room> {
    const existing = this.rooms.get(roomId)
    if (existing) {
      return existing
    }

    let pending = this.pendingRooms.get(roomId)
    if (!pending) {
      const pooled = this.workerPool.getLeastLoadedWorker()
      this.pendingRoomWorkers.set(roomId, pooled)
      pending = Room.create(roomId, pooled)
        .then((room) => {
          
          
          // but close the orphaned router explicitly so the mediasoup-side
          
          if (pooled.dead) {
            try {
              if (!room.getRouter().closed) {
                room.getRouter().close()
              }
            } catch {
              /* dead-worker close is best-effort */
            }
            throw new Error(`mediasoup worker ${pooled.index} died during room creation`)
          }
          this.workerPool.registerRoom(pooled)
          this.rooms.set(roomId, room)
          emitRoomLifecycle(roomId, 'room_created', { workerIndex: pooled.index })
          return room
        })
        .finally(() => {
          
          
          
          if (this.pendingRooms.get(roomId) === pending) {
            this.pendingRooms.delete(roomId)
            this.pendingRoomWorkers.delete(roomId)
          }
        })
      this.pendingRooms.set(roomId, pending)
    }

    return pending
  }

  removeRoom(roomId: string): void {
    const existing = this.rooms.get(roomId)
    this.rooms.delete(roomId)
    if (existing) {
      this.workerPool.unregisterRoom(existing.getPooledWorker())
      emitRoomLifecycle(roomId, 'room_closed')
    }
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId)
  }

  /**
   * Read-only snapshot of live rooms for `/health` (operator visibility into
   * pool balance). Single-pass over the rooms Map; no identity data (no
   * peerId, userId, displayName).
   */
  snapshotRooms(): ReadonlyArray<{ roomId: string; workerIndex: number; peerCount: number }> {
    const out: { roomId: string; workerIndex: number; peerCount: number }[] = []
    for (const room of this.rooms.values()) {
      out.push({
        roomId: room.id,
        workerIndex: room.getPooledWorker().index,
        peerCount: room.getPeers().length,
      })
    }
    return out
  }

  /**
   * When a child mediasoup worker process crashes: evict all peers in rooms bound to that worker.
   * If signaling is not wired yet, only disposes mediasoup state (sockets may remain orphaned).
   * Also forgets any in-flight `getOrCreateRoom` whose `Room.create` is
   * awaiting on the dead worker so the next call can start afresh on a
   * live worker without waiting for a promise that may never settle.
   */
  evacuateRoomsForDeadWorker(entry: PooledWorker): void {
    const onWorker = [...this.rooms.values()].filter((r) => r.getPooledWorker() === entry)
    const deps = this.signalingDeps
    if (deps) {
      for (const room of onWorker) {
        for (const p of [...room.getPeers()]) {
          try {
            p.sendJson({
              type: 'error',
              payload: { code: 'mediasoup_worker_died', message: 'Server media worker failed' },
            })
          } catch {
            /* ignore */
          }
          removePeerFromNetwork(p, deps)
        }
      }
    } else {
      for (const room of onWorker) {
        for (const p of room.getPeers()) {
          p.closeAllMedia()
        }
        room.dispose()
        this.rooms.delete(room.id)
      }
    }
    
    
    
    // of returning the stale one to all concurrent callers.
    for (const [roomId, pooled] of [...this.pendingRoomWorkers.entries()]) {
      if (pooled === entry) {
        this.pendingRoomWorkers.delete(roomId)
        this.pendingRooms.delete(roomId)
      }
    }
    entry.roomCount = 0
  }

  disposeAllRooms(): void {
    for (const room of this.rooms.values()) {
      const pooled = room.getPooledWorker()
      for (const peer of room.getPeers()) {
        peer.closeAllMedia()
      }
      room.dispose()
      this.workerPool.unregisterRoom(pooled)
    }
    this.rooms.clear()
    this.pendingRooms.clear()
    this.pendingRoomWorkers.clear()
  }
}
