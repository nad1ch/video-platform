import WebSocket from 'ws'
import type { WebSocket as WsSocket } from 'ws'
import type {
  Consumer,
  DtlsParameters,
  IceCandidate,
  IceParameters,
  MediaKind,
  Producer,
  RtpCapabilities,
  RtpParameters,
  WebRtcTransport,
} from 'mediasoup/types'
import {
  getClientIceServersFromEnv,
  getIceTransportPolicyFromEnv,
  type ClientIceServer,
} from '../config/clientIceServers'
import { createWebRtcTransport } from '../mediasoup/createWebRtcTransport'
import { Peer } from '../peers/Peer'
import type {
  GameRoomAudioMixEntry,
  GameRoomPlayerLifeState,
  MafiaAudioMixEntry,
  MafiaBackgroundItem,
  MafiaPageBackgroundItem,
  MafiaPlayerLifeState,
  Room,
} from '../rooms/Room'
import type { RoomManager } from '../rooms/RoomManager'
import {
  getMafiaRoomOwnerUserId,
  setMafiaRoomOwnerUserId,
} from './mafiaRoomOwnerStore'
import {
  getGameRoomOwnerUserId,
  setGameRoomOwnerUserId,
} from './gameRoomOwnerStore'
import { MafiaWs } from './mafiaWsProtocol'
import { GameRoomWs } from './gameRoomWsProtocol'
import {
  EAT_FIRST_ROOM_PREFIX,
  GAME_ROOM_MAX_SEAT,
  MAFIA_MAX_SEAT,
  isGameRoomId,
  isMafiaRoomId,
  isEatFirstRoomId,
  sanitizeAvatarUrl,
  sanitizeDisplayName,
  sanitizeEatFirstSpeakingQueueList,
  sanitizeGameRoomSpeakingQueueList,
  sanitizeMafiaSpeakingQueueList,
  sanitizeSessionId,
  sanitizeUserId,
} from './signalingHelpers'
import {
  eatFirstAdminPatchForFullCharacterDeal,
  eatFirstHostReshuffleAdmin,
  eatFirstMergePlayerAdmin,
  eatFirstMergeRoomAdmin,
  eatFirstPlayerSlotRowExists,
  verifyEatFirstSlotAuth,
  type SlotAuthResult,
} from '../eatFirst/service'
import { isEatFirstPlayerSlotId } from '../eatFirst/playerOrder'
import { normalizeEatFirstSlot } from '../eatFirst/slot'
import {
  pickRandomEatFirstActiveCard,
  type EatFirstActiveCardSnapshot,
} from '../eatFirst/activeCards'
import {
  applyEatFirstTraitReveal,
  applyEatFirstTraitReroll,
  applyEatFirstTraitTypeReroll,
  assignEatFirstSlotsToUnclaimedPeers,
  buildEatFirstTableSyncPayload,
  disposeEatFirstOwnerUserId,
  disposeEatFirstTableState,
  eatFirstActiveSlotsForRoom,
  getEatFirstOwnerUserId,
  getEatFirstTableState,
  getHydratedEatFirstTableState,
  hydrateEatFirstOwnerUserIdFromDb,
  hydrateEatFirstTableStateFromDb,
  persistEatFirstCallSignalingSnapshot,
  resetEatFirstTableRoundDealConsumables,
  resolveEatFirstHostPeerId,
  setEatFirstActionCard,
  setEatFirstActionCardUsed,
  setEatFirstPlayerOrder,
  setEatFirstTimer,
  type EatFirstTableSyncPayload,
} from '../eatFirst/tableState'
import {
  EAT_FIRST_TRAIT_KEYS,
  pickEatFirstTraitValue,
  type EatFirstTraitKey,
} from '../eatFirst/randomPools'

export { clientMessageSchema, type ClientMessage } from './clientMessageSchema'

export type TransportOptionsPayload = {
  id: string
  iceParameters: IceParameters
  iceCandidates: IceCandidate[]
  dtlsParameters: DtlsParameters
  
  iceServers?: ClientIceServer[]
  iceTransportPolicy?: 'relay' | 'all'
}

export type ExistingProducerInfo = {
  producerId: string
  peerId: string
  kind: MediaKind
  /** When `kind === 'video'`: what `replaceTrack` is showing (signaling-only). */
  videoSource?: 'camera' | 'screen'
  /** mediasoup producer paused (camera off, not screen); clients hide frozen frames vs track heuristics. */
  outboundVideoPaused?: boolean
}

export type RoomPeerInfo = {
  peerId: string
  displayName: string
  
  userId?: string
  
  avatarUrl?: string
  
  audioMuted?: boolean
}

export type ServerMessage =
  | {
      type: 'room-state'
      payload: {
        peers: RoomPeerInfo[]
        routerRtpCapabilities: RtpCapabilities
        existingProducers: ExistingProducerInfo[]
      }
    }
  | { type: 'peer-joined'; payload: { peerId: string; displayName: string; userId?: string; avatarUrl?: string } }
  | { type: 'peer-display-name'; payload: { peerId: string; displayName: string } }
  | { type: 'peer-left'; payload: { peerId: string } }
  | { type: 'peer-audio-muted'; payload: { peerId: string; muted: boolean } }
  | {
      type: 'transport-created'
      payload: { direction: 'send' | 'recv'; transportOptions: TransportOptionsPayload }
    }
  | { type: 'transport-connected'; payload: { transportId: string } }
  | { type: 'produced'; payload: { id: string; requestId: string } }
  | {
      type: 'new-producer'
      payload: {
        producerId: string
        peerId: string
        kind: MediaKind
        videoSource?: 'camera' | 'screen'
      }
    }
  | {
      type: 'producer-closed'
      payload: { producerId: string; peerId: string; kind: MediaKind }
    }
  | {
      type: 'producer-video-source-changed'
      payload: { producerId: string; peerId: string; source: 'camera' | 'screen' }
    }
  | { type: 'peer-outbound-video-paused'; payload: { peerId: string; paused: boolean } }
  | {
      type: 'consumed'
      payload: {
        id: string
        producerId: string
        kind: MediaKind
        rtpParameters: RtpParameters
      }
    }
  | {
      type: 'producer-sync'
      payload: {
        producers: ExistingProducerInfo[]
        /** Other peers in room (excl. recipient): display + avatar for UI resync with producer list. */
        peers?: RoomPeerInfo[]
        /** `client-refresh` = tab woke / explicit resync; recv transport may still be connected. */
        syncReason?: 'recv-connected' | 'client-refresh'
      }
    }
  | { type: 'consume-failed'; payload: { producerId: string; reason: string } }
  | { type: 'active-speaker'; payload: { peerId: string | null } }
  | { type: 'server-pong'; payload: Record<string, never> }
  | { type: 'signaling-auth'; payload: { userId: string | null } }
  | { type: 'mafia:host-updated'; payload: { hostPeerId: string | null; hostUserId: string | null; hostSessionId: string | null } }
  | { type: 'mafia:queue-update'; payload: { speakingQueue: number[] } }
  | { type: 'mafia:mode-update'; payload: { mode: 'old' | 'new' } }
  | {
      type: 'mafia:settings-update'
      payload: { deadBackgrounds: MafiaBackgroundItem[]; activeBackgroundId: string | null }
    }
  | {
      type: 'mafia:page-background-settings'
      payload: {
        backgrounds: MafiaPageBackgroundItem[]
        selectedBackgroundId: string | null
        forcedBackgroundId: string | null
      }
    }
  | {
      type: 'mafia:reshuffle'
      payload: {
        players: Array<{
          peerId: string
          seat: number
          role: 'mafia' | 'don' | 'sheriff' | 'doctor' | 'civilian' | null
        }>
      }
    }
  | {
      type: 'mafia:players-update'
      payload: {
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
    }
  | { type: 'mafia:player-nickname-update'; payload: { peerId: string; displayName: string } }
  | { type: 'mafia:audio-mix-update'; payload: { entries: MafiaAudioMixEntry[] } }
  | { type: 'mafia:timer-start'; payload: { startedAt: number; duration: number; isRunning: boolean } }
  | { type: 'mafia:timer-stop'; payload: Record<string, never> }
  | { type: 'mafia:player-kick'; payload: { peerId: string } }
  | { type: 'mafia:player-revive'; payload: { peerId: string } }
  | { type: 'mafia:player-life-state'; payload: { states: Record<string, MafiaPlayerLifeState> } }
  | { type: 'mafia:force-camera-off'; payload: { peerId: string; paused?: boolean } }
  | { type: 'mafia:force-mute-all'; payload: { muted?: boolean } }
  | { type: 'mafia:force-peer-mic'; payload: { peerId: string; muted: boolean } }
  // ─── Generic game-room (Phase 3A) ───────────────────────────────────────
  // Server → client variants. Wire format mirrors the Mafia subset minus
  // role / mode / background-gallery fields. The generic protocol does not
  // emit `mafia:mode-update`, `mafia:settings-update`,
  // `mafia:page-background-settings`, and never carries a `role` inside
  // reshuffle or `nightActions`/`clearRoles`/`oldMafiaMode` inside
  // players-update.
  | { type: 'gameroom:host-updated'; payload: { hostPeerId: string | null; hostUserId: string | null; hostSessionId: string | null } }
  | { type: 'gameroom:queue-update'; payload: { speakingQueue: number[] } }
  | { type: 'gameroom:reshuffle'; payload: { order: string[] } }
  | { type: 'gameroom:players-update'; payload: { order: string[]; speakingQueue: number[] } }
  | { type: 'gameroom:player-nickname-update'; payload: { peerId: string; displayName: string } }
  | { type: 'gameroom:audio-mix-update'; payload: { entries: GameRoomAudioMixEntry[] } }
  | { type: 'gameroom:timer-start'; payload: { startedAt: number; duration: number; isRunning: boolean } }
  | { type: 'gameroom:timer-stop'; payload: Record<string, never> }
  | { type: 'gameroom:player-kick'; payload: { peerId: string } }
  | { type: 'gameroom:player-revive'; payload: { peerId: string } }
  | { type: 'gameroom:player-life-state'; payload: { states: Record<string, GameRoomPlayerLifeState> } }
  | { type: 'gameroom:force-camera-off'; payload: { peerId: string; paused?: boolean } }
  | { type: 'gameroom:force-mute-all'; payload: { muted?: boolean } }
  | { type: 'gameroom:force-peer-mic'; payload: { peerId: string; muted: boolean } }
  | { type: 'eat:host-updated'; payload: { hostPeerId: string | null } }
  | { type: 'eat:speaking-queue-update'; payload: { speakingQueue: number[] } }
  | { type: 'eat:force-mute-all'; payload: { muted?: boolean } }
  | {
      type: 'eat:trait-revealed'
      payload: {
        slotId: string
        traitKey: EatFirstTraitKey
        openedBy: 'player' | 'host'
        /** When true the trait was hidden again. Mirrors the open path so clients can run a single shared handler. */
        closed?: boolean
      }
    }
  | { type: 'eat:trait-regenerated'; payload: { slotId: string; traitKey: EatFirstTraitKey; value: string } }
  | {
      /** Whole-table reroll of one trait type. `valuesBySlot` is the new override per slot. */
      type: 'eat:trait-type-rerolled'
      payload: { traitKey: EatFirstTraitKey; valuesBySlot: Record<string, string> }
    }
  | {
      type: 'eat:action-card-rerolled'
      payload: { slotId: string; card: EatFirstActiveCardSnapshot }
    }
  | {
      type: 'eat:action-card-used'
      payload: { slotId: string; title: string; peerId: string }
    }
  | {
      type: 'eat:trait-state-sync'
      payload: {
        /** slotId → trait keys revealed (visible to every viewer). */
        revealedBySlot: Record<string, EatFirstTraitKey[]>
        /** slotId → trait values that overrode the snapshot value (host rerolls). */
        overridesBySlot: Record<string, Partial<Record<EatFirstTraitKey, string>>>
        /** slotId → trait keys opened by the player (yellow highlight rule). */
        openedBySlot: Record<string, EatFirstTraitKey[]>
        /**
         * peerId → Eat First slot (`p1..p11`) the peer claimed via `eat:slot-claim`.
         * Authoritative identity for trait/action-card lookups; missing entries
         * mean the peer is a viewer/host (no slot). Refreshed on every join/leave
         * and on every successful slot-claim.
         */
        slotByPeer: Record<string, string>
        /** Host reshuffle order for seating (`buildEatFirstTableSyncPayload`). */
        playerOrder: string[]
      }
    }
  | { type: 'eat:table-state-sync'; payload: EatFirstTableSyncPayload }

export type SignalingDeps = {
  roomManager: RoomManager
  socketPeer: Map<WsSocket, Peer>
  /**
   * Session-resolved user id per socket (populated in `attachSocketServer`
   * from the HTTP-upgrade session cookie). Used by {@link handleJoinRoom}
   * to override the untrusted client-supplied `userId` in the `join-room`
   * payload — Mafia host authority keys on `peer.userId`, so trusting the
   * client there would let anonymous sockets spoof any existing user id.
   *
   * Optional at module-interface level for test harnesses that build a
   * minimal `SignalingDeps`; real production wiring always sets it.
   */
  socketSessionUserId?: WeakMap<WsSocket, string>
}

export function sendServerMessage(socket: WsSocket, message: ServerMessage): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message))
  }
}

/**
 * Broadcast helper: stringifies `message` once and sends the same buffer to every
 * peer in `room`. Equivalent to `for (const p of room.getPeers()) p.sendJson(msg)`,
 * but avoids re-running `JSON.stringify` per peer on identical payloads — a measurable
 * win in 8-12 peer rooms when fan-out frequency is high (camera-off, peer-left,
 * mafia state churn).
 */
function broadcastServerMessageToRoom(room: Room, message: ServerMessage): void {
  const serialized = JSON.stringify(message)
  for (const p of room.getPeers()) {
    p.sendRaw(serialized)
  }
}

/**
 * Same as {@link broadcastServerMessageToRoom} but for messages whose shape is not in
 * {@link ServerMessage} (call-chat, raise-hand and other ad-hoc broadcasts that were
 * inlined as object literals before this helper existed). Uses `unknown` to allow any
 * JSON-serializable shape; callers must construct a stable shape themselves.
 */
function broadcastUntypedJsonToRoom(room: Room, payload: unknown): void {
  const serialized = JSON.stringify(payload)
  for (const p of room.getPeers()) {
    p.sendRaw(serialized)
  }
}

let loggedClientIceConfig = false

function serializeTransportOptions(transport: WebRtcTransport): TransportOptionsPayload {
  const iceServers = getClientIceServersFromEnv()
  const iceTransportPolicy = getIceTransportPolicyFromEnv()

  if (!loggedClientIceConfig && (iceServers?.length || iceTransportPolicy)) {
    loggedClientIceConfig = true
    if (process.env.NODE_ENV !== 'production') {
      console.log('[ice] client RTCConfiguration extras:', {
        extraIceServers: iceServers?.length ?? 0,
        iceTransportPolicy: iceTransportPolicy ?? 'all (default)',
      })
    }
  }

  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
    ...(iceServers?.length ? { iceServers } : {}),
    ...(iceTransportPolicy ? { iceTransportPolicy } : {}),
  }
}

function collectExistingProducers(room: Room, excludePeerId: string): ExistingProducerInfo[] {
  const audio: ExistingProducerInfo[] = []
  const video: ExistingProducerInfo[] = []
  for (const p of room.getPeers()) {
    if (p.id === excludePeerId) {
      continue
    }
    for (const producer of p.getProducers()) {
      if (producer.closed) {
        continue
      }
      const row: ExistingProducerInfo = { producerId: producer.id, peerId: p.id, kind: producer.kind }
      if (producer.kind === 'video') {
        row.videoSource = p.getVideoProducerSource(producer.id) ?? 'camera'
        row.outboundVideoPaused = producer.paused
        video.push(row)
      } else {
        audio.push(row)
      }
    }
  }
  // Audio first so the joining client starts hearing existing peers without
  // waiting on its video consumes (paired with audio-first parallel consume in
  // `useRemoteMedia.syncExistingProducersImpl`). Order within each kind is
  // preserved (peer iteration order from `room.getPeers()`).
  return audio.concat(video)
}

function findProducerInRoom(room: Room, producerId: string): Producer | undefined {
  for (const p of room.getPeers()) {
    const prod = p.getProducer(producerId)
    if (prod) {
      return prod
    }
  }
  return undefined
}

/**
 * After outbound `replaceTrack` (same producer id), remotes may receive RTP without a decodable keyframe.
 * Ask each mediasoup video Consumer for this producer to request PLI/FIR toward the publisher.
 *
 * Uses `Peer.getConsumersByProducerId` (an index maintained by Peer) so the
 * scan is O(peers) rather than O(peers × consumers-per-peer). A 12-peer call
 * previously iterated ~144 consumers per source-change; now at most ~12.
 */
function requestVideoKeyframesForProducerConsumers(room: Room, producerId: string): void {
  for (const p of room.getPeers()) {
    for (const c of p.getConsumersByProducerId(producerId)) {
      if (c.closed || c.kind !== 'video') {
        continue
      }
      void c.requestKeyFrame().catch((err: unknown) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[mediasoup] consumer.requestKeyFrame failed', {
            producerId,
            consumerId: c.id,
            consumerPeerId: p.id,
            err,
          })
        }
      })
    }
  }
}

function transportDirection(transport: WebRtcTransport): string | undefined {
  return (transport.appData as { direction?: string } | undefined)?.direction
}

function detachPeerAudioProducersFromLevelObserver(peer: Peer, room: Room): void {
  for (const pr of peer.getProducers()) {
    if (pr.kind === 'audio') {
      void room.removeAudioProducerFromLevelObserver(pr.id)
    }
  }
}

function broadcastProducerClosed(
  room: Room,
  peerId: string,
  producerId: string,
  kind: MediaKind,
): void {
  broadcastServerMessageToRoom(room, {
    type: 'producer-closed',
    payload: { producerId, peerId, kind },
  })
}

/**
 * Close a single producer and notify the room so consumers can drop their
 * stale track/consumer without waiting for `peer-left`. Used from:
 *   - audio-producer swap (new audio producer created while the peer still has one);
 *   - producer's own `transportclose` (transport died but the peer may stay).
 *
 * Safe to call when the producer is already closed (idempotent: `peer.removeProducer`
 * no-ops for unknown ids; level-observer remove is try/catched).
 */
function closeAndBroadcastProducer(
  room: Room,
  peer: Peer,
  producerId: string,
  kind: MediaKind,
): void {
  if (kind === 'audio') {
    void room.removeAudioProducerFromLevelObserver(producerId)
  }
  peer.removeProducer(producerId)
  broadcastProducerClosed(room, peer.id, producerId, kind)
}

function broadcastPeerLeftToRoom(room: Room, leftPeerId: string): void {
  broadcastServerMessageToRoom(room, { type: 'peer-left', payload: { peerId: leftPeerId } })
}

