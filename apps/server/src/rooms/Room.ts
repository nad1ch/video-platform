import type {
  AudioLevelObserver,
  AudioLevelObserverVolume,
  Router,
  Worker,
} from 'mediasoup/types'
import type { Peer } from '../peers/Peer'
import { createRouter } from '../mediasoup/createRouter'

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) {
    return fallback
  }
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

export class Room {
  readonly id: string
  readonly router: Router
  private readonly peers = new Map<string, Peer>()
  private audioLevelObserver: AudioLevelObserver | null = null
  /** Last `peerId` sent in `active-speaker` (null = last send was clear). `undefined` = nothing sent yet. */
  private lastBroadcastSpeakerPeerId: string | null | undefined = undefined
  private silenceClearTimer: ReturnType<typeof setTimeout> | null = null
  /** Mafia “ведучий” — at most one per room; reassigned when they leave. */
  private mafiaHostPeerId: string | null = null
  /** Shared Mafia speaking queue (1-based seat indices); host authorizes updates via signaling. */
  private mafiaSpeakingQueue: number[] = []
  /** Shared Mafia round timer; host `mafia:timer-start`, clients derive remaining from wall clock. */
  private mafiaTimer: { startedAt: number; duration: number } | null = null

  private constructor(id: string, router: Router) {
    this.id = id
    this.router = router
  }

  static async create(id: string, worker: Worker): Promise<Room> {
    const router = await createRouter(worker)
    const room = new Room(id, router)
    await room.initAudioLevelObserver()
    return room
  }

  private clearSilenceHoldTimer(): void {
    if (this.silenceClearTimer !== null) {
      clearTimeout(this.silenceClearTimer)
      this.silenceClearTimer = null
    }
  }

  private async initAudioLevelObserver(): Promise<void> {
    const observer = await this.router.createAudioLevelObserver({
      maxEntries: 1,
      threshold: envNumber('AUDIO_LEVEL_THRESHOLD', -70),
      interval: envNumber('AUDIO_LEVEL_INTERVAL_MS', 800),
    })
    this.audioLevelObserver = observer

    observer.on('volumes', (volumes: AudioLevelObserverVolume[]) => {
      this.onAudioVolumes(volumes)
    })

    observer.on('silence', () => {
      this.clearSilenceHoldTimer()
      const holdMs = envNumber('AUDIO_SPEAKER_SILENCE_HOLD_MS', 1200)
      this.silenceClearTimer = setTimeout(() => {
        this.silenceClearTimer = null
        this.emitActiveSpeakerIfChanged(null)
      }, holdMs)
    })
  }

  private onAudioVolumes(volumes: AudioLevelObserverVolume[]): void {
    this.clearSilenceHoldTimer()
    if (volumes.length === 0) {
      return
    }
    const { producer } = volumes[0]!
    if (!producer || producer.closed) {
      return
    }
    const speakerPeerId = this.findPeerIdForProducer(producer.id)
    if (!speakerPeerId) {
      return
    }
    this.emitActiveSpeakerIfChanged(speakerPeerId)
  }

  private findPeerIdForProducer(producerId: string): string | undefined {
    for (const p of this.peers.values()) {
      if (p.getProducer(producerId)) {
        return p.id
      }
    }
    return undefined
  }

  /**
   * Broadcast `active-speaker` only when the dominant speaker actually changes (reduces WS noise).
   */
  private emitActiveSpeakerIfChanged(peerId: string | null): void {
    if (this.lastBroadcastSpeakerPeerId === peerId) {
      return
    }
    this.lastBroadcastSpeakerPeerId = peerId
    const msg = { type: 'active-speaker' as const, payload: { peerId } }
    for (const p of this.peers.values()) {
      p.sendJson(msg)
    }
  }

  /**
   * Late joiners miss deduped broadcasts; replay last known dominant speaker (or null) once.
   */
  sendActiveSpeakerCatchUpToPeer(peer: Peer): void {
    if (this.lastBroadcastSpeakerPeerId === undefined) {
      return
    }
    peer.sendJson({
      type: 'active-speaker',
      payload: { peerId: this.lastBroadcastSpeakerPeerId },
    })
  }

  async addAudioProducerToLevelObserver(producerId: string): Promise<void> {
    const obs = this.audioLevelObserver
    if (!obs || obs.closed) {
      return
    }
    try {
      await obs.addProducer({ producerId })
    } catch {
      /* producer may already be closed */
    }
  }

  async removeAudioProducerFromLevelObserver(producerId: string): Promise<void> {
    const obs = this.audioLevelObserver
    if (!obs || obs.closed) {
      return
    }
    try {
      await obs.removeProducer({ producerId })
    } catch {
      /* ignore */
    }
  }

  getRouter(): Router {
    return this.router
  }

  dispose(): void {
    this.clearSilenceHoldTimer()
    if (!this.router.closed) {
      this.router.close()
    }
    this.audioLevelObserver = null
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

  getMafiaHostPeerId(): string | null {
    return this.mafiaHostPeerId
  }

  setMafiaHostPeerId(id: string | null): void {
    this.mafiaHostPeerId = id
  }

  getMafiaSpeakingQueue(): number[] {
    return [...this.mafiaSpeakingQueue]
  }

  setMafiaSpeakingQueue(seats: number[]): void {
    this.mafiaSpeakingQueue = seats
  }

  getMafiaTimer(): { startedAt: number; duration: number; isRunning: true } | null {
    if (this.mafiaTimer == null) {
      return null
    }
    return { ...this.mafiaTimer, isRunning: true as const }
  }

  setMafiaTimer(t: { startedAt: number; duration: number } | null): void {
    this.mafiaTimer = t
  }
}
