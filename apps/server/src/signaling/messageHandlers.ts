import WebSocket from 'ws'
import type { WebSocket as WsSocket } from 'ws'
import { z } from 'zod'
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
import type { Room } from '../rooms/Room'
import type { RoomManager } from '../rooms/RoomManager'

const mafiaRoleSchema = z.enum(['mafia', 'don', 'sheriff', 'doctor', 'civilian'])

const directionSchema = z.enum(['send', 'recv'])

const dtlsParametersSchema = z
  .object({
    fingerprints: z.array(
      z.object({
        algorithm: z.string(),
        value: z.string(),
      }),
    ),
  })
  .passthrough()

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('join-room'),
    payload: z.object({
      roomId: z.string().min(1),
      peerId: z.string().min(1),
      displayName: z.string().max(64).optional(),
      /** Optional profile image (https) announced at join; broadcast to room with peer roster. */
      avatarUrl: z.string().max(2048).optional(),
    }),
  }),
  z.object({
    type: z.literal('update-display-name'),
    payload: z.object({
      displayName: z.string().min(1).max(64),
    }),
  }),
  z.object({
    type: z.literal('create-transport'),
    payload: z.object({
      direction: directionSchema,
    }),
  }),
  z.object({
    type: z.literal('connect-transport'),
    payload: z.object({
      transportId: z.string().min(1),
      dtlsParameters: dtlsParametersSchema,
    }),
  }),
  z.object({
    type: z.literal('produce'),
    payload: z.object({
      transportId: z.string().min(1),
      kind: z.enum(['audio', 'video']),
      rtpParameters: z.unknown(),
      requestId: z.string().min(1),
      /** Outbound video semantic; default `camera` on server. */
      videoSource: z.enum(['camera', 'screen']).optional(),
    }),
  }),
  z.object({
    type: z.literal('producer-video-source'),
    payload: z.object({
      producerId: z.string().min(1),
      source: z.enum(['camera', 'screen']),
    }),
  }),
  /** Pause/resume this peer's outbound video producers so remotes get `track.muted`, not a black tile. */
  z.object({
    type: z.literal('set-outbound-video-paused'),
    payload: z.object({
      paused: z.boolean(),
    }),
  }),
  z.object({
    type: z.literal('consume'),
    payload: z.object({
      transportId: z.string().min(1),
      producerId: z.string().min(1),
      rtpCapabilities: z.unknown(),
    }),
  }),
  z.object({
    type: z.literal('set-consumer-preferred-layers'),
    payload: z.object({
      consumerId: z.string().min(1),
      spatialLayer: z.number().int().min(0).max(2),
      temporalLayer: z.number().int().min(0).max(2).optional(),
    }),
  }),
  /** App-level keepalive so proxies / CDNs do not close idle signaling (background tabs). */
  z.object({
    type: z.literal('client-ping'),
    payload: z.object({}).optional(),
  }),
  /** Answer to server JSON `{ type: 'ping' }` (nginx / proxy idle timeouts). */
  z.object({
    type: z.literal('pong'),
    payload: z.object({}).optional(),
  }),
  z.object({
    type: z.literal('call-chat'),
    payload: z.object({
      text: z.string().min(1).max(500),
    }),
  }),
  z.object({
    type: z.literal('raise-hand'),
    payload: z.object({
      raised: z.boolean(),
    }),
  }),
  z.object({
    type: z.literal('request-producer-sync'),
    payload: z
      .object({
        /**
         * When true (default): client may `teardownAllRemoteConsumers` before re-consuming (tab refresh / recovery).
         * When false: merge-only catch-up — same producer list semantics as `recv-connected` (post-join race fix).
         */
        resetConsumers: z.boolean().optional(),
      })
      .optional(),
  }),
  z.object({
    type: z.literal('mafia:claim-host'),
    payload: z.object({}).optional(),
  }),
  z.object({
    type: z.literal('mafia:queue-update'),
    payload: z.object({
      /** 1-based seat indices; order preserved; max length bounded server-side. */
      speakingQueue: z.array(z.number().int().min(1).max(12)).max(16),
    }),
  }),
  z.object({
    type: z.literal('mafia:reshuffle'),
    payload: z.object({
      players: z
        .array(
          z.object({
            peerId: z.string().min(1),
            seat: z.number().int().min(1).max(12),
            role: mafiaRoleSchema,
          }),
        )
        .min(1)
        .max(12),
    }),
  }),
  z.object({
    type: z.literal('mafia:players-update'),
    payload: z.object({
      order: z.array(z.string().min(1)).min(1).max(12),
      nightActions: z
        .object({
          mafia: z.number().int().min(1).max(12).optional(),
          doctor: z.number().int().min(1).max(12).optional(),
          sheriff: z.number().int().min(1).max(12).optional(),
          don: z.number().int().min(1).max(12).optional(),
        })
        .strict()
        .optional(),
      speakingQueue: z.array(z.number().int().min(1).max(12)).max(16),
    }),
  }),
  z.object({
    type: z.literal('mafia:timer-start'),
    payload: z.object({
      startedAt: z.number().int(),
      duration: z.number().int().min(30_000).max(7_200_000),
      isRunning: z.boolean().optional(),
    }),
  }),
  z.object({
    type: z.literal('mafia:timer-stop'),
    payload: z.object({}).strict(),
  }),
  z.object({
    type: z.literal('mafia:player-kick'),
    payload: z.object({
      peerId: z.string().min(1),
    }),
  }),
])

