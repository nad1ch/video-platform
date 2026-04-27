import type { WebSocketServer } from 'ws'
import type { DtlsParameters } from 'mediasoup/types'
import type { RoomManager } from '../rooms/RoomManager'
import type { Peer } from '../peers/Peer'
import WebSocket from 'ws'
import type { WebSocket as WsType } from 'ws'
import type { SignalingDeps } from './messageHandlers'
import {
  clientMessageSchema,
  handleConnectTransport,
  handleConsume,
  handleCreateTransport,
  handleCallChat,
  handleDisconnect,
  handleJoinRoom,
  handleMafiaClaimHost,
  handleMafiaQueueUpdate,
  handleMafiaReshuffle,
  handleMafiaPlayersUpdate,
  handleMafiaModeUpdate,
  handleMafiaTimerStart,
  handleMafiaTimerStop,
  handleMafiaPlayerKick,
  handleMafiaForceCameraOff,
  handleMafiaForceMuteAll,
  handleProduce,
  handleProducerVideoSource,
  handleSetOutboundVideoPaused,
  handleSetAudioMuted,
  handleRaiseHand,
  handleRequestProducerSync,
  handleSetConsumerPreferredLayers,
  handleUpdateDisplayName,
  sendServerMessage,
} from './messageHandlers'

const WS_PING_INTERVAL_MS = 45_000
/** JSON frames so reverse proxies that ignore WS-level ping still see traffic. */
const WS_JSON_PING_INTERVAL_MS = 25_000

type WsWithAlive = WsType & { isAlive?: boolean }

export function attachSocketServer(wss: WebSocketServer, roomManager: RoomManager): SignalingDeps {
  const socketPeer = new Map<WebSocket, Peer>()
  const deps: SignalingDeps = { roomManager, socketPeer }
  roomManager.bindSignalingDeps(deps)

  const jsonPing = setInterval(() => {
    for (const socket of wss.clients) {
      if (socket.readyState !== WebSocket.OPEN) {
        continue
      }
      try {
        socket.send(JSON.stringify({ type: 'ping' }))
      } catch {
        /* ignore */
      }
    }
  }, WS_JSON_PING_INTERVAL_MS)
  if (typeof jsonPing.unref === 'function') {
    jsonPing.unref()
  }

  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      const s = socket as WsWithAlive
      if (s.readyState !== WebSocket.OPEN) {
        continue
      }
      if (s.isAlive === false) {
        s.terminate()
        continue
      }
      s.isAlive = false
      s.ping()
    }
  }, WS_PING_INTERVAL_MS)

  if (typeof heartbeat.unref === 'function') {
    heartbeat.unref()
  }

  wss.on('close', () => {
    clearInterval(heartbeat)
    clearInterval(jsonPing)
  })

  wss.on('connection', (socket) => {
    const ext = socket as WsWithAlive
    ext.isAlive = true
    socket.on('pong', () => {
      ext.isAlive = true
    })

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
            case 'client-ping': {
              sendServerMessage(socket, { type: 'server-pong', payload: {} })
              break
            }
            case 'pong': {
              break
            }
            case 'join-room': {
              const { roomId, peerId, displayName, avatarUrl } = parsed.data.payload
              await handleJoinRoom(socket, roomId, peerId, displayName, avatarUrl, deps)
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
              const { transportId, kind, rtpParameters, requestId, videoSource } = parsed.data.payload
              await handleProduce(
                socket,
                transportId,
                kind,
                rtpParameters,
                requestId,
                deps,
                videoSource,
              )
              break
            }
            case 'producer-video-source': {
              const { producerId, source } = parsed.data.payload
              await handleProducerVideoSource(socket, producerId, source, deps)
              break
            }
            case 'set-outbound-video-paused': {
              const { paused } = parsed.data.payload
              await handleSetOutboundVideoPaused(socket, paused, deps)
              break
            }
            case 'set-audio-muted': {
              const { muted } = parsed.data.payload
              handleSetAudioMuted(socket, muted, deps)
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
            case 'call-chat': {
              const { text } = parsed.data.payload
              handleCallChat(socket, text, deps)
              break
            }
            case 'raise-hand': {
              const { raised } = parsed.data.payload
              handleRaiseHand(socket, raised, deps)
              break
            }
            case 'mafia:claim-host': {
              handleMafiaClaimHost(socket, deps)
              break
            }
            case 'mafia:queue-update': {
              handleMafiaQueueUpdate(socket, parsed.data.payload, deps)
              break
            }
            case 'mafia:reshuffle': {
              handleMafiaReshuffle(socket, parsed.data.payload, deps)
              break
            }
            case 'mafia:players-update': {
              handleMafiaPlayersUpdate(socket, parsed.data.payload, deps)
              break
            }
            case 'mafia:mode-update': {
              handleMafiaModeUpdate(socket, parsed.data.payload, deps)
              break
            }
            case 'mafia:timer-start': {
              handleMafiaTimerStart(socket, parsed.data.payload, deps)
              break
            }
            case 'mafia:timer-stop': {
              handleMafiaTimerStop(socket, deps)
              break
            }
            case 'mafia:player-kick': {
              handleMafiaPlayerKick(socket, parsed.data.payload, deps)
              break
            }
            case 'mafia:force-camera-off': {
              handleMafiaForceCameraOff(socket, parsed.data.payload, deps)
              break
            }
            case 'mafia:force-mute-all': {
              handleMafiaForceMuteAll(socket, parsed.data.payload, deps)
              break
            }
            case 'request-producer-sync': {
              handleRequestProducerSync(socket, deps, parsed.data.payload)
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

  return deps
}
