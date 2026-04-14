import WebSocket from 'ws'
import type { WebSocket as WsSocket } from 'ws'
import { z } from 'zod'
import type {
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
      temporalLayer: z.number().int().min(0).max(4).optional(),
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
}

export type RoomPeerInfo = {
  peerId: string
  displayName: string
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
  | { type: 'peer-joined'; payload: { peerId: string; displayName: string } }
  | { type: 'peer-display-name'; payload: { peerId: string; displayName: string } }
  | { type: 'peer-left'; payload: { peerId: string } }
  | {
      type: 'transport-created'
      payload: { direction: 'send' | 'recv'; transportOptions: TransportOptionsPayload }
    }
  | { type: 'transport-connected'; payload: { transportId: string } }
  | { type: 'produced'; payload: { id: string; requestId: string } }
  | { type: 'new-producer'; payload: { producerId: string; peerId: string; kind: MediaKind } }
  | {
      type: 'consumed'
      payload: {
        id: string
        producerId: string
        kind: MediaKind
        rtpParameters: RtpParameters
      }
    }
  | { type: 'producer-sync'; payload: { producers: ExistingProducerInfo[] } }
  | { type: 'consume-failed'; payload: { producerId: string; reason: string } }
  | { type: 'active-speaker'; payload: { peerId: string | null } }

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
      list.push({ producerId: producer.id, peerId: p.id, kind: producer.kind })
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

function finalizeRoomIfEmpty(room: Room, roomManager: RoomManager): void {
  if (room.getPeers().length > 0) {
    return
  }
  room.dispose()
  roomManager.removeRoom(room.id)
}

function removePeerFromNetwork(peer: Peer, deps: SignalingDeps): void {
  const room = deps.roomManager.getRoom(peer.roomId)
  if (room) {
    detachPeerAudioProducersFromLevelObserver(peer, room)
  }
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

  detachPeerAudioProducersFromLevelObserver(existing, room)
  existing.closeAllMedia()
  deps.socketPeer.delete(existing.socket)
  room.removePeer(peerId)
  broadcastPeerLeftToRoom(room, peerId)

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

export async function handleJoinRoom(
  socket: WsSocket,
  roomId: string,
  peerId: string,
  displayName: string | undefined,
  deps: SignalingDeps,
): Promise<void> {
  disassociateSocketFromCurrentRoom(socket, deps)

  let room = await deps.roomManager.getOrCreateRoom(roomId)
  replaceDuplicatePeerId(room, socket, peerId, deps)
  room = await deps.roomManager.getOrCreateRoom(roomId)

  const name = sanitizeDisplayName(displayName, peerId)
  const peer = new Peer(peerId, socket, room.id, name)
  room.addPeer(peer)
  deps.socketPeer.set(socket, peer)

  const others: RoomPeerInfo[] = room
    .getPeers()
    .filter((p) => p.id !== peerId)
    .map((p) => ({ peerId: p.id, displayName: p.displayName }))

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
    payload: { peerId, displayName: name },
  }
  for (const p of room.getPeers()) {
    if (p.id === peerId) {
      continue
    }
    p.sendJson(joinedMsg)
  }
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
        sendServerMessage(socket, {
          type: 'producer-sync',
          payload: { producers },
        })
      }
    }
  } catch (err) {
    console.error('connect-transport failed', err)
  }
}

export async function handleProduce(
  socket: WsSocket,
  transportId: string,
  kind: 'audio' | 'video',
  rtpParameters: unknown,
  requestId: string,
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

  const transport = peer.getTransport(transportId)
  if (!transport || transport.closed || transportDirection(transport) !== 'send') {
    return
  }

  try {
    const previousAudioProducers =
      kind === 'audio' ? peer.getProducers().filter((p) => p.kind === 'audio') : []

    const producer = await transport.produce({
      kind,
      rtpParameters: rtpParameters as RtpParameters,
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

    if (producer.kind === 'audio') {
      await room.addAudioProducerToLevelObserver(producer.id)
    }

    sendServerMessage(socket, {
      type: 'produced',
      payload: { id: producer.id, requestId },
    })

    const notice: ServerMessage = {
      type: 'new-producer',
      payload: { producerId: producer.id, peerId: peer.id, kind: producer.kind },
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
    if (sourceProducer.paused) {
      await sourceProducer.resume()
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities: caps,
      paused: true,
    })

    if (process.env.NODE_ENV !== 'production') {
      console.log('[consume] consumer created', {
        producerId,
        kind: consumer.kind,
        consumerPaused: consumer.paused,
        producerPaused: sourceProducer.paused,
      })
    }

    await consumer.resume()

    if (process.env.NODE_ENV !== 'production') {
      console.log('[consume] after consumer.resume', {
        consumerPaused: consumer.paused,
      })
    }

    peer.addConsumer(consumer)

    sendServerMessage(socket, {
      type: 'consumed',
      payload: {
        id: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      },
    })
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

  try {
    if (temporalLayer === undefined) {
      await consumer.setPreferredLayers({ spatialLayer })
    } else {
      await consumer.setPreferredLayers({ spatialLayer, temporalLayer })
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log('[layers] server setPreferredLayers', { consumerId, spatialLayer, temporalLayer })
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[layers] server setPreferredLayers failed', { consumerId, spatialLayer, temporalLayer, err })
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