function broadcastMafiaHostUpdated(room: Room): void {
  broadcastServerMessageToRoom(room, {
    type: MafiaWs.hostUpdated,
    payload: {
      hostPeerId: room.getMafiaHostPeerId(),
      hostUserId: room.getMafiaHostUserId(),
      hostSessionId: room.getMafiaHostSessionId(),
    },
  })
}

function isMafiaHostPeer(room: Room, peer: Peer): boolean {
  const hostUserId = room.getMafiaHostUserId()
  const hostSessionId = room.getMafiaHostSessionId()
  const hostPeerId = room.getMafiaHostPeerId()
  return (
    hostUserId != null &&
    hostSessionId != null &&
    hostPeerId != null &&
    peer.userId.length > 0 &&
    peer.mafiaSessionId.length > 0 &&
    peer.userId === hostUserId &&
    peer.mafiaSessionId === hostSessionId &&
    peer.id === hostPeerId
  )
}

/**
 * Resolve the current peer + its room for a mafia-namespaced message. Returns
 * `null` when the socket has no peer, no room, or the room is not a Mafia
 * room — every `handleMafia*` handler short-circuits via this one helper,
 * which keeps the room-type guard in one place.
 */
function resolveMafiaPeerAndRoom(
  socket: WsSocket,
  deps: SignalingDeps,
): { peer: Peer; room: Room } | null {
  const peer = getPeerForSocket(socket, deps)
  if (!peer) return null
  const room = deps.roomManager.getRoom(peer.roomId)
  if (!room) return null
  if (!isMafiaRoomId(room.id)) return null
  return { peer, room }
}

function resolveEatFirstPeerAndRoom(
  socket: WsSocket,
  deps: SignalingDeps,
): { peer: Peer; room: Room } | null {
  const peer = getPeerForSocket(socket, deps)
  if (!peer) return null
  const room = deps.roomManager.getRoom(peer.roomId)
  if (!room) return null
  if (!isEatFirstRoomId(room.id)) return null
  return { peer, room }
}

/** Mafia or Eat First call room — shared elimination (kick/revive) uses the same Room life-state map. */
function resolveMafiaOrEatFirstPeerAndRoom(
  socket: WsSocket,
  deps: SignalingDeps,
): { peer: Peer; room: Room } | null {
  const mafiaRp = resolveMafiaPeerAndRoom(socket, deps)
  if (mafiaRp) return mafiaRp
  return resolveEatFirstPeerAndRoom(socket, deps)
}

function canControlPeerEliminationInRoom(room: Room, peer: Peer): boolean {
  if (isMafiaRoomId(room.id)) return isMafiaHostPeer(room, peer)
  if (isEatFirstRoomId(room.id)) return isEatFirstHostPeer(room, peer)
  return false
}

function eatFirstHostPeerId(room: Room): string | null {
  return resolveEatFirstHostPeerId(room, getEatFirstOwnerUserId(room.id))
}

/**
 * Strict Eat First host authority for WS host-only commands. Requires a
 * server-authoritative `ownerUserId` AND a matching `peer.userId`. The loose
 * "first peer in room" fallback that `resolveEatFirstHostPeerId` performs is
 * intentionally not honored here — it remains valid only for the seat-assignment
 * heuristic in `assignEatFirstSlotsToUnclaimedPeers`. Legacy unstamped rooms
 * (no `ownerUserId`) cannot drive WS host actions; the HTTP gate
 * (`eatFirstSessionCanOperateGame`) still permits role-based admin operations.
 */
function isEatFirstHostPeer(room: Room, peer: Peer): boolean {
  const ownerUserId = getEatFirstOwnerUserId(room.id)
  if (ownerUserId == null || ownerUserId.length === 0) {
    return false
  }
  const peerUserId = typeof peer.userId === 'string' ? peer.userId.trim() : ''
  if (peerUserId.length === 0) {
    return false
  }
  return peerUserId === ownerUserId
}

function eatFirstTraitStatePayloadFromTable(
  table: EatFirstTableSyncPayload,
): {
  revealedBySlot: Record<string, EatFirstTraitKey[]>
  overridesBySlot: Record<string, Partial<Record<EatFirstTraitKey, string>>>
  openedBySlot: Record<string, EatFirstTraitKey[]>
  slotByPeer: Record<string, string>
  /** Same as `eat:table-state-sync`; keeps camera tile order in sync when clients handle trait-sync alone. */
  playerOrder: string[]
} {
  const slotByPeer: Record<string, string> = {}
  for (const [peerId, slotId] of Object.entries(table.slotByPeer)) {
    if (typeof slotId === 'string' && slotId.length > 0) slotByPeer[peerId] = slotId
  }
  const openedBySlot: Record<string, EatFirstTraitKey[]> = {}
  for (const [slotId, row] of Object.entries(table.openedByBySlot)) {
    if (!row || typeof row !== 'object') continue
    const keys: EatFirstTraitKey[] = []
    for (const [traitKey, openedBy] of Object.entries(row)) {
      if (openedBy === 'player' || openedBy === 'host') {
        keys.push(traitKey as EatFirstTraitKey)
      }
    }
    if (keys.length > 0) openedBySlot[slotId] = keys
  }
  return {
    revealedBySlot: table.revealedTraitsBySlot,
    overridesBySlot: table.traitsBySlot,
    openedBySlot,
    slotByPeer,
    playerOrder: [...table.playerOrder],
  }
}

async function getEatFirstTableStateForRoom(room: Room): Promise<EatFirstTableSyncPayload> {
  await hydrateEatFirstOwnerUserIdFromDb(room.id)
  await getHydratedEatFirstTableState(room.id)
  const ownerUserId = getEatFirstOwnerUserId(room.id)
  assignEatFirstSlotsToUnclaimedPeers(room, ownerUserId)
  return buildEatFirstTableSyncPayload(room, resolveEatFirstHostPeerId(room, ownerUserId))
}

async function broadcastEatFirstTableState(room: Room): Promise<void> {
  const table = await getEatFirstTableStateForRoom(room)
  broadcastServerMessageToRoom(room, { type: 'eat:table-state-sync', payload: table })
  // Backward-compatible payload for clients still wired to the legacy event.
  broadcastServerMessageToRoom(room, {
    type: 'eat:trait-state-sync',
    payload: eatFirstTraitStatePayloadFromTable(table),
  })
}

function broadcastEatFirstHostUpdated(room: Room): void {
  broadcastServerMessageToRoom(room, {
    type: 'eat:host-updated',
    payload: { hostPeerId: eatFirstHostPeerId(room) },
  })
}

function broadcastEatFirstSpeakingQueueUpdate(room: Room): void {
  broadcastServerMessageToRoom(room, {
    type: 'eat:speaking-queue-update',
    payload: { speakingQueue: room.getEatFirstSpeakingQueue() },
  })
}

function broadcastMafiaQueueUpdate(room: Room): void {
  broadcastServerMessageToRoom(room, {
    type: MafiaWs.queueUpdate,
    payload: { speakingQueue: room.getMafiaSpeakingQueue() },
  })
}

function broadcastMafiaReshuffle(
  room: Room,
  payload: {
    players: Array<{
      peerId: string
      seat: number
      role: 'mafia' | 'don' | 'sheriff' | 'doctor' | 'civilian' | null
    }>
  },
): void {
  broadcastServerMessageToRoom(room, { type: MafiaWs.reshuffle, payload })
}

function finalizeRoomIfEmpty(room: Room, roomManager: RoomManager): void {
  if (room.getPeers().length > 0) {
    return
  }
  disposeEatFirstTableState(room.id)
  disposeEatFirstOwnerUserId(room.id)
  room.dispose()
  roomManager.removeRoom(room.id)
}

export function removePeerFromNetwork(peer: Peer, deps: SignalingDeps): void {
  const room = deps.roomManager.getRoom(peer.roomId)
  if (room) {
    detachPeerAudioProducersFromLevelObserver(peer, room)
  }
  // Suppress per-producer `producer-closed` fan-out triggered by the
  
  
  // every consumer/track owned by this peer. See `Peer.isTearingDown`.
  peer.isTearingDown = true
  peer.closeAllMedia()
  deps.socketPeer.delete(peer.socket)
  if (!room) {
    return
  }
  const removed = room.removePeer(peer.id)
  if (!removed) {
    return
  }
  broadcastPeerLeftToRoom(room, peer.id)
  if (isEatFirstRoomId(room.id)) {
    void broadcastEatFirstTableState(room)
    broadcastEatFirstHostUpdated(room)
  }
  // Clear the Mafia host *peer* binding when the host peer itself is the one
  // leaving so the next broadcast reflects "host offline" instead of advertising
  // a peerId that no longer exists in the room. The stable `hostUserId` /
  // `hostSessionId` are intentionally preserved so the same authenticated owner
  // can reclaim host on reconnect via `mafia:claim-host` (which also consults
  // `mafiaRoomOwnerStore`). Anonymous peers cannot reclaim because the claim
  // path requires `peer.userId.length >= 1`.
  if (isMafiaRoomId(room.id) && room.getMafiaHostPeerId() === peer.id) {
    room.setMafiaHostPeerId(null)
  }
  if (isGameRoomId(room.id) && room.getGameRoomHostPeerId() === peer.id) {
    // Generic game-room (Phase 3A): same semantics as the Mafia branch
    // above — clear only the live `hostPeerId`, preserve `hostUserId` +
    // `hostSessionId` so the authenticated owner can reclaim host on
    // reconnect via `gameroom:claim-host` + `gameRoomOwnerStore`.
    room.setGameRoomHostPeerId(null)
  }
  broadcastMafiaHostUpdated(room)
  if (isGameRoomId(room.id)) {
    broadcastGameRoomHostUpdated(room)
  }
  
  // stale after a leave. The host's next `mafia:players-update` will
  
  // queue so UIs do not render a seat that no longer has a player.
  if (isMafiaRoomId(room.id)) {
    // Genuine peer-left: drop per-peer Mafia kill enforcement and life-state
    // for the leaver so OBS / late joiners do not see ghost dead overlays
    // or paused-producer flags for peerIds that no longer exist. Tab-reload
    // of the same peerId goes through `replaceDuplicatePeerId` and skips
    // this branch (Room.removePeer is called there but the cleanup helpers
    // intentionally live in this signaling layer, not in Room.removePeer).
    //
    // The forced-flag userId mirror (set by kick / cleared by revive +
    // reshuffle) is intentionally NOT touched here: it persists across this
    // peer-left so a fresh-tab rejoin re-applies the kill flag on join.
    room.clearMafiaForceStateForPeer(peer.id)
    room.clearMafiaPlayerLifeStateForPeer(peer.id)
    // Audio-mix `byPeerId` and nickname Maps had no peer-left cleanup; over
    // a long session the audio-mix `byPeerId` orphans bloated every OBS
    // snapshot reply (snapshot getter does not filter by live peers).
    // The audio-mix `byUserId` mirror is intentionally preserved (handled
    // by `rebindMafiaAudioMixEntryPeerId` on rejoin).
    room.clearMafiaAudioMixForPeerId(peer.id)
    room.clearMafiaNicknameForPeer(peer.id)
    const changed = room.pruneMafiaSpeakingQueueToMaxSeat(room.getPeers().length)
    if (changed) {
      broadcastServerMessageToRoom(room, {
        type: MafiaWs.queueUpdate,
        payload: { speakingQueue: room.getMafiaSpeakingQueue() },
      })
    }
  }
  if (isEatFirstRoomId(room.id)) {
    const changed = room.pruneEatFirstSpeakingQueueToMaxSeat(11)
    if (changed) {
      broadcastEatFirstSpeakingQueueUpdate(room)
    }
  }
  if (isGameRoomId(room.id)) {
    // Generic game-room peer-left cleanup. Parallel of the Mafia branch
    // above; touches only `gameRoom*` state. Same userId-mirror preservation
    // semantics: peerId entry dropped (live tab is gone), userId mirror kept
    // so a fresh-tab rejoin re-applies kill flags via the join branch.
    room.clearGameRoomForceStateForPeer(peer.id)
    room.clearGameRoomPlayerLifeStateForPeer(peer.id)
    room.clearGameRoomAudioMixForPeerId(peer.id)
    room.clearGameRoomNicknameForPeer(peer.id)
    const changed = room.pruneGameRoomSpeakingQueueToMaxSeat(room.getPeers().length)
    if (changed) {
      broadcastServerMessageToRoom(room, {
        type: GameRoomWs.queueUpdate,
        payload: { speakingQueue: room.getGameRoomSpeakingQueue() },
      })
    }
  }
  finalizeRoomIfEmpty(room, deps.roomManager)
}

function disassociateSocketFromCurrentRoom(socket: WsSocket, deps: SignalingDeps): void {
  const prev = deps.socketPeer.get(socket)
  if (!prev) {
    return
  }
  removePeerFromNetwork(prev, deps)
}

/**
 * Evict an existing peer that shares the incoming socket's peerId. Returns
 * `true` if the eviction caused the room to be finalized (last peer left
 * → disposed + unregistered), so the caller can re-fetch a fresh Room from
 * the manager. Returning a boolean lets `handleJoinRoom` skip the second
 * `getOrCreateRoom` call on the common happy path.
 */
function replaceDuplicatePeerId(
  room: Room,
  incomingSocket: WsSocket,
  peerId: string,
  deps: SignalingDeps,
): { roomFinalized: boolean } {
  const existing = room.getPeer(peerId)
  if (!existing || existing.socket === incomingSocket) {
    return { roomFinalized: false }
  }

  console.warn('[signaling] duplicate peerId in room; closing previous socket (open a new tab with a fresh peer id)', {
    roomId: room.id,
    peerId,
  })

  detachPeerAudioProducersFromLevelObserver(existing, room)
  existing.closeAllMedia()
  deps.socketPeer.delete(existing.socket)
  room.removePeer(peerId)
  broadcastPeerLeftToRoom(room, peerId)
  broadcastMafiaHostUpdated(room)
  if (isGameRoomId(room.id)) {
    broadcastGameRoomHostUpdated(room)
  }

  try {
    existing.socket.close(4000, 'Replaced by new connection')
  } catch {
    // ignore
  }

  // Only finalize (and therefore dispose the Room) when the eviction actually
  
  if (room.getPeers().length === 0) {
    room.dispose()
    deps.roomManager.removeRoom(room.id)
    return { roomFinalized: true }
  }
  return { roomFinalized: false }
}

function roomPeerRow(p: Peer): RoomPeerInfo {
  const row: RoomPeerInfo = { peerId: p.id, displayName: p.displayName }
  if (p.userId.length > 0) {
    row.userId = p.userId
  }
  if (p.avatarUrl.length > 0) {
    row.avatarUrl = p.avatarUrl
  }
  if (p.audioMuted) {
    row.audioMuted = true
  }
  return row
}

function peersInRoomExcept(room: Room, excludePeerId: string): RoomPeerInfo[] {
  return room.getPeers().filter((x) => x.id !== excludePeerId).map(roomPeerRow)
}

