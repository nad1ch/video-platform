import WebSocket from 'ws'
import type { WebSocket as WsSocket } from 'ws'
import { z } from 'zod'
import type {
  DtlsParameters,
  IceCandidate,
  IceParameters,
} from 'mediasoup/node/lib/WebRtcTransportTypes'
import type { RtpCapabilities } from 'mediasoup/node/lib/rtpParametersTypes'
import type { WebRtcTransport } from 'mediasoup/node/lib/types'
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
])

export type ClientMessage = z.infer<typeof clientMessageSchema>

export type TransportOptionsPayload = {
  id: string
  iceParameters: IceParameters
  iceCandidates: IceCandidate[]
  dtlsParameters: DtlsParameters
}

export type ServerMessage =
  | {
      type: 'room-state'
      payload: { peers: string[]; routerRtpCapabilities: RtpCapabilities }
    }
  | { type: 'peer-joined'; payload: { peerId: string } }
  | { type: 'peer-left'; payload: { peerId: string } }
  | {
      type: 'transport-created'
      payload: { direction: 'send' | 'recv'; transportOptions: TransportOptionsPayload }
    }
  | { type: 'transport-connected'; payload: { transportId: string } }

export type SignalingDeps = {
  roomManager: RoomManager
  socketPeer: Map<WsSocket, Peer>
}

export function sendServerMessage(socket: WsSocket, message: ServerMessage): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message))
  }
}

function serializeTransportOptions(transport: WebRtcTransport): TransportOptionsPayload {
  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
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
  peer.closeAllMedia()
  deps.socketPeer.delete(peer.socket)
  const room = deps.roomManager.getRoom(peer.roomId)
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

export async function handleJoinRoom(
  socket: WsSocket,
  roomId: string,
  peerId: string,
  deps: SignalingDeps,
): Promise<void> {
  disassociateSocketFromCurrentRoom(socket, deps)

  let room = await deps.roomManager.getOrCreateRoom(roomId)
  replaceDuplicatePeerId(room, socket, peerId, deps)
  room = await deps.roomManager.getOrCreateRoom(roomId)

  const peer = new Peer(peerId, socket, room.id)
  room.addPeer(peer)
  deps.socketPeer.set(socket, peer)

  const others = room
    .getPeers()
    .filter((p) => p.id !== peerId)
    .map((p) => p.id)

  const routerRtpCapabilities: RtpCapabilities = room.getRouter().rtpCapabilities

  sendServerMessage(socket, {
    type: 'room-state',
    payload: { peers: others, routerRtpCapabilities },
  })

  const joinedMsg: ServerMessage = { type: 'peer-joined', payload: { peerId } }
  for (const p of room.getPeers()) {
    if (p.id === peerId) {
      continue
    }
    p.sendJson(joinedMsg)
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
  } catch (err) {
    console.error('connect-transport failed', err)
  }
}

export function handleDisconnect(socket: WsSocket, deps: SignalingDeps): void {
  const peer = deps.socketPeer.get(socket)
  if (!peer) {
    return
  }
  removePeerFromNetwork(peer, deps)
}
