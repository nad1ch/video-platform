import type { AudioLevelObserver, AudioLevelObserverVolume, Router } from 'mediasoup/types'
import type { Peer } from '../peers/Peer'
import { createRouter } from '../mediasoup/createRouter'
import type { PooledWorker } from '../mediasoup/mediasoupWorkerTypes'

export type MafiaPlayerLifeState = 'alive' | 'dead' | 'ghost'
export type MafiaRole = 'mafia' | 'don' | 'sheriff' | 'doctor' | 'civilian'
/** Latest server-accepted Mafia reshuffle payload, kept in memory for late-joiner role replay. */
export type MafiaReshuffleSnapshotPlayer = {
  peerId: string
  seat: number
  role: MafiaRole | null
}
export type MafiaReshuffleSnapshot = {
  players: MafiaReshuffleSnapshotPlayer[]
}

export type MafiaPlayersUpdateSnapshot = {
  order: string[]
  clearRoles?: boolean
  oldMafiaMode?: boolean
  nightActions?: Partial<{
    mafia: number
    doctor: number
    sheriff: number
    don: number
  }>
  speakingQueue: number[]
}
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

/**
 * Host-controlled per-participant audio mix entry. Identity is normally the
 * stable `userId` (auth session); peerId is kept as a hint for clients that
 * apply via `setRemoteListenVolume`/`setRemoteListenMuted` keyed by peerId.
 * The server rebinds `peerId` to the current connection on join via
 * {@link Room.rebindMafiaAudioMixEntryPeerId} so reload preserves the entry.
 */
export type MafiaAudioMixEntry = {
  peerId: string
  userId: string | null
  volume: number
  muted: boolean
}

/**
 * Generic game-room (Phase 3A) audio mix entry. Same shape as
 * {@link MafiaAudioMixEntry} but kept as a distinct alias so future generic
 * evolution does not entangle with Mafia. The wire format is identical
 * because the client applies via the same call-core listening prefs.
 */
export type GameRoomAudioMixEntry = {
  peerId: string
  userId: string | null
  volume: number
  muted: boolean
}

/**
 * Eat First audio mix entry. Same shape as {@link MafiaAudioMixEntry} (the wire
 * format is identical because the client applies via the same call-core
 * listening prefs), kept as a distinct alias so Eat First state evolution does
 * not entangle with Mafia.
 */
export type EatFirstAudioMixEntry = {
  peerId: string
  userId: string | null
  volume: number
  muted: boolean
}

/** Generic game-room player life-state (Phase 3A). Mirrors Mafia’s subset
 * without the role-based `civilian` / `mafia` / `don` / `sheriff` / `doctor`
 * vocabulary, which is intentionally not part of the generic protocol. */
export type GameRoomPlayerLifeState = 'alive' | 'dead' | 'ghost'

/** Generic game-room players-update snapshot (Phase 3A). No nightActions,
 * clearRoles, or oldMafiaMode — those are Mafia-only. */
export type GameRoomPlayersUpdateSnapshot = {
  order: string[]
  speakingQueue: number[]
}