export async function handleJoinRoom(
  socket: WsSocket,
  roomId: string,
  peerId: string,
  displayName: string | undefined,
  avatarUrlRaw: string | undefined,
  userIdRaw: string | undefined,
  deps: SignalingDeps,
): Promise<void> {
  disassociateSocketFromCurrentRoom(socket, deps)

  let room = await deps.roomManager.getOrCreateRoom(roomId)
  const { roomFinalized } = replaceDuplicatePeerId(room, socket, peerId, deps)
  
  
  
  if (roomFinalized) {
    room = await deps.roomManager.getOrCreateRoom(roomId)
  }

  const name = sanitizeDisplayName(displayName, peerId)
  const avatarUrlSafe = sanitizeAvatarUrl(avatarUrlRaw)
  
  
  
  // spoof any Mafia host's user id via a forged `join-room` payload.
  // Anonymous sockets get `''`, which every Mafia authority check already rejects.
  const sessionUserId = deps.socketSessionUserId?.get(socket) ?? ''
  const userId = sanitizeUserId(sessionUserId)
  if (process.env.NODE_ENV !== 'production') {
    const clientClaim = sanitizeUserId(userIdRaw)
    if (clientClaim.length > 0 && clientClaim !== userId) {
      console.warn('[signaling] join-room userId mismatch ignored', {
        peerId,
        clientClaim: clientClaim.slice(0, 16),
        sessionUserIdPresent: userId.length > 0,
      })
    }
  }
  const peer = new Peer(peerId, socket, room.id, name, avatarUrlSafe, userId)
  
  // resets on every new socket, so the room remembers the active state and
  
  
  if (isGameRoomId(room.id)) {
    // Generic game-room (Phase 3A) parallel of the Mafia kill-enforcement
    // reload-recovery block below. Independent fields, independent gates;
    // never reaches into Mafia state. Mafia branch sits next to this one,
    // unmodified.
    if (room.isGameRoomForceMuteAllActive()) {
      peer.forcedAudioMuted = true
    }
    const grCameraOffByPeerId = room.isGameRoomPeerForcedCameraOff(peerId)
    const grCameraOffByUserId = room.isGameRoomUserForcedCameraOff(userId)
    if (grCameraOffByPeerId || grCameraOffByUserId) {
      peer.forcedCameraOff = true
      if (!grCameraOffByPeerId) {
        room.setGameRoomPeerForcedCameraOff(peerId, true)
      }
    }
    const grMicMutedByPeerId = room.isGameRoomPeerForcedMicMuted(peerId)
    const grMicMutedByUserId = room.isGameRoomUserForcedMicMuted(userId)
    if (grMicMutedByPeerId || grMicMutedByUserId) {
      peer.forcedAudioMuted = true
      if (!grMicMutedByPeerId) {
        room.setGameRoomPeerForcedMicMuted(peerId, true)
      }
    }
  }
  if (isMafiaRoomId(room.id)) {
    if (room.isMafiaForceMuteAllActive()) {
      peer.forcedAudioMuted = true
    }
    // Per-peer Mafia kill enforcement persists across reload via TWO indexes:
    // the legacy peerId set (covers F5 / sessionStorage-reuse reload, where
    // the Peer object is fresh but `peerId` is unchanged) and the userId
    // mirror (covers fresh-tab / new-socket rejoin where `peerId` differs).
    //
    // userId match additionally seeds the peerId set for the new peerId so
    // subsequent producer-pause / status checks against the live sets stay
    // O(1) and remain consistent with the existing per-action handlers
    // (`handleSetOutboundVideoPaused` etc.).
    const cameraOffByPeerId = room.isMafiaPeerForcedCameraOff(peerId)
    const cameraOffByUserId = room.isMafiaUserForcedCameraOff(userId)
    if (cameraOffByPeerId || cameraOffByUserId) {
      peer.forcedCameraOff = true
      if (!cameraOffByPeerId) {
        room.setMafiaPeerForcedCameraOff(peerId, true)
      }
    }
    const micMutedByPeerId = room.isMafiaPeerForcedMicMuted(peerId)
    const micMutedByUserId = room.isMafiaUserForcedMicMuted(userId)
    if (micMutedByPeerId || micMutedByUserId) {
      peer.forcedAudioMuted = true
      if (!micMutedByPeerId) {
        room.setMafiaPeerForcedMicMuted(peerId, true)
      }
    }
  }
  room.addPeer(peer)
  deps.socketPeer.set(socket, peer)
  
  
  
  
  
  const isGameRoom = isGameRoomId(room.id)
  let gameRoomHostAssignedOnJoin = false
  if (isGameRoom && userId.length > 0) {
    // Generic game-room (Phase 3A) host reload recovery + owner-lock auto
    // assign on join. Parallel of the Mafia block below; never reads or
    // writes Mafia fields. See `handleGameRoomClaimHost` for the
    // explicit-claim path.
    const hostUserId = room.getGameRoomHostUserId()
    const hostPeerId = room.getGameRoomHostPeerId()
    const hostPeerOnline = hostPeerId != null && room.getPeer(hostPeerId) != null
    if (hostUserId == null) {
      const ownerUserId = getGameRoomOwnerUserId(room.id)
      if (ownerUserId != null && ownerUserId === userId) {
        room.setGameRoomHostUserId(userId)
        room.setGameRoomHostPeerId(peer.id)
        setGameRoomOwnerUserId(room.id, userId)
        gameRoomHostAssignedOnJoin = true
      }
    } else if (hostUserId === userId && !hostPeerOnline) {
      room.setGameRoomHostPeerId(peer.id)
      const sessionPeerId = room.getGameRoomHostSessionId()
      if (sessionPeerId != null) {
        const samePeerStillThere = room.getPeers().some((p) => p.gameRoomSessionId === sessionPeerId)
        if (!samePeerStillThere) {
          room.setGameRoomHostSessionId(null)
        }
      }
      setGameRoomOwnerUserId(room.id, userId)
      gameRoomHostAssignedOnJoin = true
    }
  }

  const isMafiaRoom = isMafiaRoomId(room.id)
  let mafiaHostAssignedOnJoin = false
  if (isMafiaRoom && userId.length > 0) {
    const hostUserId = room.getMafiaHostUserId()
    const hostPeerId = room.getMafiaHostPeerId()
    const hostPeerOnline = hostPeerId != null && room.getPeer(hostPeerId) != null
    if (hostUserId == null) {
      // Owner-lock (P0 Bug 3): never auto-promote a fresh joiner to host
      // unless the recorded owner matches. If no owner is recorded yet
      // (brand-new room), defer assignment to `mafia:claim-host` so that
      // a non-host (e.g. early viewer participant) cannot accidentally
      // become host just by joining first.
      const ownerUserId = getMafiaRoomOwnerUserId(room.id)
      if (ownerUserId != null && ownerUserId === userId) {
        room.setMafiaHostUserId(userId)
        room.setMafiaHostPeerId(peer.id)
        // Refresh owner TTL on rejoin.
        setMafiaRoomOwnerUserId(room.id, userId)
        mafiaHostAssignedOnJoin = true
      }
    } else if (hostUserId === userId && !hostPeerOnline) {
      // Host page reload / transient reconnect: keep one host owner and rebind
      // host peer id immediately so clients keep "host is last" ordering.
      // Clear stale session id so the next claim-host with the new tab's
      // sessionId is accepted (avoids trapping ownership on a dead session).
      room.setMafiaHostPeerId(peer.id)
      const sessionPeerId = room.getMafiaHostSessionId()
      if (sessionPeerId != null) {
        const samePeerStillThere = room.getPeers().some((p) => p.mafiaSessionId === sessionPeerId)
        if (!samePeerStillThere) {
          room.setMafiaHostSessionId(null)
        }
      }
      // Refresh owner TTL on rejoin.
      setMafiaRoomOwnerUserId(room.id, userId)
      mafiaHostAssignedOnJoin = true
    }
  }

  const others = peersInRoomExcept(room, peerId)

  const routerRtpCapabilities: RtpCapabilities = room.getRouter().rtpCapabilities
  const existingProducers = collectExistingProducers(room, peerId)

  if (process.env.NODE_ENV !== 'production') {
    const producerSnapshot = room.getPeers().map((p) => ({
      peerId: p.id,
      displayName: p.displayName,
      producers: p.getProducers().filter((pr) => !pr.closed).map((pr) => ({ id: pr.id, kind: pr.kind })),
    }))
    console.log('[join]', {
      roomId: room.id,
      peerId,
      displayName: name,
      peersInRoom: others.length + 1,
      existingProducers: existingProducers.length,
      producerSnapshot,
    })
  }

  sendServerMessage(socket, {
    type: 'room-state',
    payload: { peers: others, routerRtpCapabilities, existingProducers },
  })

  sendServerMessage(socket, {
    type: 'signaling-auth',
    payload: { userId: userId.length > 0 ? userId : null },
  })

  room.sendActiveSpeakerCatchUpToPeer(peer)

  const joinedMsg: ServerMessage = {
    type: 'peer-joined',
    payload: {
      peerId,
      displayName: name,
      ...(userId.length > 0 ? { userId } : {}),
      ...(avatarUrlSafe.length > 0 ? { avatarUrl: avatarUrlSafe } : {}),
    },
  }
  const serializedJoined = JSON.stringify(joinedMsg)
  for (const p of room.getPeers()) {
    if (p.id === peerId) {
      continue
    }
    p.sendRaw(serializedJoined)
  }
  if (mafiaHostAssignedOnJoin) {
    broadcastMafiaHostUpdated(room)
  }
  if (gameRoomHostAssignedOnJoin) {
    broadcastGameRoomHostUpdated(room)
  }
  // Rebind any prior audio-mix entry keyed by this user's stable userId to
  // the new peerId so a host page reload / participant reload keeps its mix
  // visible to OBS without the host re-clicking the slider. The rebound entry
  // is fanned out to the whole room so live OBS clients reapply by new peerId.
  if (isMafiaRoom && userId.length > 0) {
    const rebound = room.rebindMafiaAudioMixEntryPeerId(peerId, userId)
    if (rebound) {
      broadcastServerMessageToRoom(room, {
        type: MafiaWs.audioMixUpdate,
        payload: { entries: [{ ...rebound }] },
      })
    }
  }
  if (isGameRoom && userId.length > 0) {
    // Generic game-room audio-mix rebind on reload. Parallel of the Mafia
    // block above; touches only `gameRoom*` state.
    const rebound = room.rebindGameRoomAudioMixEntryPeerId(peerId, userId)
    if (rebound) {
      broadcastServerMessageToRoom(room, {
        type: GameRoomWs.audioMixUpdate,
        payload: { entries: [{ ...rebound }] },
      })
    }
  }
  if (isEatFirstRoomId(room.id)) {
    await hydrateEatFirstOwnerUserIdFromDb(room.id)
    await hydrateEatFirstTableStateFromDb(room.id)
    broadcastEatFirstHostUpdated(room)
    // Fan-out table sync to every peer (not only the joiner). Otherwise remotes keep a stale
    // peerId→slot map after someone reconnects — tiles jump to the end and traits vanish.
    await broadcastEatFirstTableState(room)
    sendServerMessage(socket, {
      type: 'eat:speaking-queue-update',
      payload: { speakingQueue: room.getEatFirstSpeakingQueue() },
    })
    sendServerMessage(socket, {
      type: MafiaWs.playerLifeState,
      payload: { states: room.getMafiaPlayerLifeStateSnapshot() },
    })
  }

  
  
  if (isMafiaRoom) {
    sendMafiaSnapshotToSocket(socket, room, peer)
  }
  if (isGameRoom) {
    sendGameRoomSnapshotToSocket(socket, room, peer)
  }
}

/**
 * Re-emits the entire Mafia snapshot block addressed to one socket. Called
 * during `handleJoinRoom` (initial load + reconnect re-join) and on demand
 * from {@link handleMafiaRequestSnapshot} (OBS / `?mode=view` recovery
 * without a fresh `join-room`).
 *
 * Read-only with respect to `room` state — the only mutation is the
 * `setMafiaTimer(null)` cleanup of an expired timer, which is idempotent
 * and matches the original `handleJoinRoom` behavior.
 */
function sendMafiaSnapshotToSocket(socket: WsSocket, room: Room, peer: Peer): void {
  sendServerMessage(socket, {
    type: MafiaWs.hostUpdated,
    payload: {
      hostPeerId: room.getMafiaHostPeerId(),
      hostUserId: room.getMafiaHostUserId(),
      hostSessionId: room.getMafiaHostSessionId(),
    },
  })
  sendServerMessage(socket, {
    type: MafiaWs.queueUpdate,
    payload: { speakingQueue: room.getMafiaSpeakingQueue() },
  })
  sendServerMessage(socket, {
    type: MafiaWs.modeUpdate,
    payload: { mode: room.getMafiaMode() },
  })
  sendServerMessage(socket, {
    type: MafiaWs.settingsUpdate,
    payload: {
      deadBackgrounds: room.getMafiaDeadBackgrounds(),
      activeBackgroundId: room.getMafiaActiveBackgroundId(),
    },
  })
  sendServerMessage(socket, {
    type: MafiaWs.pageBackgroundSettings,
    payload: {
      backgrounds: room.getMafiaPageBackgrounds(),
      selectedBackgroundId: null,
      forcedBackgroundId: room.getMafiaForcedPageBackgroundId(),
    },
  })
  sendServerMessage(socket, {
    type: MafiaWs.playerLifeState,
    payload: { states: room.getMafiaPlayerLifeStateSnapshot() },
  })
  // Replay room-wide force-mute state to this socket only so OBS/view and
  // late joiners can derive the host's "mute all" button state and tile
  // mute badges from server state instead of a local-only host ref.
  sendServerMessage(socket, {
    type: MafiaWs.forceMuteAll,
    payload: { muted: room.isMafiaForceMuteAllActive() },
  })
  // `room-state.peers[].audioMuted` only carries user-self-mute. Force-mute
  // (per-peer kick or `mafia:force-mute-all`) lives in `Peer.forcedAudioMuted`
  // and is not encoded there. On host reload during an active mute-all this
  // would leave the host's effective-mute map empty for force-only-muted peers
  // and the "mute all" button would render as inactive. Replay per-peer
  // effective state so the host UI derives the correct button state and tile
  // badges from the server snapshot. OBS/view and late joiners benefit too.
  for (const other of room.getPeers()) {
    if (other.id === peer.id) continue
    const effectiveMuted = other.audioMuted || other.forcedAudioMuted
    if (!effectiveMuted) continue
    sendServerMessage(socket, {
      type: 'peer-audio-muted',
      payload: { peerId: other.id, muted: true },
    })
  }
  // Replay per-peer outbound video pause state. The existing
  // `peer-outbound-video-paused` deltas (host force-camera-off, target
  // self-pause) update receivers in real time, but a late joiner / OBS
  // reconnect that missed the deltas previously had no way to know which
  // tiles should render the "camera off" placeholder. We use `forcedCameraOff`
  // as the conservative source: it covers Mafia kill enforcement; user
  // self-pause is intentionally excluded here because the existing producer
  // state (consumer `track.muted = true` for paused producers) keeps the
  // tile in the right visual state via StreamVideo's `hasUsableVideoTrack`.
  for (const other of room.getPeers()) {
    if (other.id === peer.id) continue
    if (!other.forcedCameraOff) continue
    sendServerMessage(socket, {
      type: 'peer-outbound-video-paused',
      payload: { peerId: other.id, paused: true },
    })
  }
  const mt = room.getMafiaTimer()
  if (mt != null) {
    const rem = mt.duration - (Date.now() - mt.startedAt)
    if (rem > 0) {
      sendServerMessage(socket, { type: MafiaWs.timerStart, payload: { ...mt, isRunning: true } })
    } else {
      room.setMafiaTimer(null)
    }
  }
  /**
   * Replay the latest server-accepted reshuffle to this socket only.
   * Snapshot is gated by `getMafiaReshuffleSnapshotIfFresh`, which returns
   * the payload only when every peer in the snapshot is currently live and
   * the live peer count matches the snapshot length — so we never replay a
   * stale assignment whose seats no longer cover the room.
   */
  const reshuffleSnap = room.getMafiaReshuffleSnapshotIfFresh()
  if (reshuffleSnap != null) {
    sendServerMessage(socket, { type: MafiaWs.reshuffle, payload: reshuffleSnap })
  }
  const playersUpdateSnap = room.getMafiaPlayersUpdateSnapshotIfFresh()
  if (playersUpdateSnap != null) {
    sendServerMessage(socket, { type: MafiaWs.playersUpdate, payload: playersUpdateSnap })
  }
  const nicks = room.getMafiaNicknamesSnapshot()
  for (const [peerId, displayName] of Object.entries(nicks)) {
    sendServerMessage(socket, { type: MafiaWs.playerNicknameUpdate, payload: { peerId, displayName } })
  }
  // Replay host-controlled per-participant audio mix to this socket only.
  // The OBS `?mode=view` viewer applies it via existing
  // `setRemoteListenVolume` / `setRemoteListenMuted` keyed by peerId; entries
  // for users who reloaded since the host last set them have already been
  // rebound to the current peerId by `rebindMafiaAudioMixEntryPeerId` above.
  const audioMixSnap = room.getMafiaAudioMixSnapshot()
  if (audioMixSnap.length > 0) {
    sendServerMessage(socket, {
      type: MafiaWs.audioMixUpdate,
      payload: { entries: audioMixSnap },
    })
  }
}

/**
 * `mafia:request-snapshot` handler. Re-emits the snapshot block to the
 * requesting socket only when the peer is in a Mafia room. No-op otherwise.
 * Idempotent on the client (each apply path is replace-from-server).
 */
export function handleMafiaRequestSnapshot(socket: WsSocket, deps: SignalingDeps): void {
  const peer = getPeerForSocket(socket, deps)
  if (!peer) return
  const room = deps.roomManager.getRoom(peer.roomId)
  if (!room) return
  if (!isMafiaRoomId(room.id)) return
  sendMafiaSnapshotToSocket(socket, room, peer)
}

export function handleCallChat(socket: WsSocket, text: string, deps: SignalingDeps): void {
  const peer = getPeerForSocket(socket, deps)
  if (!peer) {
    return
  }
  const room = deps.roomManager.getRoom(peer.roomId)
  if (!room) {
    return
  }
  const trimmed = text.trim().slice(0, 500)
  if (!trimmed) {
    return
  }
  broadcastUntypedJsonToRoom(room, {
    type: 'call-chat',
    payload: {
      peerId: peer.id,
      displayName: peer.displayName,
      text: trimmed,
      at: Date.now(),
    },
  })
}

export function handleRaiseHand(socket: WsSocket, raised: boolean, deps: SignalingDeps): void {
  const peer = getPeerForSocket(socket, deps)
  if (!peer) {
    return
  }
  const room = deps.roomManager.getRoom(peer.roomId)
  if (!room) {
    return
  }
  broadcastUntypedJsonToRoom(room, {
    type: 'raise-hand',
    payload: { peerId: peer.id, raised },
  })
}

export async function handleSetAudioMuted(
  socket: WsSocket,
  muted: boolean,
  deps: SignalingDeps,
): Promise<void> {
  const peer = getPeerForSocket(socket, deps)
  if (!peer) {
    return
  }
  peer.audioMuted = muted
  const room = deps.roomManager.getRoom(peer.roomId)
  if (!room) {
    return
  }
  // After the host's `force-mute-all` is lifted, the audio producer may be
  
  
  // signal; we only touch the producer when both: (1) user is unmuting,
  
  
  if (!muted && !peer.forcedAudioMuted) {
    // Snapshot the paused audio producers BEFORE awaiting `p.resume()` —
    // `peer.getProducers()` is a live collection; an audio producer swap
    // (`handleProduce`) racing with this loop would otherwise mutate the
    // iteration mid-flight, skipping or double-resuming entries.
    const pausedAudioProducers = peer
      .getProducers()
      .filter((p) => p.kind === 'audio' && !p.closed && p.paused)
    for (const p of pausedAudioProducers) {
      try {
        await p.resume()
      } catch (e) {
        console.warn('[signaling] audio producer resume on unmute failed', {
          peerId: peer.id,
          producerId: p.id,
        }, e)
      }
    }
  }
  
  
  
  const effectiveMuted = peer.audioMuted || peer.forcedAudioMuted
  broadcastServerMessageToRoom(room, {
    type: 'peer-audio-muted',
    payload: { peerId: peer.id, muted: effectiveMuted },
  })
}

/**
 * First authenticated user to claim with no current host becomes Mafia host.
 * Host authority is user-scoped, not peer-scoped, so reloads do not transfer host.
 */
export function handleMafiaClaimHost(
  socket: WsSocket,
  payload: { sessionId?: string } | null | undefined,
  deps: SignalingDeps,
): void {
  const rp = resolveMafiaPeerAndRoom(socket, deps)
  if (!rp) {
    return
  }
  const { peer, room } = rp
  if (peer.userId.length < 1) {
    return
  }
  const sessionId = sanitizeSessionId(payload?.sessionId)
  if (sessionId.length < 1) {
    return
  }
  peer.mafiaSessionId = sessionId
  const current = room.getMafiaHostUserId()
  if (current === peer.userId) {
    const currentSession = room.getMafiaHostSessionId()
    const currentPeerId = room.getMafiaHostPeerId()
    const currentPeerOnline = currentPeerId != null && room.getPeer(currentPeerId) != null
    if (currentSession == null || currentPeerId == null || !currentPeerOnline || currentPeerId === peer.id) {
      if (currentSession != null && currentSession !== sessionId) {
        // Same userId, different active session, original peer still online: reject
        // so two tabs of the same host do not race for the host peer slot.
        return
      }
      room.setMafiaHostSessionId(sessionId)
      room.setMafiaHostPeerId(peer.id)
      // Refresh owner TTL: this user is actively asserting ownership now.
      setMafiaRoomOwnerUserId(room.id, peer.userId)
      broadcastMafiaHostUpdated(room)
    }
    return
  }
  if (current != null) {
    return
  }
  // Owner-lock: the room currently has no in-memory host. Consult the
  // process-wide ownerStore (P0 Bug 3). If a prior owner is recorded
  // and does not match this peer's userId, reject the claim — the
  // original owner keeps host ownership across `Room` finalization.
  const ownerUserId = getMafiaRoomOwnerUserId(room.id)
  if (ownerUserId != null && ownerUserId !== peer.userId) {
    return
  }
  room.setMafiaHostUserId(peer.userId)
  room.setMafiaHostSessionId(sessionId)
  room.setMafiaHostPeerId(peer.id)
  // Record (or refresh) the owner. First-time claim of a brand-new
  // room locks ownership to this userId for the TTL window.
  setMafiaRoomOwnerUserId(room.id, peer.userId)
  broadcastMafiaHostUpdated(room)
}

