import type { IncomingMessage } from 'node:http'
import type { WebSocketServer } from 'ws'
import type { DtlsParameters } from 'mediasoup/types'
import type { RoomManager } from '../rooms/RoomManager'
import type { Peer } from '../peers/Peer'
import WebSocket from 'ws'
import { readSessionFromCookie } from '../auth/session/sessionJwt'
import { attachWsHeartbeat } from '../utils/wsHeartbeat'
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
  handleMafiaTransferHost,
  handleMafiaQueueUpdate,
  handleMafiaReshuffle,
  handleMafiaPlayersUpdate,
  handleMafiaPlayerNameUpdate,
  handleMafiaModeUpdate,
  handleMafiaSettingsUpdate,
  handleMafiaPageBackgroundSettings,
  handleMafiaAudioMixUpdate,
  handleMafiaTimerStart,
  handleMafiaTimerStop,
  handleMafiaPlayerKick,
  handleMafiaPlayerRevive,
  handleMafiaForceCameraOff,
  handleMafiaForceMuteAll,
  handleEatFirstForceMuteAll,
  handleEatFirstSlotClaim,
  handleEatFirstTraitRevealRequest,
  handleEatFirstTraitRegenerateRequest,
  handleEatFirstTraitTypeRerollRequest,
  handleEatFirstActionCardRerollRequest,
  handleEatFirstActionCardUse,
  handleEatFirstPlayersUpdate,
  handleEatFirstSpeakingQueueUpdate,
  handleEatFirstTableRoundDeal,
  handleEatFirstTimerStart,
  handleEatFirstTimerStop,
  handleProduce,
  handleProducerVideoSource,
  handleSetOutboundVideoPaused,
  handleSetAudioMuted,
  handleRaiseHand,
  handleRequestProducerSync,
  handleSetConsumerPaused,
  handleSetConsumerPreferredLayers,
  handleUpdateDisplayName,
  sendServerMessage,
} from './messageHandlers'

const WS_PING_INTERVAL_MS = 45_000

const WS_JSON_PING_INTERVAL_MS = 25_000