export type ClientMessage = z.infer<typeof clientMessageSchema>

export type TransportOptionsPayload = {
  id: string
  iceParameters: IceParameters
  iceCandidates: IceCandidate[]
  dtlsParameters: DtlsParameters
  /** Passed to RTCPeerConnection; set via ICE_SERVERS_JSON or TURN_* env. */
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
  /** Omitted when empty (no avatar at join). */
  avatarUrl?: string
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
  | { type: 'peer-joined'; payload: { peerId: string; displayName: string; avatarUrl?: string } }
  | { type: 'peer-display-name'; payload: { peerId: string; displayName: string } }
  | { type: 'peer-left'; payload: { peerId: string } }
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
  | { type: 'mafia:host-updated'; payload: { hostPeerId: string | null } }
  | { type: 'mafia:queue-update'; payload: { speakingQueue: number[] } }
  | {
      type: 'mafia:reshuffle'
      payload: {
        players: Array<{
          peerId: string
          seat: number
          role: 'mafia' | 'don' | 'sheriff' | 'doctor' | 'civilian'
        }>
      }
    }
  | {
      type: 'mafia:players-update'
      payload: {
        order: string[]
        nightActions?: Partial<{
          mafia: number
          doctor: number
          sheriff: number
          don: number
        }>
        speakingQueue: number[]
      }
    }
  | { type: 'mafia:timer-start'; payload: { startedAt: number; duration: number; isRunning: boolean } }
  | { type: 'mafia:timer-stop'; payload: Record<string, never> }
  | { type: 'mafia:player-kick'; payload: { peerId: string } }

export type SignalingDeps = {
  roomManager: RoomManager
  socketPeer: Map<WsSocket, Peer>
}

export function sendServerMessage(socket: WsSocket, message: ServerMessage): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message))
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
  const list: ExistingProducerInfo[] = []
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
      }
      list.push(row)
    }
  }
  return list
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
 */