export function handleMafiaTransferHost(
  socket: WsSocket,
  payload: { userId: string },
  deps: SignalingDeps,
): void {
  const rp = resolveMafiaPeerAndRoom(socket, deps)
  if (!rp) {
    return
  }
  const { peer, room } = rp
  if (!isMafiaHostPeer(room, peer)) {
    return
  }
  const nextUserId = sanitizeUserId(payload.userId)
  if (nextUserId.length < 1) {
    return
  }
  // Owner-lock guard (P0 Bug 3): only transfer host to a userId that is
  // actually present in the room. Rejects transfers to OBS/view tabs that
  // are not currently in-room as participants, and to stale identities.
  const candidatePresent = room
    .getPeers()
    .some((p) => p.userId === nextUserId)
  if (!candidatePresent) {
    return
  }
  room.setMafiaHostUserId(nextUserId)
  const nextSessionId = room.getFirstMafiaSessionIdForUser(nextUserId)
  room.setMafiaHostSessionId(nextSessionId)
  room.setMafiaHostPeerId(room.getFirstMafiaPeerIdForUserSession(nextUserId, nextSessionId))
  // Persist the new owner identity so it survives `Room` finalization.
  setMafiaRoomOwnerUserId(room.id, nextUserId)
  broadcastMafiaHostUpdated(room)
}




export function handleMafiaQueueUpdate(
  socket: WsSocket,
  payload: { speakingQueue: unknown } | null | undefined,
  deps: SignalingDeps,
): void {
  const rp = resolveMafiaPeerAndRoom(socket, deps)
  if (!rp) {
    return
  }
  const { peer, room } = rp
  if (!isMafiaHostPeer(room, peer)) {
    return
  }
  const list = (payload as { speakingQueue?: unknown } | null | undefined)?.speakingQueue
  /**
   * Audit P1: tighten the upper bound to actual peer count whenever the
   * room is non-empty. The previous fallback to `MAFIA_MAX_SEAT` only
   * applied when the room was empty (no peers); however, after a peer
   * leaves and before the host's next `mafia:players-update`, the host
   * can still emit a queue containing the dead seat. Sanitize against
   * the live count so we never broadcast a phantom seat.
   */
  const maxSeat = room.getPeers().length > 0 ? room.getPeers().length : MAFIA_MAX_SEAT
  const sanitized = sanitizeMafiaSpeakingQueueList(list, maxSeat)
  room.setMafiaSpeakingQueue(sanitized)
  broadcastMafiaQueueUpdate(room)
}

export function handleEatFirstSpeakingQueueUpdate(
  socket: WsSocket,
  payload: { speakingQueue: unknown } | null | undefined,
  deps: SignalingDeps,
): void {
  const rp = resolveEatFirstPeerAndRoom(socket, deps)
  if (!rp) return
  const { peer, room } = rp
  if (!isEatFirstHostPeer(room, peer)) return
  const list = (payload as { speakingQueue?: unknown } | null | undefined)?.speakingQueue
  /**
   * Audit P1: bound by the live active-slot count so the host can never
   * broadcast a seat that no longer has a player (e.g., after a peer leaves
   * but before the host's queue update reflects it).
   */
  const liveSeatCap = eatFirstActiveSlotsForRoom(room, room.id).length
  const sanitized = sanitizeEatFirstSpeakingQueueList(list, liveSeatCap)
  room.setEatFirstSpeakingQueue(sanitized)
  broadcastEatFirstSpeakingQueueUpdate(room)
}




export async function handleMafiaReshuffle(
  socket: WsSocket,
  payload: {
    players: Array<{
      peerId: string
      seat: number
      role: 'mafia' | 'don' | 'sheriff' | 'doctor' | 'civilian' | null
    }>
  },
  deps: SignalingDeps,
): Promise<void> {
  const rp = resolveMafiaPeerAndRoom(socket, deps)
  if (!rp) {
    return
  }
  const { peer, room } = rp
  if (!isMafiaHostPeer(room, peer)) {
    return
  }
  const peers = room.getPeers()
  if (peers.length < 1) {
    return
  }
  const roomIds = new Set(peers.map((p) => p.id))
  const { players: list } = payload
  /**
   * Audit: list may be a subset of room peers — viewer-role peers (e.g. OBS view)
   * never appear in the host's tile list and therefore never enter the order.
   * Strict equality used to silently drop the broadcast whenever any viewer was
   * present, leaving host optimistic-stale and players/OBS unsynced.
   */
  if (list.length < 1 || list.length > roomIds.size) {
    return
  }
  const used = new Set<string>()
  for (let i = 0; i < list.length; i += 1) {
    const pl = list[i]!
    if (pl.seat !== i + 1) {
      return
    }
    if (!roomIds.has(pl.peerId) || used.has(pl.peerId)) {
      return
    }
    const isLastSeat = i === list.length - 1
    if (pl.role == null && !isLastSeat) {
      return
    }
    used.add(pl.peerId)
  }
  room.clearMafiaPlayerLifeStates()

  // New game starts: drop every per-peer Mafia kill enforcement so
  // previously-eliminated players *can* publish camera/mic again.
  //
  // We intentionally do NOT auto-resume their media producers:
  //
  //   * Video: `Peer` has no "user-paused camera" server field —
  //     `producer.paused` is the only signal. A player who manually
  //     turned camera off before being killed had `producer.paused = true`
  //     already. Auto-resuming on reshuffle would silently turn their
  //     camera back on against their intent. Same risk for screen share.
  //
  //   * Audio: `audioMuted` is set to true on kick, so the user-self-mute
  //     state persists across reshuffle. The player was forcibly muted;
  //     they must unmute manually after the new game starts.
  //
  // Once `forcedCameraOff` / `forcedAudioMuted` flip to false, the
  // player's next camera/mic toggle (`set-outbound-video-paused: false`,
  // `set-audio-muted: false`) is accepted by the existing per-action
  // handlers, which resume the producer and broadcast the updated state.
  // Producer state is unchanged here, so we also skip
  // `peer-outbound-video-paused` / `peer-audio-muted` broadcasts —
  // broadcasting `paused: false` while producers stay paused would be
  // misleading, and broadcasting the unchanged `paused: true` is a no-op.
  const previouslyForcedCameraOff = room.getMafiaForcedCameraOffPeerIds()
  const previouslyForcedMicMuted = room.getMafiaForcedMicMutedPeerIds()
  room.clearAllMafiaPerPeerForceFlags()

  for (const peerId of previouslyForcedCameraOff) {
    const target = room.getPeer(peerId)
    if (!target) continue
    target.forcedCameraOff = false
  }
  for (const peerId of previouslyForcedMicMuted) {
    const target = room.getPeer(peerId)
    if (!target) continue
    target.forcedAudioMuted = false
  }

  // Room-wide `mafia:force-mute-all` is independent of per-peer flags:
  // if it is still active, every non-host must remain forced-muted so
  // reshuffle does not bypass the host's room-wide silence.
  if (room.isMafiaForceMuteAllActive()) {
    const hostPeerId = room.getMafiaHostPeerId()
    for (const target of room.getPeers()) {
      if (target.id === hostPeerId) continue
      target.forcedAudioMuted = true
    }
  }
  /**
   * Persist the validated assignment so a peer joining after this broadcast
   * still sees roles via the join catch-up. Snapshot is in-memory only; cleared
   * automatically when the room disposes.
   */
  room.setMafiaReshuffleSnapshot({
    players: payload.players.map((p) => ({ peerId: p.peerId, seat: p.seat, role: p.role })),
  })
  broadcastMafiaReshuffle(room, payload)
}

function broadcastMafiaPlayerKick(room: Room, payload: { peerId: string }): void {
  broadcastServerMessageToRoom(room, { type: MafiaWs.playerKick, payload })
}

function broadcastMafiaPlayerRevive(room: Room, payload: { peerId: string }): void {
  broadcastServerMessageToRoom(room, { type: MafiaWs.playerRevive, payload })
}

function broadcastMafiaForceCameraOff(room: Room, payload: { peerId: string }): void {
  broadcastServerMessageToRoom(room, { type: MafiaWs.forceCameraOff, payload })
}

function broadcastMafiaForceMuteAll(room: Room, payload: { muted?: boolean }): void {
  broadcastServerMessageToRoom(room, { type: MafiaWs.forceMuteAll, payload })
}

function broadcastMafiaForcePeerMic(room: Room, payload: { peerId: string; muted: boolean }): void {
  broadcastServerMessageToRoom(room, { type: MafiaWs.forcePeerMic, payload })
}

/**
 * Pause every video producer of `target` (matches the existing
 * `mafia:force-camera-off` behavior — does not skip screen-share, eliminated
 * peers should not be sharing screen anyway). Idempotent: skips already
 * paused / closed producers.
 */
async function pauseAllPeerVideoProducers(target: Peer, contextLabel: string): Promise<void> {
  for (const p of target.getProducers()) {
    if (p.kind !== 'video' || p.closed) {
      continue
    }
    if (p.paused) {
      continue
    }
    try {
      await p.pause()
    } catch (e) {
      console.warn(`[signaling] ${contextLabel} video pause failed`, {
        peerId: target.id,
        producerId: p.id,
      }, e)
    }
  }
}

/**
 * Pause every audio producer of `target`. Idempotent. Mirrors the audio
 * loop in `handleMafiaForceMuteAll` but scoped to one peer.
 */
async function pauseAllPeerAudioProducers(target: Peer, contextLabel: string): Promise<void> {
  for (const p of target.getProducers()) {
    if (p.kind !== 'audio' || p.closed) {
      continue
    }
    if (p.paused) {
      continue
    }
    try {
      await p.pause()
    } catch (e) {
      console.warn(`[signaling] ${contextLabel} audio pause failed`, {
        peerId: target.id,
        producerId: p.id,
      }, e)
    }
  }
}

function broadcastPeerOutboundVideoPaused(room: Room, peerId: string, paused: boolean): void {
  const msg: ServerMessage = {
    type: 'peer-outbound-video-paused',
    payload: { peerId, paused },
  }
  for (const observer of room.getPeers()) {
    observer.sendJson(msg)
  }
}

function broadcastPeerEffectiveAudioMuted(room: Room, target: Peer): void {
  const effectiveMuted = target.audioMuted || target.forcedAudioMuted
  const msg: ServerMessage = {
    type: 'peer-audio-muted',
    payload: { peerId: target.id, muted: effectiveMuted },
  }
  for (const observer of room.getPeers()) {
    observer.sendJson(msg)
  }
}




export async function handleMafiaPlayerKick(
  socket: WsSocket,
  payload: { peerId: string },
  deps: SignalingDeps,
): Promise<void> {
  const rp = resolveMafiaOrEatFirstPeerAndRoom(socket, deps)
  if (!rp) {
    return
  }
  const { peer, room } = rp
  if (!canControlPeerEliminationInRoom(room, peer)) {
    return
  }
  const targetId = payload.peerId
  if (typeof targetId !== 'string' || targetId.length < 1) {
    return
  }
  if (targetId === peer.id) {
    return
  }
  const peers = room.getPeers()
  const roomIds = new Set(peers.map((p) => p.id))
  if (!roomIds.has(targetId)) {
    return
  }

  // Idempotency: ignore kick on already-dead peer to avoid duplicate
  // pause/broadcast side effects (rapid clicks, host UI echoes).
  const lifeStates = room.getMafiaPlayerLifeStateSnapshot()
  if (lifeStates[targetId] === 'dead') {
    return
  }

  room.setMafiaPlayerLifeState(targetId, 'dead')
  broadcastMafiaPlayerKick(room, { peerId: targetId })

  // Mafia-only: kill must also disable the eliminated peer's outbound
  // camera + mic for everyone else. Eat First shares this handler but
  // its life-state UX does not flip media — guard the media side effects.
  if (!isMafiaRoomId(room.id)) {
    return
  }
  const target = room.getPeer(targetId)
  if (!target) {
    return
  }

  // Forced camera off (mirrors `handleMafiaForceCameraOff`). Persisted in
  // `mafiaForcedCameraOffPeerIds` so a target reload re-applies the flag
  // before the new producer goes live (see `handleProduce`).
  //
  // The userId mirror is updated unconditionally (even when the peer flag
  // was already true) so a kill performed before authentication settled
  // still gets userId persistence on the next mutation.
  if (!target.forcedCameraOff) {
    target.forcedCameraOff = true
    room.setMafiaPeerForcedCameraOff(targetId, true)
    await pauseAllPeerVideoProducers(target, 'mafia:player-kick')
    broadcastPeerOutboundVideoPaused(room, target.id, true)
  } else if (!room.isMafiaPeerForcedCameraOff(targetId)) {
    // Flag re-sync without a broadcast — keeps `peer.forcedCameraOff` and
    // the room set agreeing on per-peer enforcement state.
    room.setMafiaPeerForcedCameraOff(targetId, true)
  }
  room.setMafiaUserForcedCameraOff(target.userId, true)

  // Per-peer forced mic mute. Independent from room-wide
  // `mafiaForceMuteAllActive` so a single revive can lift it without
  // touching the room-wide toggle.
  //
  // Also force `target.audioMuted = true` synchronously so the
  // user-self-mute state persists across the kick→revive boundary. The
  // client's `mafia:force-peer-mic muted:true` → `toggleMic()` → `set-audio-muted:true`
  // round-trip is async — without this, a revive that races ahead of
  // the client echo would land with `audioMuted=false` server-side and
  // broadcast a spurious `peer-audio-muted: false` to OBS/remotes
  // (no audio leak — producer is still paused — but a misleading UI
  // flicker). Setting it here makes the post-revive effective state
  // unambiguously `muted: true`; the user must explicitly unmute after
  // revive to be heard again.
  target.audioMuted = true
  if (!target.forcedAudioMuted) {
    target.forcedAudioMuted = true
    room.setMafiaPeerForcedMicMuted(targetId, true)
    await pauseAllPeerAudioProducers(target, 'mafia:player-kick')
    broadcastPeerEffectiveAudioMuted(room, target)
  } else if (!room.isMafiaPeerForcedMicMuted(targetId)) {
    room.setMafiaPeerForcedMicMuted(targetId, true)
  }
  room.setMafiaUserForcedMicMuted(target.userId, true)

  // Tell the target's own client to flip its local mic UI off via the
  // existing `toggleMic` action (CallPage listener). The camera UI is
  // already flipped by the existing `mafia:force-camera-off` listener
  // path — but `mafia:player-kick` itself does not trigger that. Emit a
  // dedicated camera signal too so the killed peer's local cam UI flips
  // off (otherwise local preview keeps running and the user may try to
  // talk into a paused mic / show a paused camera).
  broadcastMafiaForcePeerMic(room, { peerId: targetId, muted: true })
  broadcastServerMessageToRoom(room, {
    type: MafiaWs.forceCameraOff,
    payload: { peerId: targetId },
  })
}




export async function handleMafiaPlayerRevive(
  socket: WsSocket,
  payload: { peerId: string },
  deps: SignalingDeps,
): Promise<void> {
  const rp = resolveMafiaOrEatFirstPeerAndRoom(socket, deps)
  if (!rp) {
    return
  }
  const { peer, room } = rp
  if (!canControlPeerEliminationInRoom(room, peer)) {
    return
  }
  const targetId = payload.peerId
  if (typeof targetId !== 'string' || targetId.length < 1 || targetId === peer.id) {
    return
  }
  const roomIds = new Set(room.getPeers().map((p) => p.id))
  if (!roomIds.has(targetId)) {
    return
  }

  // Idempotency: only "dead" peers can be revived. Acts as the single
  // gate for "kill→revive" media-flag transitions so a re-revive on an
  // already-ghost / already-alive peer is a no-op.
  const lifeStates = room.getMafiaPlayerLifeStateSnapshot()
  if (lifeStates[targetId] !== 'dead') {
    return
  }

  room.setMafiaPlayerLifeState(targetId, 'ghost')
  broadcastMafiaPlayerRevive(room, { peerId: targetId })

  if (!isMafiaRoomId(room.id)) {
    return
  }
  const target = room.getPeer(targetId)
  if (!target) {
    return
  }

  // Clear forced camera off. Do NOT auto-resume video producers — let
  // the player toggle camera through normal controls. Once the flag is
  // false, `handleSetOutboundVideoPaused` will accept the player's next
  // `set-outbound-video-paused: false`.
  //
  // Both the peerId set (live target) and the userId mirror (cross-tab
  // identity) are cleared so a future fresh-tab rejoin is no longer
  // auto-flagged.
  if (target.forcedCameraOff) {
    target.forcedCameraOff = false
  }
  room.setMafiaPeerForcedCameraOff(targetId, false)
  room.clearMafiaForceStateForUser(target.userId)

  // Clear per-peer forced mic. Mafia `force-mute-all` is implemented as a
  // soft mute (writes `audioMuted` only, leaves `forcedAudioMuted` alone),
  // so dropping the per-peer hard flag here will not let the revived peer
  // bypass an active room-wide silence: their producer stays paused via
  // `audioMuted`, and `handleSetAudioMuted` will resume it only when the
  // player explicitly self-unmutes after revive (mirrors the camera path
  // above, which is also always cleared regardless of mute-all). Without
  // this, kill→revive while mute-all was active left `forcedAudioMuted`
  // stuck on, so the player's mic UI flipped on but `handleSetAudioMuted`
  // refused to resume the producer (`!peer.forcedAudioMuted` gate) and
  // remote peers heard nothing.
  if (target.forcedAudioMuted) {
    target.forcedAudioMuted = false
  }
  room.setMafiaPeerForcedMicMuted(targetId, false)
  // Effective state may have changed (forced flag dropped). Broadcast so
  // remotes/OBS update their per-peer mute badge.
  broadcastPeerEffectiveAudioMuted(room, target)
  // Notify clients (notably the target peer) that the per-peer mic
  // force is lifted. The target's local mic stays off — see CallPage
  // listener: only `muted: true` flips local mic UI; `muted: false`
  // is a UI hint clear, not an auto-unmute.
  broadcastMafiaForcePeerMic(room, { peerId: targetId, muted: false })
}

export async function handleMafiaForceCameraOff(
  socket: WsSocket,
  payload: { peerId: string; paused?: boolean },
  deps: SignalingDeps,
): Promise<void> {
  const rp = resolveMafiaPeerAndRoom(socket, deps)
  if (!rp) {
    return
  }
  const { peer, room } = rp
  if (!isMafiaHostPeer(room, peer)) {
    return
  }
  const targetId = payload.peerId
  if (typeof targetId !== 'string' || targetId.length < 1 || targetId === peer.id) {
    return
  }
  const target = room.getPeer(targetId)
  if (!target) {
    return
  }
  
  
  const paused = payload.paused !== false

  // Server-side enforcement: pause/resume every video producer for the
  
  // producer too is intentional: a non-cooperating target that spoofed the
  // `producer-video-source` tag would otherwise bypass the host's "no
  
  
  
  target.forcedCameraOff = paused
  room.setMafiaPeerForcedCameraOff(targetId, paused)
  // Mirror to userId set so a future fresh-tab rejoin re-applies the flag
  // (or clears it on toggle-off). Anonymous peers (empty userId) no-op
  // inside the setter and remain peerId-only.
  room.setMafiaUserForcedCameraOff(target.userId, paused)
  for (const p of target.getProducers()) {
    if (p.kind !== 'video' || p.closed) {
      continue
    }
    try {
      if (paused) {
        if (!p.paused) {
          await p.pause()
        }
      } else if (p.paused) {
        await p.resume()
      }
    } catch (e) {
      console.warn('[signaling] mafia:force-camera-off pause/resume failed', {
        peerId: target.id,
        producerId: p.id,
      }, e)
    }
  }

  
  
  
  const videoMsg: ServerMessage = {
    type: 'peer-outbound-video-paused',
    payload: { peerId: target.id, paused },
  }
  for (const observer of room.getPeers()) {
    observer.sendJson(videoMsg)
  }

  broadcastMafiaForceCameraOff(room, { peerId: targetId })
}