/** Generic game-room reshuffle snapshot (Phase 3A). No role assignment. */
export type GameRoomReshuffleSnapshot = {
  order: string[]
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
  
  private lastBroadcastSpeakerPeerId: string | null | undefined = undefined
  private silenceClearTimer: ReturnType<typeof setTimeout> | null = null
  /** Mafia “ведучий” — stable auth user id; not derived from transient peer lifecycle. */
  private mafiaHostUserId: string | null = null
  
  private mafiaHostSessionId: string | null = null
  
  private mafiaHostPeerId: string | null = null
  /** Shared Mafia speaking queue (1-based seat indices); host authorizes updates via signaling. */
  private mafiaSpeakingQueue: number[] = []
  /** Eat First call nomination queue (1-based display seats, pair-encoded); host sync via `eat:speaking-queue-update`. */
  private eatFirstSpeakingQueue: number[] = []
  
  private mafiaTimer: { startedAt: number; duration: number } | null = null
  /**
   * Live host-selected timer preset (ms). Independent of the running timer
   * — survives Start/Stop so the host's last picked idle duration persists
   * across cycles. Broadcast on every host pick via `mafia:timer-preset-select`
   * and replayed on join so OBS / late peers see the same idle value.
   */
  private mafiaSelectedTimerDurationMs: number | null = null
  private mafiaMode: 'old' | 'new' = 'old'
  private mafiaDeadBackgrounds: MafiaBackgroundItem[] = [...MAFIA_PRESET_BACKGROUND_ITEMS]
  private mafiaActiveBackgroundId: string | null = null
  private mafiaPageBackgrounds: MafiaPageBackgroundItem[] = [...MAFIA_PAGE_BACKGROUND_ITEMS]
  private mafiaForcedPageBackgroundId: string | null = null
  
  private mafiaPlayerLifeStateByPeerId = new Map<string, Exclude<MafiaPlayerLifeState, 'alive'>>()
  /**
   * Last `mafia:reshuffle` payload that the server accepted. Replayed only to
   * late-joiners when the snapshot still matches the live peer set 1:1.
   * Cleared when the room disposes (already handled by `finalizeRoomIfEmpty`),
   * or explicitly when a fresh reshuffle is accepted.
   */
  private mafiaReshuffleSnapshot: MafiaReshuffleSnapshot | null = null
  /**
   * Latest validated `mafia:players-update` payload. Replayed to late joiners
   * only when it still maps 1:1 to the current peer set.
   */
  private mafiaPlayersUpdateSnapshot: MafiaPlayersUpdateSnapshot | null = null
  /** Mafia nickname overrides (label only, host-controlled). */
  private mafiaNicknameByPeerId = new Map<string, string>()
  /**
   * Mafia host enforcement persistence. `Peer.forcedAudioMuted` /
   * `Peer.forcedCameraOff` reset on rejoin (new Peer object), so the room
   * remembers active force-state and re-applies on `handleJoinRoom`. Cleared
   * automatically on `peer-left`.
   *
   * `mafiaForceMuteAllActive` is room-wide (host's "mute all" toggle). The
   * two peerId sets persist per-peer enforcement applied as a side effect of
   * Mafia kill (kick) so a revive can lift the per-peer flag without
   * touching the room-wide toggle.
   */
  private mafiaForceMuteAllActive = false
  private mafiaForcedCameraOffPeerIds = new Set<string>()
  private mafiaForcedMicMutedPeerIds = new Set<string>()
  /**
   * Stable-identity mirror of the per-peer force sets, keyed by `Peer.userId`.
   * The peerId set above is per-tab (sessionStorage) and dies when the tab
   * closes; on `peer-left` the peerId entry is dropped so OBS / late joiners
   * do not see ghost paused state for a peer who is gone for good.
   *
   * The userId set persists across `peer-left` so a killed player who closes
   * the tab and rejoins (fresh peerId, same authenticated user) is re-flagged
   * before their fresh producers go live. Cleared on `mafia:player-revive` and
   * on reshuffle (the only legitimate "the kill is over" transitions). Anonymous
   * peers (no userId) are not added — the peerId set is the only enforcement,
   * so anonymous fresh-tab rejoin still loses the flag (acceptable: anonymous
   * identity is intentionally untrusted for cross-tab continuity).
   */
  private mafiaForcedCameraOffUserIds = new Set<string>()
  private mafiaForcedMicMutedUserIds = new Set<string>()
  /**
   * Host-controlled audio mix (volume + mute per remote tile). Two indexes:
   * `byUserId` is the stable identity used across reloads; `byPeerId` is the
   * fallback for unauthenticated peers. Update flow keeps them disjoint
   * (a peer with userId is only stored under `byUserId`). Snapshot is built
   * by walking both maps so the OBS view receives the latest state on join.
   */
  private mafiaAudioMixByUserId = new Map<string, MafiaAudioMixEntry>()
  private mafiaAudioMixByPeerId = new Map<string, MafiaAudioMixEntry>()

  // --- Generic game-room state (Phase 3A) ----------------------------------
  // Mirror of the GENERIC subset of Mafia state. Deliberately omits role
  // assignment, Mafia mode, dead-/page-background galleries. Only mutated by
  // `handleGameRoom*` handlers; Mafia handlers never touch these fields, and
  // vice versa. This protects both protocols from accidental coupling.
  private gameRoomHostUserId: string | null = null
  private gameRoomHostSessionId: string | null = null
  private gameRoomHostPeerId: string | null = null
  private gameRoomSpeakingQueue: number[] = []
  private gameRoomTimer: { startedAt: number; duration: number } | null = null
  /** Live host-selected timer preset (ms). Parallel of `mafiaSelectedTimerDurationMs`. */
  private gameRoomSelectedTimerDurationMs: number | null = null
  private gameRoomNicknameByPeerId = new Map<string, string>()
  private gameRoomForceMuteAllActive = false
  private gameRoomForcedCameraOffPeerIds = new Set<string>()
  private gameRoomForcedMicMutedPeerIds = new Set<string>()
  private gameRoomForcedCameraOffUserIds = new Set<string>()
  private gameRoomForcedMicMutedUserIds = new Set<string>()
  private gameRoomPlayerLifeStateByPeerId = new Map<string, Exclude<GameRoomPlayerLifeState, 'alive'>>()
  private gameRoomReshuffleSnapshot: GameRoomReshuffleSnapshot | null = null
  private gameRoomPlayersUpdateSnapshot: GameRoomPlayersUpdateSnapshot | null = null
  private gameRoomAudioMixByUserId = new Map<string, GameRoomAudioMixEntry>()
  private gameRoomAudioMixByPeerId = new Map<string, GameRoomAudioMixEntry>()

  // --- Eat First call state (audio-mix + host force-mute-all) -------------
  // Strict mirror of the Mafia audio-mix model above. `forceMuteAllActive` is
  // the server-authoritative host "mute all" toggle so it survives reload /
  // late-join and is re-broadcast via `eat:table-state-sync`.
  private eatFirstAudioMixByUserId = new Map<string, EatFirstAudioMixEntry>()
  private eatFirstAudioMixByPeerId = new Map<string, EatFirstAudioMixEntry>()
  private eatFirstForceMuteAllActive = false

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
    const threshold = envNumber('AUDIO_LEVEL_THRESHOLD', -70)
    const intervalMs = envNumber('AUDIO_LEVEL_INTERVAL_MS', 800)
    const silenceHoldMs = envNumber('AUDIO_SPEAKER_SILENCE_HOLD_MS', 1200)
    const observer = await this.router.createAudioLevelObserver({
      maxEntries: 1,
      threshold,
      interval: intervalMs,
    })
    this.audioLevelObserver = observer

    console.info(
      {
        roomId: this.id,
        threshold,
        intervalMs,
        silenceHoldMs,
      },
      'audio level observer created',
    )

    observer.on('volumes', (volumes: AudioLevelObserverVolume[]) => {
      this.onAudioVolumes(volumes)
    })

    observer.on('silence', () => {
      this.clearSilenceHoldTimer()
      this.silenceClearTimer = setTimeout(() => {
        this.silenceClearTimer = null
        this.emitActiveSpeakerIfChanged(null)
      }, silenceHoldMs)
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

  /**
   * Low-level peer removal: drop from the peers map and reset the active-speaker
   * latch when the leaver was the latched speaker.
   *
   * Note on Mafia per-peer state cleanup: this method intentionally does NOT
   * prune the room's `mafiaForcedCameraOffPeerIds` / `mafiaForcedMicMutedPeerIds`
   * /`mafiaPlayerLifeStateByPeerId` entries. Reload of the same peerId
   * (handled by `replaceDuplicatePeerId` in signaling) calls this method
   * for the old socket and we want the per-peer Mafia state to survive so
   * `handleJoinRoom` re-applies the flags onto the new `Peer` object.
   *
   * Genuine peer-left cleanup (the leaver is not coming back) is performed
   * by `removePeerFromNetwork` (signaling layer) which calls
   * {@link clearMafiaForceStateForPeer} and {@link clearMafiaPlayerLifeStateForPeer}
   * after the broadcasts.
   */
  removePeer(peerId: string): Peer | undefined {
    const peer = this.peers.get(peerId)
    if (!peer) {
      return undefined
    }
    this.peers.delete(peerId)
    if (this.lastBroadcastSpeakerPeerId === peerId) {
      this.emitActiveSpeakerIfChanged(null)
    }
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
    
    
    
    this.mafiaSpeakingQueue = [...seats]
  }

  /**
   * Drop seat indices greater than `maxSeat` from the speaking queue.
   * Returns `true` when the queue changed. Used on `peer-left` so the queue
   * never references a seat that can no longer have an active player.
   * The host's next `mafia:players-update` / `mafia:queue-update` will
   * republish the authoritative queue; this is a safety net for the interval
   * between peer-left and the host's update.
   */
  pruneMafiaSpeakingQueueToMaxSeat(maxSeat: number): boolean {
    const cap = Math.max(0, Math.floor(maxSeat))
    const before = this.mafiaSpeakingQueue
    const next = before.filter((seat) => seat >= 1 && seat <= cap)
    if (next.length === before.length) {
      return false
    }
    this.mafiaSpeakingQueue = next
    return true
  }

  getEatFirstSpeakingQueue(): number[] {
    return [...this.eatFirstSpeakingQueue]
  }

  setEatFirstSpeakingQueue(seats: number[]): void {
    this.eatFirstSpeakingQueue = [...seats]
  }

  /**
   * Drops out-of-range entries (e.g. after layout shrink). Returns true when the queue changed.
   */
  pruneEatFirstSpeakingQueueToMaxSeat(maxSeat: number): boolean {
    const cap = Math.max(0, Math.floor(maxSeat))
    const before = this.eatFirstSpeakingQueue
    const next = before.filter((seat) => seat >= 1 && seat <= cap)
    if (next.length === before.length) {
      return false
    }
    this.eatFirstSpeakingQueue = next
    return true
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

  getMafiaSelectedTimerDurationMs(): number | null {
    return this.mafiaSelectedTimerDurationMs
  }

  setMafiaSelectedTimerDurationMs(durationMs: number | null): void {
    this.mafiaSelectedTimerDurationMs =
      typeof durationMs === 'number' && Number.isFinite(durationMs)
        ? Math.floor(durationMs)
        : null
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

  /**
   * Drop the life-state entry for one peerId. Called from
   * `removePeerFromNetwork` on a genuine leave so OBS / late joiners do
   * not see "dead" overlays for peerIds that no longer exist in the room.
   * Same-peerId reload (`replaceDuplicatePeerId`) intentionally does NOT
   * call this — the killed peer should remain killed across reload.
   */
  clearMafiaPlayerLifeStateForPeer(peerId: string): void {
    this.mafiaPlayerLifeStateByPeerId.delete(peerId)
  }

  /**
   * Stash the most recent server-accepted reshuffle so a peer that joins
   * after the broadcast can still see role assignments. Caller must validate
   * the payload before storing — this does no schema/permutation check.
   */
  setMafiaReshuffleSnapshot(snapshot: MafiaReshuffleSnapshot | null): void {
    if (snapshot == null) {
      this.mafiaReshuffleSnapshot = null
      return
    }
    this.mafiaReshuffleSnapshot = {
      players: snapshot.players.map((p) => ({ peerId: p.peerId, seat: p.seat, role: p.role })),
    }
  }

  setMafiaPlayersUpdateSnapshot(snapshot: MafiaPlayersUpdateSnapshot | null): void {
    if (snapshot == null) {
      this.mafiaPlayersUpdateSnapshot = null
      return
    }
    this.mafiaPlayersUpdateSnapshot = {
      order: [...snapshot.order],
      speakingQueue: [...snapshot.speakingQueue],
      ...(snapshot.clearRoles === true ? { clearRoles: true } : {}),
      ...(typeof snapshot.oldMafiaMode === 'boolean' ? { oldMafiaMode: snapshot.oldMafiaMode } : {}),
      ...(snapshot.nightActions && typeof snapshot.nightActions === 'object'
        ? { nightActions: { ...snapshot.nightActions } }
        : {}),
    }
  }

  getMafiaPlayersUpdateSnapshotIfFresh(): MafiaPlayersUpdateSnapshot | null {
    const snap = this.mafiaPlayersUpdateSnapshot
    if (snap == null) return null
    const live = new Set(this.getPeers().map((p) => p.id))
    const snapIds = new Set(snap.order)
    const missingFromLive = snap.order.filter((id) => !live.has(id))
    /**
     * Audit: viewer-role peers (e.g. OBS view) join the same room but never
     * appear in the host-curated `order`. "Extra in live" is therefore the
     * normal case and must not invalidate the snapshot — only missing snap
     * peerIds matter (those slots can no longer be rendered).
     */
    if (missingFromLive.length === 0) {
      return {
        order: [...snap.order],
        speakingQueue: [...snap.speakingQueue],
        ...(snap.clearRoles === true ? { clearRoles: true } : {}),
        ...(typeof snap.oldMafiaMode === 'boolean' ? { oldMafiaMode: snap.oldMafiaMode } : {}),
        ...(snap.nightActions && typeof snap.nightActions === 'object' ? { nightActions: { ...snap.nightActions } } : {}),
      }
    }
    /**
     * Single-peer reconnect: one snapshot id vanished and exactly one new
     * non-snapshot peer is live. Remap to preserve the seat. Any larger drift
     * (multiple players left, or a viewer joined alongside a reconnect) skips
     * the replay so we never fabricate a seat assignment.
     */
    if (missingFromLive.length !== 1) {
      return null
    }
    const extraInLive = [...live].filter((id) => !snapIds.has(id))
    if (extraInLive.length !== 1) {
      return null
    }
    const staleId = missingFromLive[0]!
    const replacementId = extraInLive[0]!
    const remappedOrder = snap.order.map((id) => (id === staleId ? replacementId : id))
    return {
      order: remappedOrder,
      speakingQueue: [...snap.speakingQueue],
      ...(snap.clearRoles === true ? { clearRoles: true } : {}),
      ...(typeof snap.oldMafiaMode === 'boolean' ? { oldMafiaMode: snap.oldMafiaMode } : {}),
      ...(snap.nightActions && typeof snap.nightActions === 'object' ? { nightActions: { ...snap.nightActions } } : {}),
    }
  }

  setMafiaNickname(peerId: string, nickname: string | null): void {
    const id = peerId.trim()
    if (!id) return
    if (nickname == null || nickname.trim().length < 1) {
      this.mafiaNicknameByPeerId.delete(id)
      return
    }
    this.mafiaNicknameByPeerId.set(id, nickname.trim().slice(0, 64))
  }

  /** Snapshot filtered to the current live peers only. */
  getMafiaNicknamesSnapshot(): Record<string, string> {
    const live = new Set(this.getPeers().map((p) => p.id))
    const out: Record<string, string> = {}
    for (const [peerId, name] of this.mafiaNicknameByPeerId.entries()) {
      if (live.has(peerId) && name.trim().length > 0) {
        out[peerId] = name
      }
    }
    return out
  }

  /**
   * Returns the stored reshuffle snapshot when every snapshot peerId is still
   * live. Extra live peers are tolerated (viewer-role / OBS view never enter
   * the host's seat list); a single missing peer can be remapped if exactly
   * one new non-snapshot peer is online (single-peer reconnect path).
   */
  getMafiaReshuffleSnapshotIfFresh(): MafiaReshuffleSnapshot | null {
    const snap = this.mafiaReshuffleSnapshot
    if (snap == null) return null
    const live = new Set(this.getPeers().map((p) => p.id))
    const snapIds = new Set(snap.players.map((p) => p.peerId))
    const missingFromLive = snap.players.filter((entry) => !live.has(entry.peerId)).map((entry) => entry.peerId)
    if (missingFromLive.length === 0) {
      return {
        players: snap.players.map((p) => ({ peerId: p.peerId, seat: p.seat, role: p.role })),
      }
    }
    if (missingFromLive.length !== 1) {
      return null
    }
    const extraInLive = [...live].filter((id) => !snapIds.has(id))
    if (extraInLive.length !== 1) {
      return null
    }
    const staleId = missingFromLive[0]!
    const replacementId = extraInLive[0]!
    return {
      players: snap.players.map((p) => ({
        peerId: p.peerId === staleId ? replacementId : p.peerId,
        seat: p.seat,
        role: p.role,
      })),
    }
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

  isMafiaForceMuteAllActive(): boolean {
    return this.mafiaForceMuteAllActive
  }

  setMafiaForceMuteAllActive(active: boolean): void {
    this.mafiaForceMuteAllActive = active
  }

  isMafiaPeerForcedCameraOff(peerId: string): boolean {
    return this.mafiaForcedCameraOffPeerIds.has(peerId)
  }

  setMafiaPeerForcedCameraOff(peerId: string, forced: boolean): void {
    if (forced) {
      this.mafiaForcedCameraOffPeerIds.add(peerId)
    } else {
      this.mafiaForcedCameraOffPeerIds.delete(peerId)
    }
  }

  isMafiaPeerForcedMicMuted(peerId: string): boolean {
    return this.mafiaForcedMicMutedPeerIds.has(peerId)
  }

  setMafiaPeerForcedMicMuted(peerId: string, forced: boolean): void {
    if (forced) {
      this.mafiaForcedMicMutedPeerIds.add(peerId)
    } else {
      this.mafiaForcedMicMutedPeerIds.delete(peerId)
    }
  }

  /**
   * userId-keyed mirror lookups. Empty userId is never persisted, so a
   * lookup with an empty string always returns false; callers should still
   * fall through to the peerId-keyed check for anonymous peers.
   */
  isMafiaUserForcedCameraOff(userId: string): boolean {
    return userId.length > 0 && this.mafiaForcedCameraOffUserIds.has(userId)
  }

  setMafiaUserForcedCameraOff(userId: string, forced: boolean): void {
    if (userId.length === 0) return
    if (forced) {
      this.mafiaForcedCameraOffUserIds.add(userId)
    } else {
      this.mafiaForcedCameraOffUserIds.delete(userId)
    }
  }

  isMafiaUserForcedMicMuted(userId: string): boolean {
    return userId.length > 0 && this.mafiaForcedMicMutedUserIds.has(userId)
  }

  setMafiaUserForcedMicMuted(userId: string, forced: boolean): void {
    if (userId.length === 0) return
    if (forced) {
      this.mafiaForcedMicMutedUserIds.add(userId)
    } else {
      this.mafiaForcedMicMutedUserIds.delete(userId)
    }
  }

  /** Snapshot copies — callers iterate without mutating the live sets. */
  getMafiaForcedCameraOffPeerIds(): string[] {
    return [...this.mafiaForcedCameraOffPeerIds]
  }

  getMafiaForcedMicMutedPeerIds(): string[] {
    return [...this.mafiaForcedMicMutedPeerIds]
  }

  /**
   * Reshuffle / new game: drop every per-peer Mafia kill enforcement flag,
   * including the stable userId mirror. This is the only place we wipe the
   * userId sets in bulk — it matches the semantic of `clearAllMafiaPerPeerForceFlags`'s
   * sole caller (`handleMafiaReshuffle`).
   */
  clearAllMafiaPerPeerForceFlags(): void {
    this.mafiaForcedCameraOffPeerIds.clear()
    this.mafiaForcedMicMutedPeerIds.clear()
    this.mafiaForcedCameraOffUserIds.clear()
    this.mafiaForcedMicMutedUserIds.clear()
  }

  /**
   * Genuine `peer-left`: drop only the per-peer (peerId) entries. The userId
   * mirror is preserved so a killed player who reconnects with a fresh peerId
   * (tab close + new tab; network drop + new socket) is re-flagged on join
   * via `isMafiaUserForcedCameraOff` / `isMafiaUserForcedMicMuted`.
   *
   * Mafia revive is the explicit "kill is over" gate that clears the userId
   * mirror; see `clearMafiaForceStateForUser`.
   */
  clearMafiaForceStateForPeer(peerId: string): void {
    this.mafiaForcedCameraOffPeerIds.delete(peerId)
    this.mafiaForcedMicMutedPeerIds.delete(peerId)
  }

  /**
   * Mafia revive: drop the userId mirror entry so a future fresh-tab rejoin
   * is no longer auto-flagged. Caller is also responsible for the peerId-set
   * cleanup via `setMafiaPeerForcedCameraOff(peerId, false)` /
   * `setMafiaPeerForcedMicMuted(peerId, false)` for the currently-live peerId.
   */
  clearMafiaForceStateForUser(userId: string): void {
    if (userId.length === 0) return
    this.mafiaForcedCameraOffUserIds.delete(userId)
    this.mafiaForcedMicMutedUserIds.delete(userId)
  }

  /**
   * Apply incoming host-validated audio-mix deltas. Returns the resolved entries
   * (with normalized peerId/userId/volume/muted) so the caller can rebroadcast
   * the same shape the client will apply.
   */
  applyMafiaAudioMixEntries(
    entries: ReadonlyArray<{ peerId: string; userId?: string | null; volume: number; muted: boolean }>,
  ): MafiaAudioMixEntry[] {
    const out: MafiaAudioMixEntry[] = []
    for (const raw of entries) {
      const peerId = typeof raw.peerId === 'string' ? raw.peerId.trim() : ''
      if (!peerId) continue
      const userIdRaw = typeof raw.userId === 'string' ? raw.userId.trim() : ''
      const userId = userIdRaw.length > 0 ? userIdRaw : null
      const volumeRaw = typeof raw.volume === 'number' && Number.isFinite(raw.volume) ? raw.volume : 1
      const volume = Math.min(2, Math.max(0, volumeRaw))
      const muted = raw.muted === true
      const entry: MafiaAudioMixEntry = { peerId, userId, volume, muted }
      if (userId != null) {
        this.mafiaAudioMixByUserId.set(userId, entry)
        this.mafiaAudioMixByPeerId.delete(peerId)
      } else {
        this.mafiaAudioMixByPeerId.set(peerId, entry)
      }
      out.push(entry)
    }
    return out
  }

  /**
   * On peer-joined, rebind any userId-keyed entry to the new peerId so the
   * client can apply by current peerId without a fresh host action. No-op when
   * the peer has no userId or no entry exists.
   */
  rebindMafiaAudioMixEntryPeerId(peerId: string, userId: string): MafiaAudioMixEntry | null {
    const trimmedPeer = peerId.trim()
    const trimmedUser = userId.trim()
    if (!trimmedPeer || !trimmedUser) return null
    const prev = this.mafiaAudioMixByUserId.get(trimmedUser)
    if (!prev) return null
    if (prev.peerId === trimmedPeer) return prev
    const next: MafiaAudioMixEntry = { ...prev, peerId: trimmedPeer }
    this.mafiaAudioMixByUserId.set(trimmedUser, next)
    return next
  }

  getMafiaAudioMixSnapshot(): MafiaAudioMixEntry[] {
    const out: MafiaAudioMixEntry[] = []
    for (const e of this.mafiaAudioMixByUserId.values()) {
      out.push({ ...e })
    }
    for (const e of this.mafiaAudioMixByPeerId.values()) {
      out.push({ ...e })
    }
    return out
  }

  /**
   * Genuine `peer-left` cleanup for audio-mix entries indexed by peerId only.
   * The `byUserId` mirror is intentionally preserved across peer-left so a
   * reload (new peerId, same userId) keeps the host's prior mix without a
   * fresh slider drag — `rebindMafiaAudioMixEntryPeerId` re-points it on the
   * next join.
   *
   * Without this prune, the `byPeerId` Map accumulated stale entries for
   * anonymous peers across long sessions, and `getMafiaAudioMixSnapshot`
   * (which does NOT filter by live peers) replayed them to every late-joining
   * OBS view — bloating each snapshot reply with dead peerIds.
   */
  clearMafiaAudioMixForPeerId(peerId: string): void {
    const id = peerId.trim()
    if (!id) return
    this.mafiaAudioMixByPeerId.delete(id)
  }

  /**
   * Genuine `peer-left` cleanup for the nickname Map. The
   * `getMafiaNicknamesSnapshot` getter already filters by live peers, so
   * stale entries did not bloat snapshot replies — but they sat in memory
   * indefinitely. This drops the underlying Map entry for cleanliness so the
   * Map size matches the live peer set.
   */
  clearMafiaNicknameForPeer(peerId: string): void {
    const id = peerId.trim()
    if (!id) return
    this.mafiaNicknameByPeerId.delete(id)
  }

  // ─── Generic game-room (Phase 3A) accessors ───────────────────────────────
  // Parallel of every Mafia getter/setter that the generic protocol needs.
  // Methods named `getGameRoom*` / `setGameRoom*` / `isGameRoom*` strictly
  // mirror the Mafia equivalents; the only diffs are: no role / mode /
  // background fields, no Mafia-specific snapshot fields inside
  // players-update / reshuffle, no MAFIA_PRESET_BACKGROUND seeding. Mafia
  // accessors above are unmodified.

  getGameRoomHostUserId(): string | null {
    return this.gameRoomHostUserId
  }

  setGameRoomHostUserId(id: string | null): void {
    this.gameRoomHostUserId = id
  }

  getGameRoomHostSessionId(): string | null {
    return this.gameRoomHostSessionId
  }

  setGameRoomHostSessionId(id: string | null): void {
    this.gameRoomHostSessionId = id
  }

  getGameRoomHostPeerId(): string | null {
    return this.gameRoomHostPeerId
  }

  setGameRoomHostPeerId(id: string | null): void {
    this.gameRoomHostPeerId = id
  }

  getFirstGameRoomSessionIdForUser(userId: string): string | null {
    return (
      this.getPeers().find(
        (peer) => peer.userId === userId && peer.gameRoomSessionId.length > 0,
      )?.gameRoomSessionId ?? null
    )
  }

  getFirstGameRoomPeerIdForUserSession(userId: string, sessionId: string | null): string | null {
    if (sessionId == null) {
      return null
    }
    return (
      this.getPeers().find(
        (peer) => peer.userId === userId && peer.gameRoomSessionId === sessionId,
      )?.id ?? null
    )
  }

  getGameRoomSpeakingQueue(): number[] {
    return [...this.gameRoomSpeakingQueue]
  }

  setGameRoomSpeakingQueue(seats: number[]): void {
    this.gameRoomSpeakingQueue = [...seats]
  }

  /**
   * Drop seat indices greater than `maxSeat`. Mirrors
   * {@link pruneMafiaSpeakingQueueToMaxSeat} semantics 1:1. Returns true
   * when the queue changed.
   */
  pruneGameRoomSpeakingQueueToMaxSeat(maxSeat: number): boolean {
    const cap = Math.max(0, Math.floor(maxSeat))
    const before = this.gameRoomSpeakingQueue
    const next = before.filter((seat) => seat >= 1 && seat <= cap)
    if (next.length === before.length) {
      return false
    }
    this.gameRoomSpeakingQueue = next
    return true
  }

  getGameRoomTimer(): { startedAt: number; duration: number; isRunning: true } | null {
    if (this.gameRoomTimer == null) {
      return null
    }
    return { ...this.gameRoomTimer, isRunning: true as const }
  }

  setGameRoomTimer(t: { startedAt: number; duration: number } | null): void {
    this.gameRoomTimer = t
  }

  getGameRoomSelectedTimerDurationMs(): number | null {
    return this.gameRoomSelectedTimerDurationMs
  }

  setGameRoomSelectedTimerDurationMs(durationMs: number | null): void {
    this.gameRoomSelectedTimerDurationMs =
      typeof durationMs === 'number' && Number.isFinite(durationMs)
        ? Math.floor(durationMs)
        : null
  }

  getGameRoomPlayerLifeStateSnapshot(): Record<string, GameRoomPlayerLifeState> {
    return Object.fromEntries(this.gameRoomPlayerLifeStateByPeerId.entries())
  }

  setGameRoomPlayerLifeState(peerId: string, lifeState: GameRoomPlayerLifeState): void {
    if (lifeState === 'alive') {
      this.gameRoomPlayerLifeStateByPeerId.delete(peerId)
      return
    }
    this.gameRoomPlayerLifeStateByPeerId.set(peerId, lifeState)
  }

  clearGameRoomPlayerLifeStates(): void {
    this.gameRoomPlayerLifeStateByPeerId.clear()
  }

  clearGameRoomPlayerLifeStateForPeer(peerId: string): void {
    this.gameRoomPlayerLifeStateByPeerId.delete(peerId)
  }

  setGameRoomReshuffleSnapshot(snapshot: GameRoomReshuffleSnapshot | null): void {
    if (snapshot == null) {
      this.gameRoomReshuffleSnapshot = null
      return
    }
    this.gameRoomReshuffleSnapshot = {
      order: [...snapshot.order],
    }
  }

  setGameRoomPlayersUpdateSnapshot(snapshot: GameRoomPlayersUpdateSnapshot | null): void {
    if (snapshot == null) {
      this.gameRoomPlayersUpdateSnapshot = null
      return
    }
    this.gameRoomPlayersUpdateSnapshot = {
      order: [...snapshot.order],
      speakingQueue: [...snapshot.speakingQueue],
    }
  }

  /**
   * Returns the stored game-room players-update snapshot when every snapshot
   * peerId is still live. Extra live peers are tolerated (viewer-role / OBS
   * view never enter the host's seat list). Same single-peer-reconnect
   * remap behaviour as {@link getMafiaPlayersUpdateSnapshotIfFresh}.
   */
  getGameRoomPlayersUpdateSnapshotIfFresh(): GameRoomPlayersUpdateSnapshot | null {
    const snap = this.gameRoomPlayersUpdateSnapshot
    if (snap == null) return null
    const live = new Set(this.getPeers().map((p) => p.id))
    const snapIds = new Set(snap.order)
    const missingFromLive = snap.order.filter((id) => !live.has(id))
    if (missingFromLive.length === 0) {
      return {
        order: [...snap.order],
        speakingQueue: [...snap.speakingQueue],
      }
    }
    if (missingFromLive.length !== 1) {
      return null
    }
    const extraInLive = [...live].filter((id) => !snapIds.has(id))
    if (extraInLive.length !== 1) {
      return null
    }
    const staleId = missingFromLive[0]!
    const replacementId = extraInLive[0]!
    const remappedOrder = snap.order.map((id) => (id === staleId ? replacementId : id))
    return {
      order: remappedOrder,
      speakingQueue: [...snap.speakingQueue],
    }
  }

  getGameRoomReshuffleSnapshotIfFresh(): GameRoomReshuffleSnapshot | null {
    const snap = this.gameRoomReshuffleSnapshot
    if (snap == null) return null
    const live = new Set(this.getPeers().map((p) => p.id))
    const snapIds = new Set(snap.order)
    const missingFromLive = snap.order.filter((id) => !live.has(id))
    if (missingFromLive.length === 0) {
      return { order: [...snap.order] }
    }
    if (missingFromLive.length !== 1) {
      return null
    }
    const extraInLive = [...live].filter((id) => !snapIds.has(id))
    if (extraInLive.length !== 1) {
      return null
    }
    const staleId = missingFromLive[0]!
    const replacementId = extraInLive[0]!
    return {
      order: snap.order.map((id) => (id === staleId ? replacementId : id)),
    }
  }

  setGameRoomNickname(peerId: string, nickname: string | null): void {
    const id = peerId.trim()
    if (!id) return
    if (nickname == null || nickname.trim().length < 1) {
      this.gameRoomNicknameByPeerId.delete(id)
      return
    }
    this.gameRoomNicknameByPeerId.set(id, nickname.trim().slice(0, 64))
  }

  getGameRoomNicknamesSnapshot(): Record<string, string> {
    const live = new Set(this.getPeers().map((p) => p.id))
    const out: Record<string, string> = {}
    for (const [peerId, name] of this.gameRoomNicknameByPeerId.entries()) {
      if (live.has(peerId) && name.trim().length > 0) {
        out[peerId] = name
      }
    }
    return out
  }

  clearGameRoomNicknameForPeer(peerId: string): void {
    const id = peerId.trim()
    if (!id) return
    this.gameRoomNicknameByPeerId.delete(id)
  }

  isGameRoomForceMuteAllActive(): boolean {
    return this.gameRoomForceMuteAllActive
  }

  setGameRoomForceMuteAllActive(active: boolean): void {
    this.gameRoomForceMuteAllActive = active
  }

  isGameRoomPeerForcedCameraOff(peerId: string): boolean {
    return this.gameRoomForcedCameraOffPeerIds.has(peerId)
  }

  setGameRoomPeerForcedCameraOff(peerId: string, forced: boolean): void {
    if (forced) {
      this.gameRoomForcedCameraOffPeerIds.add(peerId)
    } else {
      this.gameRoomForcedCameraOffPeerIds.delete(peerId)
    }
  }

  isGameRoomPeerForcedMicMuted(peerId: string): boolean {
    return this.gameRoomForcedMicMutedPeerIds.has(peerId)
  }

  setGameRoomPeerForcedMicMuted(peerId: string, forced: boolean): void {
    if (forced) {
      this.gameRoomForcedMicMutedPeerIds.add(peerId)
    } else {
      this.gameRoomForcedMicMutedPeerIds.delete(peerId)
    }
  }

  isGameRoomUserForcedCameraOff(userId: string): boolean {
    return userId.length > 0 && this.gameRoomForcedCameraOffUserIds.has(userId)
  }

  setGameRoomUserForcedCameraOff(userId: string, forced: boolean): void {
    if (userId.length === 0) return
    if (forced) {
      this.gameRoomForcedCameraOffUserIds.add(userId)
    } else {
      this.gameRoomForcedCameraOffUserIds.delete(userId)
    }
  }

  isGameRoomUserForcedMicMuted(userId: string): boolean {
    return userId.length > 0 && this.gameRoomForcedMicMutedUserIds.has(userId)
  }

  setGameRoomUserForcedMicMuted(userId: string, forced: boolean): void {
    if (userId.length === 0) return
    if (forced) {
      this.gameRoomForcedMicMutedUserIds.add(userId)
    } else {
      this.gameRoomForcedMicMutedUserIds.delete(userId)
    }
  }

  getGameRoomForcedCameraOffPeerIds(): string[] {
    return [...this.gameRoomForcedCameraOffPeerIds]
  }

  getGameRoomForcedMicMutedPeerIds(): string[] {
    return [...this.gameRoomForcedMicMutedPeerIds]
  }

  clearAllGameRoomPerPeerForceFlags(): void {
    this.gameRoomForcedCameraOffPeerIds.clear()
    this.gameRoomForcedMicMutedPeerIds.clear()
    this.gameRoomForcedCameraOffUserIds.clear()
    this.gameRoomForcedMicMutedUserIds.clear()
  }

  clearGameRoomForceStateForPeer(peerId: string): void {
    this.gameRoomForcedCameraOffPeerIds.delete(peerId)
    this.gameRoomForcedMicMutedPeerIds.delete(peerId)
  }

  clearGameRoomForceStateForUser(userId: string): void {
    if (userId.length === 0) return
    this.gameRoomForcedCameraOffUserIds.delete(userId)
    this.gameRoomForcedMicMutedUserIds.delete(userId)
  }

  applyGameRoomAudioMixEntries(
    entries: ReadonlyArray<{ peerId: string; userId?: string | null; volume: number; muted: boolean }>,
  ): GameRoomAudioMixEntry[] {
    const out: GameRoomAudioMixEntry[] = []
    for (const raw of entries) {
      const peerId = typeof raw.peerId === 'string' ? raw.peerId.trim() : ''
      if (!peerId) continue
      const userIdRaw = typeof raw.userId === 'string' ? raw.userId.trim() : ''
      const userId = userIdRaw.length > 0 ? userIdRaw : null
      const volumeRaw = typeof raw.volume === 'number' && Number.isFinite(raw.volume) ? raw.volume : 1
      const volume = Math.min(2, Math.max(0, volumeRaw))
      const muted = raw.muted === true
      const entry: GameRoomAudioMixEntry = { peerId, userId, volume, muted }
      if (userId != null) {
        this.gameRoomAudioMixByUserId.set(userId, entry)
        this.gameRoomAudioMixByPeerId.delete(peerId)
      } else {
        this.gameRoomAudioMixByPeerId.set(peerId, entry)
      }
      out.push(entry)
    }
    return out
  }

  rebindGameRoomAudioMixEntryPeerId(peerId: string, userId: string): GameRoomAudioMixEntry | null {
    const trimmedPeer = peerId.trim()
    const trimmedUser = userId.trim()
    if (!trimmedPeer || !trimmedUser) return null
    const prev = this.gameRoomAudioMixByUserId.get(trimmedUser)
    if (!prev) return null
    if (prev.peerId === trimmedPeer) return prev
    const next: GameRoomAudioMixEntry = { ...prev, peerId: trimmedPeer }
    this.gameRoomAudioMixByUserId.set(trimmedUser, next)
    return next
  }

  getGameRoomAudioMixSnapshot(): GameRoomAudioMixEntry[] {
    const out: GameRoomAudioMixEntry[] = []
    for (const e of this.gameRoomAudioMixByUserId.values()) {
      out.push({ ...e })
    }
    for (const e of this.gameRoomAudioMixByPeerId.values()) {
      out.push({ ...e })
    }
    return out
  }

  clearGameRoomAudioMixForPeerId(peerId: string): void {
    const id = peerId.trim()
    if (!id) return
    this.gameRoomAudioMixByPeerId.delete(id)
  }

  // ─── Eat First audio-mix + force-mute-all accessors ─────────────────────
  // Strict mirror of the Mafia equivalents above. Wire format and semantics
  // (clamps, userId preference, byPeerId fallback, peer-left cleanup, rebind
  // on rejoin) match exactly so the OBS view applies via the same call-core
  // listening prefs without a new code path.

  applyEatFirstAudioMixEntries(
    entries: ReadonlyArray<{ peerId: string; userId?: string | null; volume: number; muted: boolean }>,
  ): EatFirstAudioMixEntry[] {
    const out: EatFirstAudioMixEntry[] = []
    for (const raw of entries) {
      const peerId = typeof raw.peerId === 'string' ? raw.peerId.trim() : ''
      if (!peerId) continue
      const userIdRaw = typeof raw.userId === 'string' ? raw.userId.trim() : ''
      const userId = userIdRaw.length > 0 ? userIdRaw : null
      const volumeRaw = typeof raw.volume === 'number' && Number.isFinite(raw.volume) ? raw.volume : 1
      const volume = Math.min(2, Math.max(0, volumeRaw))
      const muted = raw.muted === true
      const entry: EatFirstAudioMixEntry = { peerId, userId, volume, muted }
      if (userId != null) {
        this.eatFirstAudioMixByUserId.set(userId, entry)
        this.eatFirstAudioMixByPeerId.delete(peerId)
      } else {
        this.eatFirstAudioMixByPeerId.set(peerId, entry)
      }
      out.push(entry)
    }
    return out
  }

  rebindEatFirstAudioMixEntryPeerId(peerId: string, userId: string): EatFirstAudioMixEntry | null {
    const trimmedPeer = peerId.trim()
    const trimmedUser = userId.trim()
    if (!trimmedPeer || !trimmedUser) return null
    const prev = this.eatFirstAudioMixByUserId.get(trimmedUser)
    if (!prev) return null
    if (prev.peerId === trimmedPeer) return prev
    const next: EatFirstAudioMixEntry = { ...prev, peerId: trimmedPeer }
    this.eatFirstAudioMixByUserId.set(trimmedUser, next)
    return next
  }

  getEatFirstAudioMixSnapshot(): EatFirstAudioMixEntry[] {
    const out: EatFirstAudioMixEntry[] = []
    for (const e of this.eatFirstAudioMixByUserId.values()) {
      out.push({ ...e })
    }
    for (const e of this.eatFirstAudioMixByPeerId.values()) {
      out.push({ ...e })
    }
    return out
  }

  clearEatFirstAudioMixForPeerId(peerId: string): void {
    const id = peerId.trim()
    if (!id) return
    this.eatFirstAudioMixByPeerId.delete(id)
  }

  getEatFirstForceMuteAllActive(): boolean {
    return this.eatFirstForceMuteAllActive
  }

  setEatFirstForceMuteAllActive(active: boolean): void {
    this.eatFirstForceMuteAllActive = active === true
  }
}
