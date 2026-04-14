import type { WebSocketServer } from 'ws'
import type { DtlsParameters } from 'mediasoup/types'
import type { RoomManager } from '../rooms/RoomManager'
import type { Peer } from '../peers/Peer'
import type { WebSocket } from 'ws'
import {
  clientMessageSchema,
  handleConnectTransport,
  handleConsume,
  handleCreateTransport,
  handleDisconnect,
  handleJoinRoom,
  handleProduce,
  handleSetConsumerPreferredLayers,
  handleUpdateDisplayName,
} from './messageHandlers'

export function attachSocketServer(wss: WebSocketServer, roomManager: RoomManager): void {
  const socketPeer = new Map<WebSocket, Peer>()
  const deps = { roomManager, socketPeer }

  wss.on('connection', (socket) => {
    const onDisconnect = (): void => {
      handleDisconnect(socket, deps)
    }

    socket.on('message', (raw) => {
      void (async () => {
        let data: unknown
        try {
          data = JSON.parse(raw.toString())
        } catch {
          return
        }

        const parsed = clientMessageSchema.safeParse(data)
        if (!parsed.success) {
          return
        }

        try {
          switch (parsed.data.type) {
            case 'join-room': {
              const { roomId, peerId, displayName } = parsed.data.payload
              await handleJoinRoom(socket, roomId, peerId, displayName, deps)
              break
            }
            case 'update-display-name': {
              const { displayName } = parsed.data.payload
              handleUpdateDisplayName(socket, displayName, deps)
              break
            }
            case 'create-transport': {
              const { direction } = parsed.data.payload
              await handleCreateTransport(socket, direction, deps)
              break
            }
            case 'connect-transport': {
              const { transportId, dtlsParameters } = parsed.data.payload
              await handleConnectTransport(
                socket,
                transportId,
                dtlsParameters as DtlsParameters,
                deps,
              )
              break
            }
            case 'produce': {
              const { transportId, kind, rtpParameters, requestId } = parsed.data.payload
              await handleProduce(socket, transportId, kind, rtpParameters, requestId, deps)
              break
            }
            case 'consume': {
              const { transportId, producerId, rtpCapabilities } = parsed.data.payload
              await handleConsume(socket, transportId, producerId, rtpCapabilities, deps)
              break
            }
            case 'set-consumer-preferred-layers': {
              const { consumerId, spatialLayer, temporalLayer } = parsed.data.payload
              await handleSetConsumerPreferredLayers(socket, consumerId, spatialLayer, temporalLayer, deps)
              break
            }
            default:
              break
          }
        } catch (err) {
          console.error('signaling handler failed', err)
        }
      })()
    })

    socket.on('close', onDisconnect)
    socket.on('error', onDisconnect)
  })
}