export async function handleMafiaForceMuteAll(
  socket: WsSocket,
  payload: { muted?: boolean },
  deps: SignalingDeps,
): Promise<void> {
  const rp = resolveMafiaPeerAndRoom(socket, deps)
  if (!rp) {
    return
  }
  const { peer: hostPeer, room } = rp
  if (!isMafiaHostPeer(room, hostPeer)) {
    return
  }
  const muted = payload.muted !== false

  
  
  room.setMafiaForceMuteAllActive(muted)

  
  
  
  
  
  
  for (const target of room.getPeers()) {
    if (target.id === hostPeer.id) {
      continue
    }
    // Soft mute (vs. kick's hard `forcedAudioMuted`): write `audioMuted` so a
    // player can self-unmute via the normal `set-audio-muted: false` flow
    // without the server hard-blocking the producer resume. Without this,
    // the player's local mic UI showed "on" after click but other peers
    // never heard them, because `handleSetAudioMuted` gates resume on
    // `!peer.forcedAudioMuted`. Host's "mute all" button derivation
    // (`mafiaForceMuteAllActive && everyNonHostEffectivelyMuted`) flips
    // back to "available" via the per-peer `peer-audio-muted: false`
    // broadcast and one click re-asserts mute-all for the room.
    target.audioMuted = muted
    for (const p of target.getProducers()) {
      if (p.kind !== 'audio' || p.closed) {
        continue
      }
      try {
        if (muted) {
          if (!p.paused) {
            await p.pause()
          }
        } else if (p.paused && !target.audioMuted) {
          
          
          await p.resume()
        }
      } catch (e) {
        console.warn('[signaling] mafia:force-mute-all pause/resume failed', {
          peerId: target.id,
          producerId: p.id,
        }, e)
      }
    }
    
    
    const effectiveMuted = target.audioMuted || target.forcedAudioMuted
    const audioMsg: ServerMessage = {
      type: 'peer-audio-muted',
      payload: { peerId: target.id, muted: effectiveMuted },
    }
    for (const observer of room.getPeers()) {
      observer.sendJson(audioMsg)
    }
  }

  broadcastMafiaForceMuteAll(room, { muted })
}

export async function handleEatFirstForceMuteAll(
  socket: WsSocket,
  payload: { muted?: boolean },
  deps: SignalingDeps,
): Promise<void> {
  const rp = resolveEatFirstPeerAndRoom(socket, deps)
  if (!rp) return
  const { peer, room } = rp
  if (!isEatFirstHostPeer(room, peer)) return

  const muted = payload.muted !== false

  for (const target of room.getPeers()) {
    if (target.id === peer.id) continue
    target.forcedAudioMuted = muted
    for (const p of target.getProducers()) {
      if (p.kind !== 'audio' || p.closed) continue
      try {
        if (muted) {
          if (!p.paused) await p.pause()
        } else if (p.paused && !target.audioMuted) {
          await p.resume()
        }
      } catch (e) {
        console.warn('[signaling] eat:force-mute-all pause/resume failed', { peerId: target.id }, e)
      }
    }
    const effectiveMuted = target.audioMuted || target.forcedAudioMuted
    const audioMsg: ServerMessage = {
      type: 'peer-audio-muted',
      payload: { peerId: target.id, muted: effectiveMuted },
    }
    for (const observer of room.getPeers()) {
      observer.sendJson(audioMsg)
    }
  }

  broadcastServerMessageToRoom(room, { type: 'eat:force-mute-all', payload: { muted } })
}

/** Strip the `eat:` signaling prefix; the remainder is the persistent Eat First gameId. */
function eatFirstGameIdFromRoomId(roomId: string): string {
  return roomId.startsWith(EAT_FIRST_ROOM_PREFIX) ? roomId.slice(EAT_FIRST_ROOM_PREFIX.length) : ''
}

/**
 * Bind the call peer to an Eat First slot id (`p1..p11`) after verifying the
 * client-supplied `joinToken`+`deviceId` against `EatFirstPlayer.data` (mirrors
 * REST player-action auth in `authorizePlayerAction`). Call moderator (host) never
 * binds a slot — not a seated player. On success rebroadcasts full table state so every participant
 * sees the refreshed peer→slot map.
 *
 * Idempotent: re-claiming the same slot is a no-op; claiming a different slot
 * for the same peer rebinds (last write wins, both must pass token auth). A
 * different peer claiming a slot already bound to another peer is rejected to
 * keep the mapping authoritative.
 */
export async function handleEatFirstSlotClaim(
  socket: WsSocket,
  payload: { slotId: string; joinToken: string; deviceId: string },
  deps: SignalingDeps,
): Promise<void> {
  const peer = deps.socketPeer.get(socket)
  if (!peer) return
  const room = deps.roomManager.getRoom(peer.roomId)
  if (!room || !isEatFirstRoomId(room.id)) return
  const gameId = eatFirstGameIdFromRoomId(room.id)
  if (!gameId) return
  await hydrateEatFirstOwnerUserIdFromDb(room.id)
  const slotId = normalizeEatFirstSlot(payload.slotId)
  if (!isEatFirstPlayerSlotId(slotId)) return
  const token = typeof payload.joinToken === 'string' ? payload.joinToken.trim() : ''
  const deviceId = typeof payload.deviceId === 'string' ? payload.deviceId.trim() : ''
  const credsEmpty = token.length === 0 && deviceId.length === 0
  const isEatFirstRoomHostPeer = isEatFirstHostPeer(room, peer)
  if (isEatFirstRoomHostPeer) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[eat-first:slot-claim:reject]', {
        roomId: room.id,
        gameId,
        peerId: peer.id,
        reason: 'host-not-player',
      })
    }
    return
  }
  if (!credsEmpty && (token.length === 0 || deviceId.length === 0)) return
  if (credsEmpty) return
  if (process.env.NODE_ENV !== 'production') {
    console.info('[eat-first:slot-claim:recv]', {
      roomId: room.id,
      gameId,
      peerId: peer.id,
      slotId,
    })
  }
  const slotExists = await eatFirstPlayerSlotRowExists(gameId, slotId)
  if (!slotExists) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[eat-first:slot-claim:reject]', {
        roomId: room.id,
        gameId,
        peerId: peer.id,
        slotId,
        reason: 'no-slot',
      })
    }
    return
  }
  const verdict: SlotAuthResult = await verifyEatFirstSlotAuth(gameId, slotId, deviceId, token)
  const allowed = verdict.ok
  if (!allowed) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[eat-first:slot-claim:reject]', {
        roomId: room.id,
        gameId,
        peerId: peer.id,
        slotId,
        reason: verdict.reason,
      })
    }
    return
  }
  // Reject if a different live peer already holds this slot — the mapping must
  // stay 1:1 to keep trait/action-card lookups deterministic.
  for (const other of room.getPeers()) {
    if (other.id !== peer.id && other.eatFirstSlotId === slotId) {
      if (process.env.NODE_ENV !== 'production') {
        console.info('[eat-first:slot-claim:reject]', {
          roomId: room.id,
          gameId,
          peerId: peer.id,
          slotId,
          reason: 'slot-occupied',
          occupiedByPeerId: other.id,
        })
      }
      return
    }
  }
  if (peer.eatFirstSlotId === slotId) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[eat-first:slot-claim:noop]', {
        roomId: room.id,
        gameId,
        peerId: peer.id,
        slotId,
      })
    }
    return
  }
  /**
   * Audit P1: when a peer rebinds from one slot to another (e.g., after
   * sessionStorage clear + new claim), cleanly evict the abandoned slot
   * from in-memory table state IF nobody else holds it. Otherwise the
   * old slot lingers in `state.traitsBySlot` / `actionCardBySlot` /
   * reveal maps and surfaces in the next `eat:table-state-sync` as a
   * phantom seat without a peer mapping.
   */
  const previousSlot = peer.eatFirstSlotId
  if (
    typeof previousSlot === 'string' &&
    isEatFirstPlayerSlotId(previousSlot) &&
    previousSlot !== slotId &&
    room.getPeers().every((other) => other.id === peer.id || other.eatFirstSlotId !== previousSlot)
  ) {
    const state = getEatFirstTableState(room.id)
    state.traitsBySlot.delete(previousSlot)
    state.actionCardBySlot.delete(previousSlot)
    state.revealedBySlot.delete(previousSlot)
    state.openedByBySlot.delete(previousSlot)
    if (state.lastUsedActionCard?.slotId === previousSlot) {
      state.lastUsedActionCard = null
    }
    state.playerOrder = state.playerOrder.filter((s) => s !== previousSlot)
  }
  peer.eatFirstSlotId = slotId
  if (process.env.NODE_ENV !== 'production') {
    console.info('[eat-first:slot-claim:accept]', {
      roomId: room.id,
      gameId,
      peerId: peer.id,
      slotId,
    })
  }
  await hydrateEatFirstTableStateFromDb(room.id)
  await broadcastEatFirstTableState(room)
}

/**
 * Reveal/close one trait for a given slot. Peers may only request their own
 * slot (`peer.eatFirstSlotId === slotId`); the room host may toggle any slot.
 * Stale clients still sending peerId-based payloads are silently rejected by
 * the schema, which keeps the wire shape strict.
 */
export async function handleEatFirstTraitRevealRequest(
  socket: WsSocket,
  payload: { slotId: string; traitKey: EatFirstTraitKey; closed?: boolean },
  deps: SignalingDeps,
): Promise<void> {
  const rp = resolveEatFirstPeerAndRoom(socket, deps)
  if (!rp) return
  const { peer, room } = rp
  const slotId = normalizeEatFirstSlot(payload.slotId)
  if (!isEatFirstPlayerSlotId(slotId)) return
  const traitKey = payload.traitKey
  const isHost = isEatFirstHostPeer(room, peer)
  if (!isHost && peer.eatFirstSlotId !== slotId) {
    return
  }
  const close = payload.closed === true
  const changed = applyEatFirstTraitReveal(room.id, slotId, traitKey, isHost ? 'host' : 'player', close)
  if (!changed) {
    return
  }
  const openedBy: 'player' | 'host' = isHost ? 'host' : 'player'
  broadcastServerMessageToRoom(room, {
    type: 'eat:trait-revealed',
    payload: { slotId, traitKey, openedBy, ...(close ? { closed: true } : {}) },
  })
  try {
    await persistEatFirstCallSignalingSnapshot(room.id, peer.userId?.trim() || null)
  } catch {
    /* overlay persistence must not block UX; joins may miss latest overlay until retry */
  }
  await broadcastEatFirstTableState(room)
}

export async function handleEatFirstTraitRegenerateRequest(
  socket: WsSocket,
  payload: { slotId: string; traitKey: EatFirstTraitKey },
  deps: SignalingDeps,
): Promise<void> {
  const rp = resolveEatFirstPeerAndRoom(socket, deps)
  if (!rp) return
  const { peer, room } = rp
  if (!isEatFirstHostPeer(room, peer)) return
  await getHydratedEatFirstTableState(room.id)
  const slotId = normalizeEatFirstSlot(payload.slotId)
  if (!isEatFirstPlayerSlotId(slotId)) return
  const traitKey = payload.traitKey
  const nextValue = applyEatFirstTraitReroll(room.id, slotId, traitKey)
  if (typeof nextValue !== 'string' || nextValue.length < 1) return
  broadcastServerMessageToRoom(room, {
    type: 'eat:trait-regenerated',
    payload: { slotId, traitKey, value: nextValue },
  })
  await broadcastEatFirstTableState(room)
}

/**
 * Reroll one trait type for **every** active slot in the room. Active slots
 * are derived from `peer.eatFirstSlotId` (set after `eat:slot-claim`); peers
 * without a slot are skipped — viewer/host tabs never get phantom overrides.
 *
 * The new value bypasses the legacy `traitsBySlot` snapshot by going through
 * the override map, so the host can rotate values mid-game without touching
 * the persistent player records.
 */
export async function handleEatFirstTraitTypeRerollRequest(
  socket: WsSocket,
  payload: { traitKey: EatFirstTraitKey },
  deps: SignalingDeps,
): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    console.info('[eat-first:handler:start]', {
      action: 'trait-type-reroll',
      traitKey: payload.traitKey,
    })
  }
  const rp = resolveEatFirstPeerAndRoom(socket, deps)
  if (!rp) return
  const { peer, room } = rp
  if (!isEatFirstHostPeer(room, peer)) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[eat-first:handler:reject]', {
        action: 'trait-type-reroll',
        reason: 'not-host',
        peerId: peer.id,
        roomId: room.id,
      })
    }
    return
  }
  await getHydratedEatFirstTableState(room.id)
  const traitKey = payload.traitKey
  const valuesBySlot = applyEatFirstTraitTypeReroll(room.id, traitKey)
  if (Object.keys(valuesBySlot).length < 1) return
  broadcastServerMessageToRoom(room, {
    type: 'eat:trait-type-rerolled',
    payload: { traitKey, valuesBySlot },
  })
  if (process.env.NODE_ENV !== 'production') {
    console.info('[eat-first:handler:success]', {
      action: 'trait-type-reroll',
      roomId: room.id,
      slots: Object.keys(valuesBySlot).length,
    })
  }
  await broadcastEatFirstTableState(room)
}

/**
 * Reroll the action card for one slot, or for every active slot when
 * `slotId === '*'`. The card snapshot is persisted on `EatFirstPlayer.data`
 * via `eatFirstMergePlayerAdmin` so the next `efSnapshot` poll surfaces the
 * fresh card; the signaling broadcast is a fast-path so call tiles update
 * without waiting for the next poll cycle.
 */
export async function handleEatFirstActionCardRerollRequest(
  socket: WsSocket,
  payload: { slotId: string },
  deps: SignalingDeps,
): Promise<void> {
  const rp = resolveEatFirstPeerAndRoom(socket, deps)
  if (!rp) return
  const { peer, room } = rp
  if (!isEatFirstHostPeer(room, peer)) return
  const gameId = eatFirstGameIdFromRoomId(room.id)
  if (!gameId) return
  const wantAll = payload.slotId === '*'
  const targetSlots: string[] = []
  if (wantAll) {
    targetSlots.push(...eatFirstActiveSlotsForRoom(room, room.id))
  } else {
    const slot = normalizeEatFirstSlot(payload.slotId)
    if (!isEatFirstPlayerSlotId(slot)) return
    targetSlots.push(slot)
  }
  /**
   * Audit P1: when the host re-rolls the same slot whose card is in the
   * "last used" host-panel chip, that chip needs to clear so it does not
   * keep advertising a card that no longer exists. Snapshot before mutation
   * so we can compare against `targetSlots` regardless of '*' vs single.
   */
  {
    const stateBefore = getEatFirstTableState(room.id)
    const lastUsedSlot = stateBefore.lastUsedActionCard?.slotId
    if (lastUsedSlot != null && targetSlots.includes(lastUsedSlot)) {
      stateBefore.lastUsedActionCard = null
    }
  }
  for (const slotId of targetSlots) {
    const card = pickRandomEatFirstActiveCard()
    try {
      await eatFirstMergePlayerAdmin(gameId, slotId, { activeCard: card }, peer.userId || null)
    } catch {
      // Persistence failure should not block the rest of a "reroll all" loop.
      continue
    }
    setEatFirstActionCard(room.id, slotId, card)
    broadcastServerMessageToRoom(room, {
      type: 'eat:action-card-rerolled',
      payload: { slotId, card },
    })
  }
  broadcastEatFirstTableState(room).catch((err) => {
    console.error('[eat-first] broadcastEatFirstTableState after action-card-reroll failed', {
      roomId: room.id,
      err: err instanceof Error ? err.message : String(err),
    })
  })
}

export async function handleEatFirstActionCardUse(
  socket: WsSocket,
  payload: { slotId: string },
  deps: SignalingDeps,
): Promise<void> {
  const rp = resolveEatFirstPeerAndRoom(socket, deps)
  if (!rp) return
  const { peer, room } = rp
  const gameId = eatFirstGameIdFromRoomId(room.id)
  if (!gameId) return

  const slot = normalizeEatFirstSlot(payload.slotId)
  if (!isEatFirstPlayerSlotId(slot)) return

  if (!isEatFirstHostPeer(room, peer)) {
    const mine = typeof peer.eatFirstSlotId === 'string' ? peer.eatFirstSlotId.trim() : ''
    if (mine !== slot) return
  }

  await getHydratedEatFirstTableState(room.id)
  const state = getEatFirstTableState(room.id)
  const before = state.actionCardBySlot.get(slot)
  if (!before) return
  if (before.used) return

  const next = setEatFirstActionCardUsed(room.id, slot)
  if (!next) return

  try {
    await eatFirstMergePlayerAdmin(
      gameId,
      slot,
      {
        activeCard: {
          title: next.title,
          description: next.description,
          templateId: next.templateId,
          effectId: next.effectId,
          used: true,
        },
      },
      peer.userId?.trim() || null,
    )
  } catch {
    /* persistence failure: memory state stays used for this session */
  }

  try {
    await persistEatFirstCallSignalingSnapshot(room.id, peer.userId?.trim() || null)
  } catch {
    /* same as trait overlay: memory broadcast still updates connected clients */
  }

  broadcastServerMessageToRoom(room, {
    type: 'eat:action-card-used',
    payload: { slotId: slot, title: next.title, peerId: peer.id },
  })

  await broadcastEatFirstTableState(room)
}

export async function handleEatFirstPlayersUpdate(
  socket: WsSocket,
  payload: { playerOrder?: string[]; order?: string[] },
  deps: SignalingDeps,
): Promise<void> {
  const rp = resolveEatFirstPeerAndRoom(socket, deps)
  if (!rp) return
  const { peer, room } = rp
  if (!isEatFirstHostPeer(room, peer)) return
  const incoming = Array.isArray(payload.playerOrder)
    ? payload.playerOrder
    : Array.isArray(payload.order)
      ? payload.order
      : []
  if (incoming.length < 1) return
  const order = incoming.map((s) => normalizeEatFirstSlot(s)).filter((s) => isEatFirstPlayerSlotId(s))
  if (order.length !== incoming.length) return
  const dedup = new Set(order)
  if (dedup.size !== order.length) return
  await hydrateEatFirstTableStateFromDb(room.id)
  const allowed = eatFirstActiveSlotsForRoom(room, room.id)
  if (allowed.length > 0) {
    if (order.length !== allowed.length) return
    const allowedSet = new Set(allowed)
    if (!order.every((slot) => allowedSet.has(slot))) return
  }
  const ok = setEatFirstPlayerOrder(room.id, order)
  if (!ok) return
  await broadcastEatFirstTableState(room)
}

