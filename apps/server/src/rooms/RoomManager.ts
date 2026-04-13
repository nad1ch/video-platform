import type { Worker } from 'mediasoup/node/lib/types'
import { Room } from './Room'

export class RoomManager {
  private readonly rooms = new Map<string, Room>()
  private readonly pendingRooms = new Map<string, Promise<Room>>()

  constructor(private readonly worker: Worker) {}

  async getOrCreateRoom(roomId: string): Promise<Room> {
    const existing = this.rooms.get(roomId)
    if (existing) {
      return existing
    }

    let pending = this.pendingRooms.get(roomId)
    if (!pending) {
      pending = Room.create(roomId, this.worker)
        .then((room) => {
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
    this.rooms.delete(roomId)
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId)
  }

  disposeAllRooms(): void {
    for (const room of this.rooms.values()) {
      for (const peer of room.getPeers()) {
        peer.closeAllMedia()
      }
      room.dispose()
    }
    this.rooms.clear()
    this.pendingRooms.clear()
  }
}
