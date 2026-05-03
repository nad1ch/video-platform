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
  handleMafiaModeUpdate,
  handleMafiaSettingsUpdate,
  handleMafiaPageBackgroundSettings,
  handleMafiaTimerStart,
  handleMafiaTimerStop,
  handleMafiaPlayerKick,
  handleMafiaPlayerRevive,
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

export function attachSocketServer(wss: WebSocketServer, roomManager: RoomManager): SignalingDeps {
  const socketPeer = new Map<WebSocket, Peer>()
  // Server-authoritative userId per socket, resolved from the HTTP-upgrade
  // session cookie at connect time. `handleJoinRoom` reads this instead of
  // the untrusted client-supplied `userId` (Mafia host scoping).
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
      // Misconfigured JWT secret in prod would throw from authJwtSecret();
      // treat as "no session" so anonymous connects still succeed (they just
      // cannot claim Mafia host). Logged once for operators.
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[signaling] readSessionFromCookie threw on upgrade', err)
      }
    }
    return ''
  }

  // WS-level ping-frame heartbeat + isAlive tracking + terminate-on-timeout.
  // Shared with Nadle / Nadraw / Checkers / Eat-First via `utils/wsHeartbeat`.
  // Registered BEFORE our own `'connection'` listener below so the helper's
  // `ext.isAlive = true` + `'pong'` handler run first (matches the previous
  // inline ordering semantics).
  attachWsHeartbeat(wss, { intervalMs: WS_PING_INTERVAL_MS, logLabel: 'signaling-ws' })

  // App-level JSON ping so reverse proxies that ignore WS-level pings still
  // observe traffic on idle signaling sockets. Iteration model is intentionally
  // direct on `wss.clients` (the signaling server has no per-room index of
  // its own), which differs from the game servers' `clientsByStreamer` /
  // `clientsByRoom` maps — so this interval stays local instead of being
  // hoisted into the shared helper.
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

  wss.on('close', () => {
    clearInterval(jsonPing)
  })

  wss.on('connection', (socket, req) => {
    // Resolve identity ONCE per upgrade — the cookie is not resent on WS frames.
    // If the session later changes (e.g. logout in another tab), the client is
    // expected to reconnect the WS; we keep the identity stable for the lifetime
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
              await handleJoinRoom(socket, roomId, peerId, displayName, avatarUrl, userId, deps)
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