async function persistEatFirstTableMemorySlotsToDb(
  room: Room,
  gameId: string,
  ownerUserId: string | null,
): Promise<void> {
  const state = getEatFirstTableState(room.id)
  const slots = new Set<string>()
  for (const s of state.playerOrder) {
    if (isEatFirstPlayerSlotId(s)) slots.add(s)
  }
  for (const s of state.traitsBySlot.keys()) {
    if (isEatFirstPlayerSlotId(s)) slots.add(s)
  }
  for (const slotId of slots) {
    const rowMap = state.traitsBySlot.get(slotId)
    if (!rowMap) continue
    const traits = {} as Record<EatFirstTraitKey, string>
    for (const key of EAT_FIRST_TRAIT_KEYS) {
      let v = rowMap.get(key)
      if (typeof v !== 'string' || v.trim().length < 1) {
        v = pickEatFirstTraitValue(key)
        rowMap.set(key, v)
      }
      traits[key] = v.trim()
    }
    let card = state.actionCardBySlot.get(slotId)
    if (!card) {
      const rolled = pickRandomEatFirstActiveCard()
      card = { ...rolled, used: false }
      state.actionCardBySlot.set(slotId, card)
    }
    const patch = eatFirstAdminPatchForFullCharacterDeal(traits, card)
    try {
      await eatFirstMergePlayerAdmin(gameId, slotId, patch, ownerUserId)
    } catch {
      /* ignore single-slot persistence failure */
    }
  }
}

/**
 * Host-only "deal table": DB reshuffle (swap + playerOrder), drop stale signaling
 * memory, re-hydrate from Prisma, persist full traits/cards + reset reveal ledger fields,
 * broadcast `eat:table-state-sync` to every peer.
 */
export async function handleEatFirstTableRoundDeal(socket: WsSocket, deps: SignalingDeps): Promise<void> {
  const rp = resolveEatFirstPeerAndRoom(socket, deps)
  if (!rp) return
  const { peer, room } = rp
  if (!isEatFirstHostPeer(room, peer)) return
  const gameId = eatFirstGameIdFromRoomId(room.id)
  if (!gameId) return
  const ownerUserId = peer.userId.trim().length > 0 ? peer.userId.trim() : null
  const participantCount = Math.max(
    room.getPeers().length,
    eatFirstActiveSlotsForRoom(room, room.id).length,
  )
  try {
    await eatFirstHostReshuffleAdmin(gameId, participantCount, ownerUserId)
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[eat-first:table-round-deal]', 'host-reshuffle-failed', err)
    }
    return
  }
  disposeEatFirstTableState(room.id)
  await hydrateEatFirstTableStateFromDb(room.id)
  resetEatFirstTableRoundDealConsumables(room.id)
  await persistEatFirstTableMemorySlotsToDb(room, gameId, ownerUserId)
  try {
    await persistEatFirstCallSignalingSnapshot(room.id, ownerUserId)
  } catch {
    /* non-blocking: same policy as trait-reveal persistence */
  }
  room.setEatFirstSpeakingQueue([])
  broadcastEatFirstSpeakingQueueUpdate(room)
  room.clearMafiaPlayerLifeStates()
  broadcastServerMessageToRoom(room, {
    type: MafiaWs.playerLifeState,
    payload: { states: room.getMafiaPlayerLifeStateSnapshot() },
  })
  await broadcastEatFirstTableState(room)
}

export async function handleEatFirstTimerStart(
  socket: WsSocket,
  payload: { startedAt: number; duration: number },
  deps: SignalingDeps,
): Promise<void> {
  const rp = resolveEatFirstPeerAndRoom(socket, deps)
  if (!rp) return
  const { peer, room } = rp
  if (!isEatFirstHostPeer(room, peer)) return

  const { startedAt, duration } = payload
  const serverNow = Date.now()
  if (startedAt > serverNow + 60_000) return
  if (startedAt < serverNow - 120_000) return
  const elapsed = serverNow - startedAt
  if (elapsed >= duration) return

  setEatFirstTimer(room.id, { startedAt, duration })

  const gameId = eatFirstGameIdFromRoomId(room.id)
  if (gameId) {
    const speakingSec = Math.max(1, Math.floor(duration / 1000))
    try {
      await eatFirstMergeRoomAdmin(
        gameId,
        {
          speakingTimer: speakingSec,
          timerStartedAt: new Date(startedAt).toISOString(),
          timerPaused: false,
          timerRemainingFrozen: null,
        },
        peer.userId.trim().length > 0 ? peer.userId.trim() : null,
      )
    } catch {
      // Ignore persistence failures: in-memory timer + signaling broadcast remain authoritative.
    }
  }

  await broadcastEatFirstTableState(room)
}

export async function handleEatFirstTimerStop(socket: WsSocket, deps: SignalingDeps): Promise<void> {
  const rp = resolveEatFirstPeerAndRoom(socket, deps)
  if (!rp) return
  const { peer, room } = rp
  if (!isEatFirstHostPeer(room, peer)) return

  setEatFirstTimer(room.id, null)

  const gameId = eatFirstGameIdFromRoomId(room.id)
  if (gameId) {
    try {
      await eatFirstMergeRoomAdmin(
        gameId,
        {
          currentSpeaker: '',
          timerStartedAt: null,
          speakingTimer: 0,
          timerPaused: false,
          timerRemainingFrozen: null,
        },
        peer.userId.trim().length > 0 ? peer.userId.trim() : null,
      )
    } catch {
      // Same persistence posture as timer-start.
    }
  }

  await broadcastEatFirstTableState(room)
}

function broadcastMafiaPlayersUpdate(
  room: Room,
  payload: {
    order: string[]
    clearRoles?: boolean
    oldMafiaMode?: boolean
    nightActions?: {
      mafia?: number
      doctor?: number
      sheriff?: number
      don?: number
    }
    speakingQueue: number[]
  },
): void {
  broadcastServerMessageToRoom(room, { type: MafiaWs.playersUpdate, payload })
}

function broadcastMafiaModeUpdate(room: Room, payload: { mode: 'old' | 'new' }): void {
  room.setMafiaMode(payload.mode)
  broadcastServerMessageToRoom(room, { type: MafiaWs.modeUpdate, payload })
}

function broadcastMafiaSettingsUpdate(
  room: Room,
  payload: { deadBackgrounds: MafiaBackgroundItem[]; activeBackgroundId: string | null },
): void {
  room.setMafiaDeadBackgroundSettings(payload.deadBackgrounds, payload.activeBackgroundId)
  broadcastServerMessageToRoom(room, { type: MafiaWs.settingsUpdate, payload })
}

function broadcastMafiaPageBackgroundSettings(
  room: Room,
  payload: {
    backgrounds: MafiaPageBackgroundItem[]
    selectedBackgroundId: string | null
    forcedBackgroundId: string | null
  },
): void {
  room.setMafiaPageBackgroundSettings(payload.backgrounds, payload.forcedBackgroundId)
  broadcastServerMessageToRoom(room, { type: MafiaWs.pageBackgroundSettings, payload })
}




export function handleMafiaPlayersUpdate(
  socket: WsSocket,
  payload: {
    order: string[]
    clearRoles?: boolean
    oldMafiaMode?: boolean
    nightActions?: {
      mafia?: number
      doctor?: number
      sheriff?: number
      don?: number
    }
    speakingQueue: number[]
  },
  deps: SignalingDeps,
): void {
  const rp = resolveMafiaPeerAndRoom(socket, deps)
  if (!rp) {
    return
  }
  const { peer, room } = rp
  if (!isMafiaHostPeer(room, peer)) {
    return
  }
  const peers = room.getPeers()
  if (peers.length < 1) {
    return
  }
  const roomIds = new Set(peers.map((p) => p.id))
  const { order: list, speakingQueue: q } = payload
  /**
   * Audit: list may be a subset of room peers — viewer-role peers (e.g. OBS view)
   * never enter the host's tile list. Strict equality previously dropped the
   * broadcast whenever any viewer joined the room, so host saw the change but
   * players/OBS did not.
   */
  if (list.length < 1 || list.length > roomIds.size) {
    return
  }
  const used = new Set<string>()
  for (const id of list) {
    if (!roomIds.has(id) || used.has(id)) {
      return
    }
    used.add(id)
  }
  const n = list.length
  for (const x of q) {
    if (typeof x !== 'number' || !Number.isInteger(x) || x < 1 || x > n) {
      return
    }
  }
  const na = payload.nightActions
  if (na) {
    for (const v of Object.values(na)) {
      if (v != null && (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > n)) {
        return
      }
    }
  }
  if (typeof payload.oldMafiaMode === 'boolean') {
    room.setMafiaMode(payload.oldMafiaMode ? 'old' : 'new')
  }
  if (payload.clearRoles === true) {
    room.clearMafiaPlayerLifeStates()
  }
  room.setMafiaPlayersUpdateSnapshot(payload)
  broadcastMafiaPlayersUpdate(room, payload)
}

export function handleMafiaPlayerNameUpdate(
  socket: WsSocket,
  payload: { targetPeerId: string; displayName: string },
  deps: SignalingDeps,
): void {
  const rp = resolveMafiaPeerAndRoom(socket, deps)
  if (!rp) {
    return
  }
  const { peer, room } = rp
  const targetPeerId = typeof payload.targetPeerId === 'string' ? payload.targetPeerId.trim() : ''
  if (!targetPeerId) {
    return
  }
  const isSelfRename = targetPeerId === peer.id
  if (!isSelfRename && !isMafiaHostPeer(room, peer)) {
    return
  }
  const target = room.getPeer(targetPeerId)
  if (!target) {
    return
  }
  const trimmed = typeof payload.displayName === 'string' ? payload.displayName.trim().slice(0, 64) : ''
  const name = trimmed.length > 0 ? trimmed : null
  room.setMafiaNickname(targetPeerId, name)
  broadcastServerMessageToRoom(room, {
    type: MafiaWs.playerNicknameUpdate,
    payload: { peerId: targetPeerId, displayName: name ?? '' },
  })
}

export function handleMafiaModeUpdate(
  socket: WsSocket,
  payload: { mode: 'old' | 'new' },
  deps: SignalingDeps,
): void {
  const rp = resolveMafiaPeerAndRoom(socket, deps)
  if (!rp) {
    return
  }
  const { peer, room } = rp
  if (!isMafiaHostPeer(room, peer)) {
    return
  }
  broadcastMafiaModeUpdate(room, payload)
}

export function handleMafiaSettingsUpdate(
  socket: WsSocket,
  payload: { deadBackgrounds: MafiaBackgroundItem[]; activeBackgroundId: string | null },
  deps: SignalingDeps,
): void {
  const rp = resolveMafiaPeerAndRoom(socket, deps)
  if (!rp) {
    return
  }
  const { peer, room } = rp
  if (!isMafiaHostPeer(room, peer)) {
    return
  }
  const ids = new Set(payload.deadBackgrounds.map((background) => background.id))
  if (ids.size !== payload.deadBackgrounds.length) {
    return
  }
  if (payload.activeBackgroundId != null && !ids.has(payload.activeBackgroundId)) {
    return
  }
  broadcastMafiaSettingsUpdate(room, payload)
}

export function handleMafiaPageBackgroundSettings(
  socket: WsSocket,
  payload: {
    backgrounds: MafiaPageBackgroundItem[]
    selectedBackgroundId: string | null
    forcedBackgroundId: string | null
  },
  deps: SignalingDeps,
): void {
  
  
  // The correct invariant: must be a Mafia room AND must be the host.
  const rp = resolveMafiaPeerAndRoom(socket, deps)
  if (!rp) {
    return
  }
  const { peer, room } = rp
  if (!isMafiaHostPeer(room, peer)) {
    return
  }
  const ids = new Set(payload.backgrounds.map((background) => background.id))
  if (ids.size !== payload.backgrounds.length) {
    return
  }
  if (payload.forcedBackgroundId != null && !ids.has(payload.forcedBackgroundId)) {
    return
  }
  broadcastMafiaPageBackgroundSettings(room, payload)
}

/**
 * Host-only audio mix delta. Validates Mafia host authority, normalizes the
 * entries via the room store (clamps volume, prefers stable userId key), then
 * fans the resolved entries out to every peer in the room. OBS `?mode=view`
 * clients apply via existing `setRemoteListenVolume`/`setRemoteListenMuted`;
 * other participants ignore inbound updates so their personal listening prefs
 * stay untouched (filtered client-side in `useMafiaAudioMixSignaling`).
 */
export function handleMafiaAudioMixUpdate(
  socket: WsSocket,
  payload: {
    entries: Array<{ peerId: string; userId?: string | null; volume: number; muted: boolean }>
  },
  deps: SignalingDeps,
): void {
  const rp = resolveMafiaPeerAndRoom(socket, deps)
  if (!rp) {
    return
  }
  const { peer, room } = rp
  if (!isMafiaHostPeer(room, peer)) {
    return
  }
  // Never trust the client-supplied `userId`. Resolve each entry's userId from
  // the target peer's server-side identity so a malicious host cannot store a
  // mix entry under a victim's userId (which would persist across rebinds via
  // `rebindMafiaAudioMixEntryPeerId`).
  const serverAuthoritativeEntries = payload.entries.map((entry) => {
    const targetPeerId = typeof entry.peerId === 'string' ? entry.peerId.trim() : ''
    const target = targetPeerId.length > 0 ? room.getPeer(targetPeerId) : null
    const serverUserId = typeof target?.userId === 'string' ? target.userId.trim() : ''
    return {
      peerId: entry.peerId,
      userId: serverUserId.length > 0 ? serverUserId : null,
      volume: entry.volume,
      muted: entry.muted,
    }
  })
  const resolved = room.applyMafiaAudioMixEntries(serverAuthoritativeEntries)
  if (resolved.length === 0) {
    return
  }
  broadcastServerMessageToRoom(room, {
    type: MafiaWs.audioMixUpdate,
    payload: { entries: resolved },
  })
}

function broadcastMafiaTimerStart(
  room: Room,
  payload: { startedAt: number; duration: number; isRunning: true },
): void {
  broadcastServerMessageToRoom(room, { type: MafiaWs.timerStart, payload })
}

function broadcastMafiaTimerStop(room: Room): void {
  broadcastServerMessageToRoom(room, { type: MafiaWs.timerStop, payload: {} })
}




export function handleMafiaTimerStart(
  socket: WsSocket,
  payload: { startedAt: number; duration: number; isRunning?: boolean },
  deps: SignalingDeps,
): void {
  const rp = resolveMafiaPeerAndRoom(socket, deps)
  if (!rp) {
    return
  }
  const { peer, room } = rp
  if (!isMafiaHostPeer(room, peer)) {
    return
  }
  if (payload.isRunning === false) {
    return
  }
  const { startedAt, duration } = payload
  const serverNow = Date.now()
  if (startedAt > serverNow + 60_000) {
    return
  }
  if (startedAt < serverNow - 120_000) {
    return
  }
  room.setMafiaTimer({ startedAt, duration })
  broadcastMafiaTimerStart(room, { startedAt, duration, isRunning: true })
}


export function handleMafiaTimerStop(socket: WsSocket, deps: SignalingDeps): void {
  const rp = resolveMafiaPeerAndRoom(socket, deps)
  if (!rp) {
    return
  }
  const { peer, room } = rp
  if (!isMafiaHostPeer(room, peer)) {
    return
  }
  room.setMafiaTimer(null)
  broadcastMafiaTimerStop(room)
}

export function handleUpdateDisplayName(
  socket: WsSocket,
  displayName: string,
  deps: SignalingDeps,
): void {
  const peer = getPeerForSocket(socket, deps)
  if (!peer) {
    return
  }
  const room = deps.roomManager.getRoom(peer.roomId)
  if (!room) {
    return
  }
  const trimmed = displayName.trim().slice(0, 64)
  const name = trimmed.length > 0 ? trimmed : sanitizeDisplayName(undefined, peer.id)
  peer.displayName = name
  broadcastServerMessageToRoom(room, {
    type: 'peer-display-name',
    payload: { peerId: peer.id, displayName: name },
  })
}

function getPeerForSocket(socket: WsSocket, deps: SignalingDeps): Peer | undefined {
  return deps.socketPeer.get(socket)
}

export async function handleCreateTransport(
  socket: WsSocket,
  direction: 'send' | 'recv',
  deps: SignalingDeps,
): Promise<void> {
  const peer = getPeerForSocket(socket, deps)
  if (!peer) {
    return
  }

  const room = deps.roomManager.getRoom(peer.roomId)
  if (!room) {
    return
  }

  try {
    peer.closeTransportsForDirection(direction)

    const transport = await createWebRtcTransport(room.getRouter(), direction)
    peer.addTransport(transport)

    const transportOptions = serializeTransportOptions(transport)

    sendServerMessage(socket, {
      type: 'transport-created',
      payload: { direction, transportOptions },
    })
  } catch (err) {
    console.error('create-transport failed', err)
  }
}

export async function handleConnectTransport(
  socket: WsSocket,
  transportId: string,
  dtlsParameters: DtlsParameters,
  deps: SignalingDeps,
): Promise<void> {
  const peer = getPeerForSocket(socket, deps)
  if (!peer) {
    return
  }

  const transport = peer.getTransport(transportId)
  if (!transport || transport.closed) {
    return
  }

  try {
    await transport.connect({ dtlsParameters })
    sendServerMessage(socket, {
      type: 'transport-connected',
      payload: { transportId },
    })

    if (transportDirection(transport) === 'recv') {
      const r = deps.roomManager.getRoom(peer.roomId)
      if (r) {
        const producers = collectExistingProducers(r, peer.id)
        const peers = peersInRoomExcept(r, peer.id)
        sendServerMessage(socket, {
          type: 'producer-sync',
          payload: { producers, peers, syncReason: 'recv-connected' },
        })
      }
    }
  } catch (err) {
    console.error('connect-transport failed', err)
  }
}

/** Client asks for a fresh producer list (e.g. tab became visible after background throttling). */
export function handleRequestProducerSync(
  socket: WsSocket,
  deps: SignalingDeps,
  payload?: { resetConsumers?: boolean },
): void {
  const peer = getPeerForSocket(socket, deps)
  if (!peer) {
    return
  }
  const room = deps.roomManager.getRoom(peer.roomId)
  if (!room) {
    return
  }
  const producers = collectExistingProducers(room, peer.id)
  const peers = peersInRoomExcept(room, peer.id)
  const resetConsumers = payload?.resetConsumers !== false
  if (process.env.NODE_ENV !== 'production') {
    console.log('[signaling] request-producer-sync', {
      roomId: room.id,
      peerId: peer.id,
      producerCount: producers.length,
      resetConsumers,
    })
  }
  sendServerMessage(socket, {
    type: 'producer-sync',
    payload: {
      producers,
      peers,
      syncReason: resetConsumers ? 'client-refresh' : 'recv-connected',
    },
  })
}