function requestVideoKeyframesForProducerConsumers(room: Room, producerId: string): void {
  for (const p of room.getPeers()) {
    for (const c of p.getConsumers()) {
      if (c.closed || c.kind !== 'video' || c.producerId !== producerId) {
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

function broadcastPeerLeftToRoom(room: Room, leftPeerId: string): void {
  const msg: ServerMessage = { type: 'peer-left', payload: { peerId: leftPeerId } }
  for (const p of room.getPeers()) {
    p.sendJson(msg)
  }
}

function broadcastMafiaHostUpdated(room: Room): void {
  const hostPeerId = room.getMafiaHostPeerId()
  const msg: ServerMessage = { type: 'mafia:host-updated', payload: { hostPeerId } }
  for (const p of room.getPeers()) {
    p.sendJson(msg)
  }
}

const MAFIA_MAX_SEAT = 12

function sanitizeMafiaSpeakingQueueList(raw: unknown, maxSeat: number): number[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const out: number[] = []
  const seen = new Set<number>()
  const cap = Math.max(1, Math.min(MAFIA_MAX_SEAT, maxSeat))
  for (const x of raw) {
    if (typeof x !== 'number' || !Number.isInteger(x)) {
      continue
    }
    if (x < 1 || x > cap) {
      continue
    }
    if (seen.has(x)) {
      continue
    }
    seen.add(x)
    out.push(x)
  }
  return out
}

function broadcastMafiaQueueUpdate(room: Room): void {
  const speakingQueue = room.getMafiaSpeakingQueue()
  const msg: ServerMessage = { type: 'mafia:queue-update', payload: { speakingQueue } }
  for (const p of room.getPeers()) {
    p.sendJson(msg)
  }
}

function broadcastMafiaReshuffle(
  room: Room,
  payload: {
    players: Array<{
      peerId: string
      seat: number
      role: 'mafia' | 'don' | 'sheriff' | 'doctor' | 'civilian'
    }>
  },
): void {
  const msg: ServerMessage = { type: 'mafia:reshuffle', payload }
  for (const p of room.getPeers()) {
    p.sendJson(msg)
  }
}

function finalizeRoomIfEmpty(room: Room, roomManager: RoomManager): void {
  if (room.getPeers().length > 0) {
    return
  }
  room.dispose()
  roomManager.removeRoom(room.id)
}

export function removePeerFromNetwork(peer: Peer, deps: SignalingDeps): void {
  const room = deps.roomManager.getRoom(peer.roomId)
  if (room) {
    detachPeerAudioProducersFromLevelObserver(peer, room)
  }
  const hostIdBeforeRemove = room?.getMafiaHostPeerId() ?? null
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
  if (hostIdBeforeRemove === peer.id) {
    const nextPeers = room.getPeers()
    const nextId = nextPeers.length > 0 ? nextPeers[0]!.id : null
    room.setMafiaHostPeerId(nextId)
    broadcastMafiaHostUpdated(room)
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

function replaceDuplicatePeerId(room: Room, incomingSocket: WsSocket, peerId: string, deps: SignalingDeps): void {
  const existing = room.getPeer(peerId)
  if (!existing || existing.socket === incomingSocket) {
    return
  }

  console.warn('[signaling] duplicate peerId in room; closing previous socket (open a new tab with a fresh peer id)', {
    roomId: room.id,
    peerId,
  })

  detachPeerAudioProducersFromLevelObserver(existing, room)
  existing.closeAllMedia()
  deps.socketPeer.delete(existing.socket)
  const wasHost = room.getMafiaHostPeerId() === peerId
  room.removePeer(peerId)
  broadcastPeerLeftToRoom(room, peerId)
  if (wasHost) {
    const nextPeers = room.getPeers()
    const nextId = nextPeers.length > 0 ? nextPeers[0]!.id : null
    room.setMafiaHostPeerId(nextId)
    broadcastMafiaHostUpdated(room)
  }

  try {
    existing.socket.close(4000, 'Replaced by new connection')
  } catch {
    // ignore
  }

  finalizeRoomIfEmpty(room, deps.roomManager)
}

function sanitizeDisplayName(raw: string | undefined, peerId: string): string {
  const t = raw?.trim() ?? ''
  if (t.length > 0) {
    return t.slice(0, 64)
  }
  return `Guest ${peerId.length > 6 ? peerId.slice(-6) : peerId}`
}

/** Client-announced profile URL — http(s) only, bounded length. */
function sanitizeAvatarUrl(raw: string | undefined): string {
  const t = raw?.trim() ?? ''
  if (t.length === 0) {
    return ''
  }
  if (t.length > 2048) {
    return ''
  }
  try {
    const u = new URL(t)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      return ''
    }
    return t
  } catch {
    return ''
  }
}

function roomPeerRow(p: Peer): RoomPeerInfo {
  const row: RoomPeerInfo = { peerId: p.id, displayName: p.displayName }
  if (p.avatarUrl.length > 0) {
    row.avatarUrl = p.avatarUrl
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
  deps: SignalingDeps,
): Promise<void> {
  disassociateSocketFromCurrentRoom(socket, deps)

  let room = await deps.roomManager.getOrCreateRoom(roomId)
  replaceDuplicatePeerId(room, socket, peerId, deps)
  room = await deps.roomManager.getOrCreateRoom(roomId)

  const name = sanitizeDisplayName(displayName, peerId)
  const avatarUrlSafe = sanitizeAvatarUrl(avatarUrlRaw)
  const peer = new Peer(peerId, socket, room.id, name, avatarUrlSafe)
  room.addPeer(peer)
  deps.socketPeer.set(socket, peer)

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

  room.sendActiveSpeakerCatchUpToPeer(peer)

  const joinedMsg: ServerMessage = {
    type: 'peer-joined',
    payload: {
      peerId,
      displayName: name,
      ...(avatarUrlSafe.length > 0 ? { avatarUrl: avatarUrlSafe } : {}),
    },
  }
  for (const p of room.getPeers()) {
    if (p.id === peerId) {
      continue
    }
    p.sendJson(joinedMsg)
  }

  sendServerMessage(socket, {
    type: 'mafia:host-updated',
    payload: { hostPeerId: room.getMafiaHostPeerId() },
  })
  sendServerMessage(socket, {
    type: 'mafia:queue-update',
    payload: { speakingQueue: room.getMafiaSpeakingQueue() },
  })
  {
    const mt = room.getMafiaTimer()
    if (mt != null) {
      const rem = mt.duration - (Date.now() - mt.startedAt)
      if (rem > 0) {
        sendServerMessage(socket, { type: 'mafia:timer-start', payload: { ...mt, isRunning: true } })
      } else {
        room.setMafiaTimer(null)
      }
    }
  }
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
  const msg = {
    type: 'call-chat' as const,
    payload: {
      peerId: peer.id,
      displayName: peer.displayName,
      text: trimmed,
      at: Date.now(),
    },
  }
  for (const p of room.getPeers()) {
    p.sendJson(msg)
  }
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
  const msg = { type: 'raise-hand' as const, payload: { peerId: peer.id, raised } }
  for (const p of room.getPeers()) {
    p.sendJson(msg)
  }
}

/**
 * First peer to claim with no current host becomes Mafia host; idempotent for the same socket.
 * Does not reassign a host that already exists (another peerId).
 */
export function handleMafiaClaimHost(socket: WsSocket, deps: SignalingDeps): void {
  const peer = getPeerForSocket(socket, deps)
  if (!peer) {
    return
  }
  const room = deps.roomManager.getRoom(peer.roomId)
  if (!room) {
    return
  }
  const current = room.getMafiaHostPeerId()
  if (current === peer.id) {
    return
  }
  if (current != null) {
    return
  }
  room.setMafiaHostPeerId(peer.id)
  broadcastMafiaHostUpdated(room)
}

/**
 * Only the current Mafia host may update the shared speaking queue; server republishes to the room.
 */
export function handleMafiaQueueUpdate(
  socket: WsSocket,
  payload: { speakingQueue: unknown } | null | undefined,
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
  if (room.getMafiaHostPeerId() !== peer.id) {
    return
  }
  const list = (payload as { speakingQueue?: unknown } | null | undefined)?.speakingQueue
  const maxSeat = room.getPeers().length > 0 ? room.getPeers().length : MAFIA_MAX_SEAT
  const sanitized = sanitizeMafiaSpeakingQueueList(list, maxSeat)
  room.setMafiaSpeakingQueue(sanitized)
  broadcastMafiaQueueUpdate(room)
}

/**
 * Only the Mafia host may broadcast a post-reshuffle snapshot; server republishes to the room.
 */
export function handleMafiaReshuffle(
  socket: WsSocket,
  payload: {
    players: Array<{
      peerId: string
      seat: number
      role: 'mafia' | 'don' | 'sheriff' | 'doctor' | 'civilian'
    }>
  },
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
  if (room.getMafiaHostPeerId() !== peer.id) {
    return
  }
  const peers = room.getPeers()
  if (peers.length < 1) {
    return
  }
  const roomIds = new Set(peers.map((p) => p.id))
  const { players: list } = payload
  if (list.length !== peers.length || list.length !== roomIds.size) {
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
    used.add(pl.peerId)
  }
  if (used.size !== roomIds.size) {
    return
  }
  broadcastMafiaReshuffle(room, payload)
}

function broadcastMafiaPlayerKick(room: Room, payload: { peerId: string }): void {
  const msg: ServerMessage = { type: 'mafia:player-kick', payload }
  for (const p of room.getPeers()) {
    p.sendJson(msg)
  }
}

/**
 * Only the Mafia host may mark a player eliminated; server republishes to the room.
 */
export function handleMafiaPlayerKick(
  socket: WsSocket,
  payload: { peerId: string },
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
  if (room.getMafiaHostPeerId() !== peer.id) {
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
  broadcastMafiaPlayerKick(room, { peerId: targetId })
}

function broadcastMafiaPlayersUpdate(
  room: Room,
  payload: {
    order: string[]
    nightActions?: {
      mafia?: number
      doctor?: number
      sheriff?: number
      don?: number
    }
    speakingQueue: number[]
  },
): void {
  const msg: ServerMessage = { type: 'mafia:players-update', payload }
  for (const p of room.getPeers()) {
    p.sendJson(msg)
  }
}

/**
 * Only the Mafia host may push numbering / night + speaking state; server republishes to the room.
 */
export function handleMafiaPlayersUpdate(
  socket: WsSocket,
  payload: {
    order: string[]
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
  const peer = getPeerForSocket(socket, deps)
  if (!peer) {
    return
  }
  const room = deps.roomManager.getRoom(peer.roomId)
  if (!room) {
    return
  }
  if (room.getMafiaHostPeerId() !== peer.id) {
    return
  }
  const peers = room.getPeers()
  if (peers.length < 1) {
    return
  }
  const roomIds = new Set(peers.map((p) => p.id))
  const { order: list, speakingQueue: q } = payload
  if (list.length !== peers.length || list.length !== roomIds.size) {
    return
  }
  const used = new Set<string>()
  for (const id of list) {
    if (!roomIds.has(id) || used.has(id)) {
      return
    }
    used.add(id)
  }
  if (used.size !== roomIds.size) {
    return
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
  broadcastMafiaPlayersUpdate(room, payload)
}

function broadcastMafiaTimerStart(
  room: Room,
  payload: { startedAt: number; duration: number; isRunning: true },
): void {
  const msg: ServerMessage = { type: 'mafia:timer-start', payload }
  for (const p of room.getPeers()) {
    p.sendJson(msg)
  }
}

function broadcastMafiaTimerStop(room: Room): void {
  const msg: ServerMessage = { type: 'mafia:timer-stop', payload: {} }
  for (const p of room.getPeers()) {
    p.sendJson(msg)
  }
}

/**
 * Only the Mafia host may start the shared room timer; server stores it for late joiners and republishes.
 */
export function handleMafiaTimerStart(
  socket: WsSocket,
  payload: { startedAt: number; duration: number; isRunning?: boolean },
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
  if (room.getMafiaHostPeerId() !== peer.id) {
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

/** Only the Mafia host may clear the shared room timer. */
export function handleMafiaTimerStop(socket: WsSocket, deps: SignalingDeps): void {
  const peer = getPeerForSocket(socket, deps)
  if (!peer) {
    return
  }
  const room = deps.roomManager.getRoom(peer.roomId)
  if (!room) {
    return
  }
  if (room.getMafiaHostPeerId() !== peer.id) {
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
  const msg: ServerMessage = {
    type: 'peer-display-name',
    payload: { peerId: peer.id, displayName: name },
  }
  for (const p of room.getPeers()) {
    p.sendJson(msg)
  }
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
  for (const p of peer.getProducers()) {
    if (p.closed || p.kind !== 'video') {
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
  const notice: ServerMessage = {
    type: 'producer-video-source-changed',
    payload: { producerId, peerId: peer.id, source },
  }
  for (const p of room.getPeers()) {
    p.sendJson(notice)
  }
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
    if (producer.paused) {
      await producer.resume()
    }

    if (producer.kind === 'audio') {
      for (const prev of previousAudioProducers) {
        await room.removeAudioProducerFromLevelObserver(prev.id)
        peer.removeProducer(prev.id)
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
    for (const p of room.getPeers()) {
      if (p.id === peer.id) {
        continue
      }
      p.sendJson(notice)
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
    // resuming would restart RTP for everyone and breaks Meet-style mute. Consumers are still created fine.

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
    // `track.muted` / no inbound RTP when SFU starts forwarding slightly before the recv path is ready.
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

export function handleDisconnect(socket: WsSocket, deps: SignalingDeps): void {
  const peer = deps.socketPeer.get(socket)
  if (!peer) {
    return
  }
  removePeerFromNetwork(peer, deps)
}
