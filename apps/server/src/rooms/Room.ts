import type { AudioLevelObserver, AudioLevelObserverVolume, Router } from 'mediasoup/types'
import type { Peer } from '../peers/Peer'
import { createRouter } from '../mediasoup/createRouter'
import type { PooledWorker } from '../mediasoup/mediasoupWorkerTypes'

export type MafiaPlayerLifeState = 'alive' | 'dead' | 'ghost'
export type MafiaEliminationBackground = 'dark' | 'red' | 'violet' | 'gray'
export type MafiaBackgroundItem = {
  id: string
  url: string
  type: 'preset' | 'custom'
}
export type MafiaPageBackgroundItem = {
  id: string
  url: string
  type: 'default' | 'preset' | 'custom'
}

const MAFIA_PRESET_BACKGROUND_ITEMS: MafiaBackgroundItem[] = ['dark', 'red', 'violet', 'gray'].map((background) => ({
  id: `preset-${background}`,
  url: `preset:${background}`,
  type: 'preset',
}))
const MAFIA_PAGE_BACKGROUND_ITEMS: MafiaPageBackgroundItem[] = [
  { id: 'default-page', url: 'default', type: 'default' },
  { id: 'preset-page-violet', url: 'preset:violet', type: 'preset' },
  { id: 'preset-page-night', url: 'preset:night', type: 'preset' },
]

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
  /**
   * Mediasoup process this room’s {@link router} is pinned to. Never changes for the room lifetime.
   */
  private readonly pooledWorker: PooledWorker
  private readonly peers = new Map<string, Peer>()
  private audioLevelObserver: AudioLevelObserver | null = null
  /** Last `peerId` sent in `active-speaker` (null = last send was clear). `undefined` = nothing sent yet. */
  private lastBroadcastSpeakerPeerId: string | null | undefined = undefined
  private silenceClearTimer: ReturnType<typeof setTimeout> | null = null
  /** Mafia “ведучий” — stable auth user id; not derived from transient peer lifecycle. */
  private mafiaHostUserId: string | null = null
  /** Active Mafia host tab/session id; stable across reload in the same tab. */
  private mafiaHostSessionId: string | null = null
  /** Active Mafia host peer id; prevents duplicated tabs with copied sessionStorage from also being active. */
  private mafiaHostPeerId: string | null = null
  /** Shared Mafia speaking queue (1-based seat indices); host authorizes updates via signaling. */
  private mafiaSpeakingQueue: number[] = []
  /** Shared Mafia round timer; host `mafia:timer-start`, clients derive remaining from wall clock. */
  private mafiaTimer: { startedAt: number; duration: number } | null = null
  private mafiaMode: 'old' | 'new' = 'old'
  private mafiaDeadBackgrounds: MafiaBackgroundItem[] = [...MAFIA_PRESET_BACKGROUND_ITEMS]
  private mafiaActiveBackgroundId: string | null = null
  private mafiaPageBackgrounds: MafiaPageBackgroundItem[] = [...MAFIA_PAGE_BACKGROUND_ITEMS]
  private mafiaForcedPageBackgroundId: string | null = null
  /** Mafia overlay state only. Missing peer id means alive. */
  private mafiaPlayerLifeStateByPeerId = new Map<string, Exclude<MafiaPlayerLifeState, 'alive'>>()

  private constructor(id: string, router: Router, pooledWorker: PooledWorker) {
    this.id = id
    this.router = router
    this.pooledWorker = pooledWorker
  }

  static async create(id: string, pooledWorker: PooledWorker): Promise<Room> {
    const router = await createRouter(pooledWorker.worker)
    const room = new Room(id, router, pooledWorker)
    await room.initAudioLevelObserver()
    return room
  }

  getPooledWorker(): PooledWorker {
    return this.pooledWorker
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

  getMafiaHostUserId(): string | null {
    return this.mafiaHostUserId
  }

  setMafiaHostUserId(id: string | null): void {
    this.mafiaHostUserId = id
  }

  getMafiaHostSessionId(): string | null {
    return this.mafiaHostSessionId
  }

  setMafiaHostSessionId(id: string | null): void {
    this.mafiaHostSessionId = id
  }

  getMafiaHostPeerId(): string | null {
    return this.mafiaHostPeerId
  }

  setMafiaHostPeerId(id: string | null): void {
    this.mafiaHostPeerId = id
  }

  getFirstMafiaSessionIdForUser(userId: string): string | null {
    return this.getPeers().find((peer) => peer.userId === userId && peer.mafiaSessionId.length > 0)?.mafiaSessionId ?? null
  }

  getFirstMafiaPeerIdForUserSession(userId: string, sessionId: string | null): string | null {
    if (sessionId == null) {
      return null
    }
    return this.getPeers().find((peer) => peer.userId === userId && peer.mafiaSessionId === sessionId)?.id ?? null
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

  getMafiaMode(): 'old' | 'new' {
    return this.mafiaMode
  }

  setMafiaMode(mode: 'old' | 'new'): void {
    this.mafiaMode = mode
    if (mode === 'old') {
      this.mafiaTimer = null
    }
  }

  getMafiaPlayerLifeStateSnapshot(): Record<string, MafiaPlayerLifeState> {
    return Object.fromEntries(this.mafiaPlayerLifeStateByPeerId.entries())
  }

  setMafiaPlayerLifeState(peerId: string, lifeState: MafiaPlayerLifeState): void {
    if (lifeState === 'alive') {
      this.mafiaPlayerLifeStateByPeerId.delete(peerId)
      return
    }
    this.mafiaPlayerLifeStateByPeerId.set(peerId, lifeState)
  }

  clearMafiaPlayerLifeStates(): void {
    this.mafiaPlayerLifeStateByPeerId.clear()
  }

  getMafiaDeadBackgrounds(): MafiaBackgroundItem[] {
    return this.mafiaDeadBackgrounds.map((item) => ({ ...item }))
  }

  getMafiaActiveBackgroundId(): string | null {
    return this.mafiaActiveBackgroundId
  }

  setMafiaDeadBackgroundSettings(backgrounds: MafiaBackgroundItem[], activeBackgroundId: string | null): void {
    this.mafiaDeadBackgrounds = backgrounds.map((item) => ({ ...item }))
    this.mafiaActiveBackgroundId = activeBackgroundId
  }

  getMafiaPageBackgrounds(): MafiaPageBackgroundItem[] {
    return this.mafiaPageBackgrounds.map((item) => ({ ...item }))
  }

  getMafiaForcedPageBackgroundId(): string | null {
    return this.mafiaForcedPageBackgroundId
  }

  setMafiaPageBackgroundSettings(backgrounds: MafiaPageBackgroundItem[], forcedBackgroundId: string | null): void {
    this.mafiaPageBackgrounds = backgrounds.map((item) => ({ ...item }))
    this.mafiaForcedPageBackgroundId = forcedBackgroundId
  }
}