export async function handleSetOutboundVideoPaused(
  socket: WsSocket,
  paused: boolean,
  deps: SignalingDeps,
): Promise<void> {
  const peer = getPeerForSocket(socket, deps)
  if (!peer) {
    return
  }
  
  
  
  // host has not forced anything; pausing an already-paused producer is a
  
  if (!paused && peer.forcedCameraOff) {
    return
  }
  
  // screen-share producer. The room still receives `peer-outbound-video-paused`
  
  
  
  
  
  
  
  
  
  
  //                  pre-fix behavior for that single producer).
  for (const p of peer.getProducers()) {
    if (p.closed || p.kind !== 'video') {
      continue
    }
    const source = peer.getVideoProducerSource(p.id)
    if (source === 'screen') {
      continue
    }
    try {
      if (paused) {
        if (!p.paused) {
          await p.pause()
        }
      } else if (p.paused) {
        await p.resume()
      }
    } catch (e) {
      console.warn('[signaling] set-outbound-video-paused failed', { peerId: peer.id, producerId: p.id }, e)
    }
  }
  const room = deps.roomManager.getRoom(peer.roomId)
  if (!room) {
    return
  }
  const notice: ServerMessage = {
    type: 'peer-outbound-video-paused',
    payload: { peerId: peer.id, paused },
  }
  for (const other of room.getPeers()) {
    other.sendJson(notice)
  }
}

export async function handleProducerVideoSource(
  socket: WsSocket,
  producerId: string,
  source: 'camera' | 'screen',
  deps: SignalingDeps,
): Promise<void> {
  const peer = getPeerForSocket(socket, deps)
  if (!peer) {
    return
  }
  const producer = peer.getProducer(producerId)
  if (!producer || producer.closed || producer.kind !== 'video') {
    return
  }
  peer.setVideoProducerSource(producerId, source)
  const room = deps.roomManager.getRoom(peer.roomId)
  if (!room) {
    return
  }
  requestVideoKeyframesForProducerConsumers(room, producerId)
  broadcastServerMessageToRoom(room, {
    type: 'producer-video-source-changed',
    payload: { producerId, peerId: peer.id, source },
  })
}

export async function handleProduce(
  socket: WsSocket,
  transportId: string,
  kind: 'audio' | 'video',
  rtpParameters: unknown,
  requestId: string,
  deps: SignalingDeps,
  videoSource?: 'camera' | 'screen',
): Promise<void> {
  const peer = getPeerForSocket(socket, deps)
  if (!peer) {
    return
  }

  const room = deps.roomManager.getRoom(peer.roomId)
  if (!room) {
    return
  }

  const transport = peer.getTransport(transportId)
  if (!transport || transport.closed || transportDirection(transport) !== 'send') {
    return
  }

  try {
    const previousAudioProducers =
      kind === 'audio' ? peer.getProducers().filter((p) => p.kind === 'audio') : []

    const initialVideoSource =
      kind === 'video' ? (videoSource === 'screen' || videoSource === 'camera' ? videoSource : 'camera') : undefined

    const producer = await transport.produce({
      kind,
      rtpParameters: rtpParameters as RtpParameters,
      ...(kind === 'video' && initialVideoSource
        ? { appData: { source: initialVideoSource } as Record<string, unknown> }
        : {}),
    })

    // Register the `transportclose` listener synchronously, before any further
    // `await` in this handler. If the transport closes while we're awaiting
    // pause/resume/`addAudioProducerToLevelObserver`, the producer emits
    // `transportclose` immediately and the event is dropped if no listener is
    // installed yet — leaving `producer-closed` un-broadcast and remote peers
    // decoding a dead producer id.
    producer.on('transportclose', () => {
      // During `removePeerFromNetwork` → `closeAllMedia()` every transport
      // closes in a loop and would fire this listener once per producer;
      // the outer `peer-left` broadcast already covers client cleanup, so
      // skip the redundant per-producer fan-out.
      if (peer.isTearingDown) return
      const r = deps.roomManager.getRoom(peer.roomId)
      if (!r) return
      closeAndBroadcastProducer(r, peer, producer.id, producer.kind)
    })

    // currently host-forced for audio (or video), keep the new producer

    const keepPausedForForced =
      (producer.kind === 'audio' && peer.forcedAudioMuted) ||
      (producer.kind === 'video' && peer.forcedCameraOff)
    if (keepPausedForForced) {
      if (!producer.paused) {
        try {
          await producer.pause()
        } catch (e) {
          console.warn('[signaling] forced-pause on produce failed', {
            peerId: peer.id,
            producerId: producer.id,
            kind: producer.kind,
          }, e)
        }
      }
    } else if (producer.paused) {
      await producer.resume()
    }

    if (producer.kind === 'audio') {
      for (const prev of previousAudioProducers) {
        // Notify room so other peers drop their stale audio consumer instead
        // of silently decoding a now-dead producer id.
        closeAndBroadcastProducer(room, peer, prev.id, 'audio')
      }
    }

    peer.addProducer(producer)

    if (producer.kind === 'video' && initialVideoSource) {
      peer.setVideoProducerSource(producer.id, initialVideoSource)
    }

    if (producer.kind === 'audio') {
      await room.addAudioProducerToLevelObserver(producer.id)
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[mediasoup] SERVER PRODUCER', producer.kind, producer.id)
    }

    sendServerMessage(socket, {
      type: 'produced',
      payload: { id: producer.id, requestId },
    })

    const notice: ServerMessage = {
      type: 'new-producer',
      payload: {
        producerId: producer.id,
        peerId: peer.id,
        kind: producer.kind,
        ...(producer.kind === 'video'
          ? { videoSource: peer.getVideoProducerSource(producer.id) ?? 'camera' }
          : {}),
      },
    }
    const serializedNotice = JSON.stringify(notice)
    for (const p of room.getPeers()) {
      if (p.id === peer.id) {
        continue
      }
      p.sendRaw(serializedNotice)
    }
  } catch (err) {
    console.error('produce failed', err)
  }
}

function sendConsumeFailed(socket: WsSocket, producerId: string, reason: string): void {
  sendServerMessage(socket, { type: 'consume-failed', payload: { producerId, reason } })
}

/**
 * Mediasoup defaults video consumers to the highest simulcast/SVC layer until preferred layers are set.
 * Apply a conservative rung before `resume()` so the first RTP/decodes are not full resolution.
 * Safe to no-op: non-simulcast / unsupported encodings throw — caller still resumes.
 */
async function applyInitialLowVideoConsumerLayersBeforeResume(consumer: Consumer): Promise<void> {
  if (consumer.kind !== 'video') {
    return
  }
  const trySpatialOnly = async (): Promise<void> => {
    await consumer.setPreferredLayers({ spatialLayer: 0 })
  }
  try {
    await consumer.setPreferredLayers({ spatialLayer: 0, temporalLayer: 0 })
    if (process.env.NODE_ENV !== 'production') {
      console.log('[call-qa:layers] consume initial setPreferredLayers (pre-resume)', {
        consumerId: consumer.id,
        producerId: consumer.producerId,
        spatialLayer: 0,
        temporalLayer: 0,
        consumerType: consumer.type,
      })
    }
  } catch {
    try {
      await trySpatialOnly()
      if (process.env.NODE_ENV !== 'production') {
        console.log('[call-qa:layers] consume initial setPreferredLayers spatial-only (pre-resume)', {
          consumerId: consumer.id,
          producerId: consumer.producerId,
          spatialLayer: 0,
          consumerType: consumer.type,
        })
      }
    } catch {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[call-qa:layers] consume initial setPreferredLayers skipped (simple/non-layered)', {
          consumerId: consumer.id,
          producerId: consumer.producerId,
          consumerType: consumer.type,
        })
      }
    }
  }
}

export async function handleConsume(
  socket: WsSocket,
  transportId: string,
  producerId: string,
  rtpCapabilities: unknown,
  deps: SignalingDeps,
): Promise<void> {
  const peer = getPeerForSocket(socket, deps)
  if (!peer) {
    sendConsumeFailed(socket, producerId, 'no_peer')
    return
  }

  const room = deps.roomManager.getRoom(peer.roomId)
  if (!room) {
    sendConsumeFailed(socket, producerId, 'no_room')
    return
  }

  const transport = peer.getTransport(transportId)
  if (!transport || transport.closed || transportDirection(transport) !== 'recv') {
    sendConsumeFailed(socket, producerId, 'invalid_recv_transport')
    return
  }

  const sourceProducer = findProducerInRoom(room, producerId)
  if (!sourceProducer || sourceProducer.closed) {
    sendConsumeFailed(socket, producerId, 'producer_not_found_or_closed')
    return
  }

  const caps = rtpCapabilities as RtpCapabilities
  const canConsume = room.getRouter().canConsume({ producerId, rtpCapabilities: caps })
  if (!canConsume) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[canConsume] false', {
        producerId,
        kind: sourceProducer.kind,
        consumerPeerId: peer.id,
      })
    }
    sendConsumeFailed(socket, producerId, 'can_consume_false')
    return
  }

  try {
    // Never resume a paused outbound producer here. Camera-off intentionally keeps the SFU producer paused;
    

    const baseConsume = {
      producerId,
      rtpCapabilities: caps,
      paused: true as const,
    }

    let consumer: Consumer
    /** When true, `transport.consume` already set low rungs; skip redundant `setPreferredLayers`. */
    let videoInitialLayersFromConsumeOptions = false
    if (sourceProducer.kind === 'video') {
      try {
        consumer = await transport.consume({
          ...baseConsume,
          preferredLayers: { spatialLayer: 0, temporalLayer: 0 },
        })
        videoInitialLayersFromConsumeOptions = true
        if (process.env.NODE_ENV !== 'production') {
          console.log('[call-qa:layers] consume created with preferredLayers in options', {
            producerId,
            consumerId: consumer.id,
            spatialLayer: 0,
            temporalLayer: 0,
          })
        }
      } catch {
        consumer = await transport.consume(baseConsume)
      }
    } else {
      consumer = await transport.consume(baseConsume)
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[consume] consumer created', {
        producerId,
        kind: consumer.kind,
        consumerPaused: consumer.paused,
        producerPaused: sourceProducer.paused,
      })
    }

    peer.addConsumer(consumer)

    if (process.env.NODE_ENV !== 'production') {
      console.log('[mediasoup] SERVER CONSUMER', consumer.producerId, consumer.kind, consumer.id)
    }

    if (sourceProducer.kind === 'video' && !videoInitialLayersFromConsumeOptions) {
      await applyInitialLowVideoConsumerLayersBeforeResume(consumer)
    }

    sendServerMessage(socket, {
      type: 'consumed',
      payload: {
        id: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      },
    })

    // Resume after signaling so the browser can apply `transport.consume()` first; reduces stuck
    
    await consumer.resume()

    if (consumer.kind === 'video') {
      void consumer.requestKeyFrame().catch(() => {
        /* optional: codec / timing */
      })
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[consume] after consumer.resume', {
        consumerPaused: consumer.paused,
      })
    }
  } catch (err) {
    console.error('consume failed', err)
    sendConsumeFailed(socket, producerId, 'server_consume_error')
  }
}

/**
 * Simulcast / SVC layer selection runs on the mediasoup worker Consumer.
 * mediasoup-client browserside Consumer has no setPreferredLayers — the client must signal here.
 */
export async function handleSetConsumerPreferredLayers(
  socket: WsSocket,
  consumerId: string,
  spatialLayer: number,
  temporalLayer: number | undefined,
  deps: SignalingDeps,
): Promise<void> {
  const peer = getPeerForSocket(socket, deps)
  if (!peer) {
    return
  }

  const consumer = peer.getConsumer(consumerId)
  if (!consumer || consumer.closed || consumer.kind !== 'video') {
    return
  }

  const trySpatialOnly = async (): Promise<void> => {
    await consumer.setPreferredLayers({ spatialLayer })
  }

  try {
    if (temporalLayer !== undefined && Number.isInteger(temporalLayer)) {
      try {
        await consumer.setPreferredLayers({ spatialLayer, temporalLayer })
      } catch {
        await trySpatialOnly()
      }
    } else {
      await trySpatialOnly()
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('[call-qa:layers] server setPreferredLayers', { consumerId, spatialLayer, temporalLayer })
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[call-qa:layers] server setPreferredLayers failed', { consumerId, spatialLayer, temporalLayer, err })
    } else {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[layers] setPreferredLayers failed', consumerId, spatialLayer, msg)
    }
  }
}

/**
 * Receiver-driven consumer pause/resume. The client sends this when a video tile
 * becomes hidden/offscreen or the tab goes into the background, so the SFU stops
 * forwarding RTP for that consumer. mediasoup auto-issues PLI on resume so the
 * decoder recovers without a black frame.
 *
 * Audio consumers are NEVER paused: muting them server-side would silence the
 * speaker for the whole call grid and would break the active-speaker observer.
 * The handler enforces this guard regardless of what the client sends.
 */
