import type { Router, Worker } from 'mediasoup/node/lib/types'
import type { Peer } from '../peers/Peer'
import { createRouter } from '../mediasoup/createRouter'

export class Room {
  readonly id: string
  readonly router: Router
  private readonly peers = new Map<string, Peer>()

  private constructor(id: string, router: Router) {
    this.id = id
    this.router = router
  }

  static async create(id: string, worker: Worker): Promise<Room> {
    const router = await createRouter(worker)
    return new Room(id, router)
  }

  getRouter(): Router {
    return this.router
  }

  dispose(): void {
    if (!this.router.closed) {
      this.router.close()
    }
  }

  addPeer(peer: Peer): void {
    this.peers.set(peer.id, peer)
  }

  removePeer(peerId: string): Peer | undefined {
    const peer = this.peers.get(peerId)
    if (!peer) {
      return undefined
    }
    this.peers.delete(peerId)
    return peer
  }

  getPeer(peerId: string): Peer | undefined {
    return this.peers.get(peerId)
  }

  getPeers(): Peer[] {
    return [...this.peers.values()]
  }
}