export function attachSocketServer(wss: WebSocketServer, roomManager: RoomManager): SignalingDeps {
  const socketPeer = new Map<WebSocket, Peer>()
  // Server-authoritative userId per socket, resolved from the HTTP-upgrade
  
  
  const socketSessionUserId = new WeakMap<WebSocket, string>()
  const deps: SignalingDeps = { roomManager, socketPeer, socketSessionUserId }
  roomManager.bindSignalingDeps(deps)

  function resolveSessionUserIdFromUpgrade(req: IncomingMessage): string {
    try {
      const session = readSessionFromCookie(req.headers.cookie)
      if (session && typeof session.id === 'string' && session.id.trim().length > 0) {
        return session.id.trim()
      }
    } catch (err) {
      
      
      
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[signaling] readSessionFromCookie threw on upgrade', err)
      }
    }
    return ''
  }

  
  
  
  
  
  attachWsHeartbeat(wss, { intervalMs: WS_PING_INTERVAL_MS, logLabel: 'signaling-ws' })

  
  // observe traffic on idle signaling sockets. Iteration model is intentionally
  // direct on `wss.clients` (the signaling server has no per-room index of
  
  
  
  
  
  
  const PING_FRAME = JSON.stringify({ type: 'ping' })

  const jsonPing = setInterval(() => {
    for (const socket of wss.clients) {
      if (socket.readyState !== WebSocket.OPEN) {
        continue
      }
      try {
        socket.send(PING_FRAME)
      } catch {
        /* ignore */
      }
    }
  }, WS_JSON_PING_INTERVAL_MS)
  if (typeof jsonPing.unref === 'function') {
    jsonPing.unref()
  }

  wss.on('close', () => {
    clearInterval(jsonPing)
  })

  wss.on('connection', (socket, req) => {
    
    
    
    // of this socket to avoid host-flapping mid-game.
    const sessionUserId = resolveSessionUserIdFromUpgrade(req)
    if (sessionUserId.length > 0) {
      socketSessionUserId.set(socket, sessionUserId)
    }

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

        const messageType = parsed.data.type
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
              const { roomId, peerId, displayName, avatarUrl, userId } = parsed.data.payload
              try {
                await handleJoinRoom(socket, roomId, peerId, displayName, avatarUrl, userId, deps)
              } catch (err) {





                console.error('[signaling] join-room failed', {
                  roomId,
                  peerId,
                  err: err instanceof Error ? err.message : String(err),
                })
                try {
                  if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({
                      type: 'error',
                      payload: { code: 'join_failed', message: 'Failed to join room' },
                    }))
                  }
                } catch {
                  /* socket may have closed mid-send */
                }
              }
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
              await handleSetAudioMuted(socket, muted, deps)
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
            case 'set-consumer-paused': {
              const { consumerId, paused } = parsed.data.payload
              await handleSetConsumerPaused(socket, consumerId, paused, deps)
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
              handleMafiaClaimHost(socket, parsed.data.payload, deps)
              break
            }
            case 'mafia:transfer-host': {
              handleMafiaTransferHost(socket, parsed.data.payload, deps)
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
            case 'mafia:player-name-update': {
              handleMafiaPlayerNameUpdate(socket, parsed.data.payload, deps)
              break
            }
            case 'mafia:mode-update': {
              handleMafiaModeUpdate(socket, parsed.data.payload, deps)
              break
            }
            case 'mafia:settings-update': {
              handleMafiaSettingsUpdate(socket, parsed.data.payload, deps)
              break
            }
            case 'mafia:page-background-settings': {
              handleMafiaPageBackgroundSettings(socket, parsed.data.payload, deps)
              break
            }
            case 'mafia:audio-mix-update': {
              handleMafiaAudioMixUpdate(socket, parsed.data.payload, deps)
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
            case 'mafia:player-revive': {
              handleMafiaPlayerRevive(socket, parsed.data.payload, deps)
              break
            }
            case 'mafia:force-camera-off': {
              await handleMafiaForceCameraOff(socket, parsed.data.payload, deps)
              break
            }
            case 'mafia:force-mute-all': {
              await handleMafiaForceMuteAll(socket, parsed.data.payload, deps)
              break
            }
            case 'eat:force-mute-all': {
              await handleEatFirstForceMuteAll(socket, parsed.data.payload, deps)
              break
            }
            case 'eat:slot-claim': {
              await handleEatFirstSlotClaim(socket, parsed.data.payload, deps)
              break
            }
            case 'eat:trait-reveal-request': {
              await handleEatFirstTraitRevealRequest(socket, parsed.data.payload, deps)
              break
            }
            case 'eat:trait-regenerate-request': {
              handleEatFirstTraitRegenerateRequest(socket, parsed.data.payload, deps)
              break
            }
            case 'eat:trait-type-reroll-request': {
              handleEatFirstTraitTypeRerollRequest(socket, parsed.data.payload, deps)
              break
            }
            case 'eat:action-card-reroll-request': {
              await handleEatFirstActionCardRerollRequest(socket, parsed.data.payload, deps)
              break
            }
            case 'eat:action-card-use': {
              await handleEatFirstActionCardUse(socket, parsed.data.payload, deps)
              break
            }
            case 'eat:players-update': {
              await handleEatFirstPlayersUpdate(socket, parsed.data.payload, deps)
              break
            }
            case 'eat:speaking-queue-update': {
              handleEatFirstSpeakingQueueUpdate(socket, parsed.data.payload, deps)
              break
            }
            case 'eat:table-round-deal': {
              await handleEatFirstTableRoundDeal(socket, deps)
              break
            }
            case 'eat:timer-start': {
              await handleEatFirstTimerStart(socket, parsed.data.payload, deps)
              break
            }
            case 'eat:timer-stop': {
              await handleEatFirstTimerStop(socket, deps)
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



          const peer = socketPeer.get(socket)
          console.error('[signaling] handler failed', {
            messageType,
            peerId: peer?.id,
            roomId: peer?.roomId,
            err: err instanceof Error ? err.message : String(err),
          })
        }
      })()
    })

    socket.on('close', onDisconnect)
    socket.on('error', onDisconnect)
  })

  return deps
}