export async function handleSetConsumerPaused(
  socket: WsSocket,
  consumerId: string,
  paused: boolean,
  deps: SignalingDeps,
): Promise<void> {
  const peer = getPeerForSocket(socket, deps)
  if (!peer) {
    return
  }

  const consumer = peer.getConsumer(consumerId)
  if (!consumer || consumer.closed) {
    return
  }
  if (consumer.kind !== 'video') {
    return
  }

  try {
    if (paused) {
      if (!consumer.paused) {
        await consumer.pause()
      }
    } else {
      if (consumer.paused) {
        await consumer.resume()
        
        
        void consumer.requestKeyFrame().catch(() => {
          /* best-effort */
        })
      }
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('[call-qa:consumer-pause] applied', {
        consumerId,
        paused,
        consumerPaused: consumer.paused,
      })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[consumer-pause] failed', { consumerId, paused, msg })
  }
}

export function handleDisconnect(socket: WsSocket, deps: SignalingDeps): void {
  const peer = deps.socketPeer.get(socket)
  if (!peer) {
    return
  }
  removePeerFromNetwork(peer, deps)
}

// ════════════════════════════════════════════════════════════════════════════
// Generic game-room handlers (Phase 3A)
// ════════════════════════════════════════════════════════════════════════════
//
// Parallel to the Mafia handler suite above. Each function below has a Mafia
// counterpart with byte-equivalent semantics except for:
//   - no role assignment (`gameroom:reshuffle` carries only `order`)
//   - no `nightActions`/`clearRoles`/`oldMafiaMode` in players-update
//   - no Mafia mode toggle, no background galleries (those handlers have no
//     generic equivalent and are deliberately excluded)
//
// Mafia handlers are NEVER called from this section. The only shared surface
// is `Peer` (with the new `gameRoomSessionId` field) and pure helpers
// (`broadcastPeerOutboundVideoPaused`, `broadcastPeerEffectiveAudioMuted`,
// `pauseAllPeerVideoProducers`, `pauseAllPeerAudioProducers`,
// `broadcastServerMessageToRoom`, `sendServerMessage`).

function broadcastGameRoomHostUpdated(room: Room): void {
  broadcastServerMessageToRoom(room, {
    type: GameRoomWs.hostUpdated,
    payload: {
      hostPeerId: room.getGameRoomHostPeerId(),
      hostUserId: room.getGameRoomHostUserId(),
      hostSessionId: room.getGameRoomHostSessionId(),
    },
  })
}

function isGameRoomHostPeer(room: Room, peer: Peer): boolean {
  const hostUserId = room.getGameRoomHostUserId()
  const hostSessionId = room.getGameRoomHostSessionId()
  const hostPeerId = room.getGameRoomHostPeerId()
  return (
    hostUserId != null &&
    hostSessionId != null &&
    hostPeerId != null &&
    peer.userId.length > 0 &&
    peer.gameRoomSessionId.length > 0 &&
    peer.userId === hostUserId &&
    peer.gameRoomSessionId === hostSessionId &&
    peer.id === hostPeerId
  )
}

function resolveGameRoomPeerAndRoom(
  socket: WsSocket,
  deps: SignalingDeps,
): { peer: Peer; room: Room } | null {
  const peer = getPeerForSocket(socket, deps)
  if (!peer) return null
  const room = deps.roomManager.getRoom(peer.roomId)
  if (!room) return null
  if (!isGameRoomId(room.id)) return null
  return { peer, room }
}

function broadcastGameRoomQueueUpdate(room: Room): void {
  broadcastServerMessageToRoom(room, {
    type: GameRoomWs.queueUpdate,
    payload: { speakingQueue: room.getGameRoomSpeakingQueue() },
  })
}

function broadcastGameRoomReshuffle(room: Room, payload: { order: string[] }): void {
  broadcastServerMessageToRoom(room, { type: GameRoomWs.reshuffle, payload })
}

function broadcastGameRoomPlayersUpdate(
  room: Room,
  payload: { order: string[]; speakingQueue: number[] },
): void {
  broadcastServerMessageToRoom(room, { type: GameRoomWs.playersUpdate, payload })
}

function broadcastGameRoomPlayerKick(room: Room, payload: { peerId: string }): void {
  broadcastServerMessageToRoom(room, { type: GameRoomWs.playerKick, payload })
}

function broadcastGameRoomPlayerRevive(room: Room, payload: { peerId: string }): void {
  broadcastServerMessageToRoom(room, { type: GameRoomWs.playerRevive, payload })
}

function broadcastGameRoomForceCameraOff(room: Room, payload: { peerId: string }): void {
  broadcastServerMessageToRoom(room, { type: GameRoomWs.forceCameraOff, payload })
}

function broadcastGameRoomForceMuteAll(room: Room, payload: { muted?: boolean }): void {
  broadcastServerMessageToRoom(room, { type: GameRoomWs.forceMuteAll, payload })
}

function broadcastGameRoomForcePeerMic(room: Room, payload: { peerId: string; muted: boolean }): void {
  broadcastServerMessageToRoom(room, { type: GameRoomWs.forcePeerMic, payload })
}

/**
 * Mirror of {@link sendMafiaSnapshotToSocket} for `gameroom:<base>` rooms.
 * Replays the generic state block to the requesting socket only. Read-only
 * with respect to `room` state except for the idempotent expired-timer
 * cleanup (mirrors the Mafia equivalent).
 *
 * Generic snapshot intentionally omits: mode-update, settings-update,
 * page-background-settings (Mafia-only surfaces).
 */
function sendGameRoomSnapshotToSocket(socket: WsSocket, room: Room, peer: Peer): void {
  sendServerMessage(socket, {
    type: GameRoomWs.hostUpdated,
    payload: {
      hostPeerId: room.getGameRoomHostPeerId(),
      hostUserId: room.getGameRoomHostUserId(),
      hostSessionId: room.getGameRoomHostSessionId(),
    },
  })
  sendServerMessage(socket, {
    type: GameRoomWs.queueUpdate,
    payload: { speakingQueue: room.getGameRoomSpeakingQueue() },
  })
  sendServerMessage(socket, {
    type: GameRoomWs.playerLifeState,
    payload: { states: room.getGameRoomPlayerLifeStateSnapshot() },
  })
  sendServerMessage(socket, {
    type: GameRoomWs.forceMuteAll,
    payload: { muted: room.isGameRoomForceMuteAllActive() },
  })
  // Same belt-and-suspenders as the Mafia snapshot path: re-emit effective
  // mute and outbound-video-paused per other peer so a late joiner / OBS
  // catches up byte-identically without waiting for a delta.
  for (const other of room.getPeers()) {
    if (other.id === peer.id) continue
    const effectiveMuted = other.audioMuted || other.forcedAudioMuted
    if (!effectiveMuted) continue
    sendServerMessage(socket, {
      type: 'peer-audio-muted',
      payload: { peerId: other.id, muted: true },
    })
  }
  for (const other of room.getPeers()) {
    if (other.id === peer.id) continue
    if (!other.forcedCameraOff) continue
    sendServerMessage(socket, {
      type: 'peer-outbound-video-paused',
      payload: { peerId: other.id, paused: true },
    })
  }
  const gt = room.getGameRoomTimer()
  if (gt != null) {
    const rem = gt.duration - (Date.now() - gt.startedAt)
    if (rem > 0) {
      sendServerMessage(socket, { type: GameRoomWs.timerStart, payload: { ...gt, isRunning: true } })
    } else {
      room.setGameRoomTimer(null)
    }
  }
  const reshuffleSnap = room.getGameRoomReshuffleSnapshotIfFresh()
  if (reshuffleSnap != null) {
    sendServerMessage(socket, { type: GameRoomWs.reshuffle, payload: reshuffleSnap })
  }
  const playersUpdateSnap = room.getGameRoomPlayersUpdateSnapshotIfFresh()
  if (playersUpdateSnap != null) {
    sendServerMessage(socket, { type: GameRoomWs.playersUpdate, payload: playersUpdateSnap })
  }
  const nicks = room.getGameRoomNicknamesSnapshot()
  for (const [peerId, displayName] of Object.entries(nicks)) {
    sendServerMessage(socket, { type: GameRoomWs.playerNicknameUpdate, payload: { peerId, displayName } })
  }
  const audioMixSnap = room.getGameRoomAudioMixSnapshot()
  if (audioMixSnap.length > 0) {
    sendServerMessage(socket, {
      type: GameRoomWs.audioMixUpdate,
      payload: { entries: audioMixSnap },
    })
  }
}

export function handleGameRoomRequestSnapshot(socket: WsSocket, deps: SignalingDeps): void {
  const peer = getPeerForSocket(socket, deps)
  if (!peer) return
  const room = deps.roomManager.getRoom(peer.roomId)
  if (!room) return
  if (!isGameRoomId(room.id)) return
  sendGameRoomSnapshotToSocket(socket, room, peer)
}

export function handleGameRoomClaimHost(
  socket: WsSocket,
  payload: { sessionId?: string } | null | undefined,
  deps: SignalingDeps,
): void {
  const rp = resolveGameRoomPeerAndRoom(socket, deps)
  if (!rp) {
    return
  }
  const { peer, room } = rp
  if (peer.userId.length < 1) {
    return
  }
  const sessionId = sanitizeSessionId(payload?.sessionId)
  if (sessionId.length < 1) {
    return
  }
  peer.gameRoomSessionId = sessionId
  const current = room.getGameRoomHostUserId()
  if (current === peer.userId) {
    const currentSession = room.getGameRoomHostSessionId()
    const currentPeerId = room.getGameRoomHostPeerId()
    const currentPeerOnline = currentPeerId != null && room.getPeer(currentPeerId) != null
    if (currentSession == null || currentPeerId == null || !currentPeerOnline || currentPeerId === peer.id) {
      if (currentSession != null && currentSession !== sessionId) {
        return
      }
      room.setGameRoomHostSessionId(sessionId)
      room.setGameRoomHostPeerId(peer.id)
      setGameRoomOwnerUserId(room.id, peer.userId)
      broadcastGameRoomHostUpdated(room)
    }
    return
  }
  if (current != null) {
    return
  }
  const ownerUserId = getGameRoomOwnerUserId(room.id)
  if (ownerUserId != null && ownerUserId !== peer.userId) {
    return
  }
  room.setGameRoomHostUserId(peer.userId)
  room.setGameRoomHostSessionId(sessionId)
  room.setGameRoomHostPeerId(peer.id)
  setGameRoomOwnerUserId(room.id, peer.userId)
  broadcastGameRoomHostUpdated(room)
}

export function handleGameRoomTransferHost(
  socket: WsSocket,
  payload: { userId: string },
  deps: SignalingDeps,
): void {
  const rp = resolveGameRoomPeerAndRoom(socket, deps)
  if (!rp) {
    return
  }
  const { peer, room } = rp
  if (!isGameRoomHostPeer(room, peer)) {
    return
  }
  const nextUserId = sanitizeUserId(payload.userId)
  if (nextUserId.length < 1) {
    return
  }
  const candidatePresent = room.getPeers().some((p) => p.userId === nextUserId)
  if (!candidatePresent) {
    return
  }
  room.setGameRoomHostUserId(nextUserId)
  const nextSessionId = room.getFirstGameRoomSessionIdForUser(nextUserId)
  room.setGameRoomHostSessionId(nextSessionId)
  room.setGameRoomHostPeerId(room.getFirstGameRoomPeerIdForUserSession(nextUserId, nextSessionId))
  setGameRoomOwnerUserId(room.id, nextUserId)
  broadcastGameRoomHostUpdated(room)
}

export function handleGameRoomQueueUpdate(
  socket: WsSocket,
  payload: { speakingQueue: unknown } | null | undefined,
  deps: SignalingDeps,
): void {
  const rp = resolveGameRoomPeerAndRoom(socket, deps)
  if (!rp) {
    return
  }
  const { peer, room } = rp
  if (!isGameRoomHostPeer(room, peer)) {
    return
  }
  const list = (payload as { speakingQueue?: unknown } | null | undefined)?.speakingQueue
  const maxSeat = room.getPeers().length > 0 ? room.getPeers().length : GAME_ROOM_MAX_SEAT
  const sanitized = sanitizeGameRoomSpeakingQueueList(list, maxSeat)
  room.setGameRoomSpeakingQueue(sanitized)
  broadcastGameRoomQueueUpdate(room)
}

/**
 * Generic reshuffle: order-only. Mirrors the Mafia reshuffle's media side
 * effects (clear life-states, drop per-peer kill enforcement, preserve
 * room-wide force-mute-all) but contains no role validation, no role
 * payload, no role storage.
 */
export async function handleGameRoomReshuffle(
  socket: WsSocket,
  payload: { order: string[] },
  deps: SignalingDeps,
): Promise<void> {
  const rp = resolveGameRoomPeerAndRoom(socket, deps)
  if (!rp) {
    return
  }
  const { peer, room } = rp
  if (!isGameRoomHostPeer(room, peer)) {
    return
  }
  const peers = room.getPeers()
  if (peers.length < 1) {
    return
  }
  const roomIds = new Set(peers.map((p) => p.id))
  const { order } = payload
  if (!Array.isArray(order) || order.length < 1 || order.length > roomIds.size) {
    return
  }
  const used = new Set<string>()
  for (const peerId of order) {
    if (!roomIds.has(peerId) || used.has(peerId)) {
      return
    }
    used.add(peerId)
  }
  room.clearGameRoomPlayerLifeStates()

  const previouslyForcedCameraOff = room.getGameRoomForcedCameraOffPeerIds()
  const previouslyForcedMicMuted = room.getGameRoomForcedMicMutedPeerIds()
  room.clearAllGameRoomPerPeerForceFlags()

  for (const peerId of previouslyForcedCameraOff) {
    const target = room.getPeer(peerId)
    if (!target) continue
    target.forcedCameraOff = false
  }
  for (const peerId of previouslyForcedMicMuted) {
    const target = room.getPeer(peerId)
    if (!target) continue
    target.forcedAudioMuted = false
  }
  // Generic reshuffle preserves the room-wide force-mute-all toggle (same as
  // Mafia): if active, every non-host must remain forced-muted so a new
  // round does not bypass the host's silence.
  if (room.isGameRoomForceMuteAllActive()) {
    const hostPeerId = room.getGameRoomHostPeerId()
    for (const target of room.getPeers()) {
      if (target.id === hostPeerId) continue
      target.forcedAudioMuted = true
    }
  }
  room.setGameRoomReshuffleSnapshot({ order: [...order] })
  broadcastGameRoomReshuffle(room, { order: [...order] })
  // Notify peers life-state was cleared (parity with Mafia: clients re-render
  // dead overlays from the snapshot, not from a derived store).
  broadcastServerMessageToRoom(room, {
    type: GameRoomWs.playerLifeState,
    payload: { states: room.getGameRoomPlayerLifeStateSnapshot() },
  })
}

export function handleGameRoomPlayersUpdate(
  socket: WsSocket,
  payload: { order: string[]; speakingQueue: number[] },
  deps: SignalingDeps,
): void {
  const rp = resolveGameRoomPeerAndRoom(socket, deps)
  if (!rp) {
    return
  }
  const { peer, room } = rp
  if (!isGameRoomHostPeer(room, peer)) {
    return
  }
  const peers = room.getPeers()
  const roomIds = new Set(peers.map((p) => p.id))
  const order = Array.isArray(payload.order) ? payload.order : []
  if (order.length < 1 || order.length > roomIds.size) {
    return
  }
  const used = new Set<string>()
  for (const peerId of order) {
    if (!roomIds.has(peerId) || used.has(peerId)) {
      return
    }
    used.add(peerId)
  }
  const maxSeat = order.length > 0 ? order.length : GAME_ROOM_MAX_SEAT
  const sanitizedQueue = sanitizeGameRoomSpeakingQueueList(payload.speakingQueue, maxSeat)
  const snapshot = { order: [...order], speakingQueue: sanitizedQueue }
  room.setGameRoomPlayersUpdateSnapshot(snapshot)
  room.setGameRoomSpeakingQueue(sanitizedQueue)
  broadcastGameRoomPlayersUpdate(room, snapshot)
}

export function handleGameRoomPlayerNameUpdate(
  socket: WsSocket,
  payload: { targetPeerId: string; displayName: string },
  deps: SignalingDeps,
): void {
  const rp = resolveGameRoomPeerAndRoom(socket, deps)
  if (!rp) return
  const { peer, room } = rp
  if (!isGameRoomHostPeer(room, peer)) return
  const targetId = typeof payload.targetPeerId === 'string' ? payload.targetPeerId.trim() : ''
  if (!targetId) return
  const target = room.getPeer(targetId)
  if (!target) return
  const incoming = typeof payload.displayName === 'string' ? payload.displayName.trim() : ''
  if (incoming.length < 1) {
    room.setGameRoomNickname(targetId, null)
    broadcastServerMessageToRoom(room, {
      type: GameRoomWs.playerNicknameUpdate,
      payload: { peerId: targetId, displayName: '' },
    })
    return
  }
  const sanitized = sanitizeDisplayName(incoming, targetId)
  room.setGameRoomNickname(targetId, sanitized)
  broadcastServerMessageToRoom(room, {
    type: GameRoomWs.playerNicknameUpdate,
    payload: { peerId: targetId, displayName: sanitized },
  })
}

export function handleGameRoomAudioMixUpdate(
  socket: WsSocket,
  payload: { entries: ReadonlyArray<{ peerId: string; userId?: string | null; volume: number; muted: boolean }> },
  deps: SignalingDeps,
): void {
  const rp = resolveGameRoomPeerAndRoom(socket, deps)
  if (!rp) return
  const { peer, room } = rp
  if (!isGameRoomHostPeer(room, peer)) return
  const applied = room.applyGameRoomAudioMixEntries(payload.entries)
  if (applied.length < 1) return
  broadcastServerMessageToRoom(room, {
    type: GameRoomWs.audioMixUpdate,
    payload: { entries: applied },
  })
}

export function handleGameRoomTimerStart(
  socket: WsSocket,
  payload: { startedAt: number; duration: number; isRunning?: boolean },
  deps: SignalingDeps,
): void {
  const rp = resolveGameRoomPeerAndRoom(socket, deps)
  if (!rp) return
  const { peer, room } = rp
  if (!isGameRoomHostPeer(room, peer)) return
  const { startedAt, duration } = payload
  const serverNow = Date.now()
  if (startedAt > serverNow + 60_000) return
  if (startedAt < serverNow - 120_000) return
  const elapsed = serverNow - startedAt
  if (elapsed >= duration) return
  room.setGameRoomTimer({ startedAt, duration })
  broadcastServerMessageToRoom(room, {
    type: GameRoomWs.timerStart,
    payload: { startedAt, duration, isRunning: true },
  })
}

export function handleGameRoomTimerStop(socket: WsSocket, deps: SignalingDeps): void {
  const rp = resolveGameRoomPeerAndRoom(socket, deps)
  if (!rp) return
  const { peer, room } = rp
  if (!isGameRoomHostPeer(room, peer)) return
  room.setGameRoomTimer(null)
  broadcastServerMessageToRoom(room, { type: GameRoomWs.timerStop, payload: {} })
}

export async function handleGameRoomPlayerKick(
  socket: WsSocket,
  payload: { peerId: string },
  deps: SignalingDeps,
): Promise<void> {
  const rp = resolveGameRoomPeerAndRoom(socket, deps)
  if (!rp) return
  const { peer, room } = rp
  if (!isGameRoomHostPeer(room, peer)) return
  const targetId = payload.peerId
  if (typeof targetId !== 'string' || targetId.length < 1) return
  if (targetId === peer.id) return
  const roomIds = new Set(room.getPeers().map((p) => p.id))
  if (!roomIds.has(targetId)) return

  const lifeStates = room.getGameRoomPlayerLifeStateSnapshot()
  if (lifeStates[targetId] === 'dead') return

  room.setGameRoomPlayerLifeState(targetId, 'dead')
  broadcastGameRoomPlayerKick(room, { peerId: targetId })

  const target = room.getPeer(targetId)
  if (!target) return

  if (!target.forcedCameraOff) {
    target.forcedCameraOff = true
    room.setGameRoomPeerForcedCameraOff(targetId, true)
    await pauseAllPeerVideoProducers(target, 'gameroom:player-kick')
    broadcastPeerOutboundVideoPaused(room, target.id, true)
  } else if (!room.isGameRoomPeerForcedCameraOff(targetId)) {
    room.setGameRoomPeerForcedCameraOff(targetId, true)
  }
  room.setGameRoomUserForcedCameraOff(target.userId, true)

  if (!target.forcedAudioMuted) {
    target.forcedAudioMuted = true
    room.setGameRoomPeerForcedMicMuted(targetId, true)
    await pauseAllPeerAudioProducers(target, 'gameroom:player-kick')
    broadcastPeerEffectiveAudioMuted(room, target)
  } else if (!room.isGameRoomPeerForcedMicMuted(targetId)) {
    room.setGameRoomPeerForcedMicMuted(targetId, true)
  }
  room.setGameRoomUserForcedMicMuted(target.userId, true)

  broadcastGameRoomForceCameraOff(room, { peerId: targetId })
  broadcastGameRoomForcePeerMic(room, { peerId: targetId, muted: true })
}

export async function handleGameRoomPlayerRevive(
  socket: WsSocket,
  payload: { peerId: string },
  deps: SignalingDeps,
): Promise<void> {
  const rp = resolveGameRoomPeerAndRoom(socket, deps)
  if (!rp) return
  const { peer, room } = rp
  if (!isGameRoomHostPeer(room, peer)) return
  const targetId = payload.peerId
  if (typeof targetId !== 'string' || targetId.length < 1) return
  if (targetId === peer.id) return

  const lifeStates = room.getGameRoomPlayerLifeStateSnapshot()
  if (lifeStates[targetId] !== 'dead') return

  room.setGameRoomPlayerLifeState(targetId, 'ghost')
  broadcastGameRoomPlayerRevive(room, { peerId: targetId })

  const target = room.getPeer(targetId)
  if (!target) return

  if (target.forcedCameraOff) {
    target.forcedCameraOff = false
  }
  room.setGameRoomPeerForcedCameraOff(targetId, false)
  room.clearGameRoomForceStateForUser(target.userId)

  if (target.forcedAudioMuted) {
    target.forcedAudioMuted = false
  }
  room.setGameRoomPeerForcedMicMuted(targetId, false)
  broadcastPeerEffectiveAudioMuted(room, target)
  broadcastGameRoomForcePeerMic(room, { peerId: targetId, muted: false })
}

export async function handleGameRoomForceCameraOff(
  socket: WsSocket,
  payload: { peerId: string; paused?: boolean },
  deps: SignalingDeps,
): Promise<void> {
  const rp = resolveGameRoomPeerAndRoom(socket, deps)
  if (!rp) return
  const { peer, room } = rp
  if (!isGameRoomHostPeer(room, peer)) return
  const targetId = payload.peerId
  if (typeof targetId !== 'string' || targetId.length < 1 || targetId === peer.id) return
  const target = room.getPeer(targetId)
  if (!target) return

  const paused = payload.paused !== false

  target.forcedCameraOff = paused
  room.setGameRoomPeerForcedCameraOff(targetId, paused)
  room.setGameRoomUserForcedCameraOff(target.userId, paused)
  for (const p of target.getProducers()) {
    if (p.kind !== 'video' || p.closed) continue
    try {
      if (paused) {
        if (!p.paused) {
          await p.pause()
        }
      } else if (p.paused) {
        await p.resume()
      }
    } catch (e) {
      console.warn('[signaling] gameroom:force-camera-off pause/resume failed', {
        peerId: target.id,
        producerId: p.id,
      }, e)
    }
  }

  const videoMsg: ServerMessage = {
    type: 'peer-outbound-video-paused',
    payload: { peerId: target.id, paused },
  }
  for (const observer of room.getPeers()) {
    observer.sendJson(videoMsg)
  }

  broadcastGameRoomForceCameraOff(room, { peerId: targetId })
}

export async function handleGameRoomForceMuteAll(
  socket: WsSocket,
  payload: { muted?: boolean },
  deps: SignalingDeps,
): Promise<void> {
  const rp = resolveGameRoomPeerAndRoom(socket, deps)
  if (!rp) return
  const { peer: hostPeer, room } = rp
  if (!isGameRoomHostPeer(room, hostPeer)) return
  const muted = payload.muted !== false

  room.setGameRoomForceMuteAllActive(muted)

  for (const target of room.getPeers()) {
    if (target.id === hostPeer.id) continue
    // Soft mute (same shape as Mafia equivalent): write `audioMuted` so a
    // player can self-unmute through the normal `set-audio-muted: false`
    // path. Host UI derives the "mute all" button state from
    // `gameRoomForceMuteAllActive && everyNonHostEffectivelyMuted`.
    target.audioMuted = muted
    for (const p of target.getProducers()) {
      if (p.kind !== 'audio' || p.closed) continue
      try {
        if (muted) {
          if (!p.paused) {
            await p.pause()
          }
        } else if (p.paused && !target.audioMuted) {
          await p.resume()
        }
      } catch (e) {
        console.warn('[signaling] gameroom:force-mute-all pause/resume failed', {
          peerId: target.id,
          producerId: p.id,
        }, e)
      }
    }
    const effectiveMuted = target.audioMuted || target.forcedAudioMuted
    const audioMsg: ServerMessage = {
      type: 'peer-audio-muted',
      payload: { peerId: target.id, muted: effectiveMuted },
    }
    for (const observer of room.getPeers()) {
      observer.sendJson(audioMsg)
    }
  }

  broadcastGameRoomForceMuteAll(room, { muted })
}
