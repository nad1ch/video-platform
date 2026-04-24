import type { PooledWorker } from '../mediasoup/mediasoupWorkerTypes'
import type { MediasoupWorkerPool } from '../mediasoup/workerPool'
import { removePeerFromNetwork, type SignalingDeps } from '../signaling/messageHandlers'
import { Room } from './Room'

export class RoomManager {
  private readonly rooms = new Map<string, Room>()
  private readonly pendingRooms = new Map<string, Promise<Room>>()
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
      pending = Room.create(roomId, pooled)
        .then((room) => {
          this.workerPool.registerRoom(pooled)
          this.rooms.set(roomId, room)
          return room
        })
        .finally(() => {
          this.pendingRooms.delete(roomId)
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
    }
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId)
  }

  /**
   * When a child mediasoup worker process crashes: evict all peers in rooms bound to that worker.
   * If signaling is not wired yet, only disposes mediasoup state (sockets may remain orphaned).
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
  }
}
