import type { IncomingMessage } from 'node:http'
import { randomUUID } from 'node:crypto'
import type { WebSocketServer } from 'ws'
import type { DtlsParameters } from 'mediasoup/types'
import type { RoomManager } from '../rooms/RoomManager'
import type { Peer } from '../peers/Peer'
import WebSocket from 'ws'
import { readSessionFromCookie } from '../auth/session/sessionJwt'
import { resolvePrismaUserIdFromSession } from '../auth/resolvePrismaUserFromSession'
import { attachWsHeartbeat } from '../utils/wsHeartbeat'
import { createRateLimiter } from '../utils/rateLimit'
import { newDiagnosticEventId, recordDiagnosticEvent } from './roomDiagnosticsBus'
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
  handleMafiaTimerPresetSelect,
  handleMafiaPlayerKick,
  handleMafiaPlayerRevive,
  handleMafiaForceCameraOff,
  handleMafiaForceMuteAll,
  handleMafiaRequestSnapshot,
  // Generic game-room (Phase 3A). Parallel of the Mafia handlers above —
  // each function is gated by `isGameRoomId(room.id)` and never reaches
  // into Mafia state.
  handleGameRoomClaimHost,
  handleGameRoomTransferHost,
  handleGameRoomQueueUpdate,
  handleGameRoomReshuffle,
  handleGameRoomPlayersUpdate,
  handleGameRoomPlayerNameUpdate,
  handleGameRoomAudioMixUpdate,
  handleGameRoomTimerStart,
  handleGameRoomTimerStop,
  handleGameRoomTimerPresetSelect,
  handleGameRoomPlayerKick,
  handleGameRoomPlayerRevive,
  handleGameRoomForceCameraOff,
  handleGameRoomForceMuteAll,
  handleGameRoomRequestSnapshot,
  handleEatFirstAudioMixUpdate,
  handleEatFirstForceMuteAll,
  handleEatFirstPageBackgroundSettings,
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
  handleEatFirstTimerPresetSelect,
  handleProduce,
  handleProducerVideoSource,
  handleSetOutboundVideoPaused,
  handleSetAudioMuted,
  handleSetCameraMirror,
  handleRaiseHand,
  handleRequestProducerSync,
  handleSetConsumerPaused,
  handleSetConsumerPreferredLayers,
  handleUpdateDisplayName,
  sendServerMessage,
} from './messageHandlers'

const WS_PING_INTERVAL_MS = 45_000

const WS_JSON_PING_INTERVAL_MS = 25_000

// Audit R1: conservative per-socket rate limits for the signaling dispatch path.
// Liveness frames bypass — the WS frame-level ping/pong and these JSON ping/pong
// must remain noise-free. All other parsed messages flow through the default
// limiter; expensive categories add a stricter limiter on top.
const WS_LIMIT_BYPASS_TYPES: ReadonlySet<string> = new Set(['client-ping', 'pong'])

const WS_SNAPSHOT_TYPES: ReadonlySet<string> = new Set([
  'mafia:request-snapshot',
  'gameroom:request-snapshot',
])

const WS_AUDIO_MIX_TYPES: ReadonlySet<string> = new Set([
  'mafia:audio-mix-update',
  'gameroom:audio-mix-update',
  'eat:audio-mix-update',
])

const WS_SETTINGS_TYPES: ReadonlySet<string> = new Set([
  'mafia:settings-update',
  'mafia:page-background-settings',
  'eat:page-background-settings',
])

const WS_EAT_MUTATE_TYPES: ReadonlySet<string> = new Set([
  'eat:trait-reveal-request',
  'eat:trait-regenerate-request',
  'eat:trait-type-reroll-request',
  'eat:action-card-reroll-request',
  'eat:players-update',
  'eat:table-round-deal',
])

export function attachSocketServer(wss: WebSocketServer, roomManager: RoomManager): SignalingDeps {
  const socketPeer = new Map<WebSocket, Peer>()

  // Audit R1: per-socket WS message rate limiters. Keys are a server-generated
  // UUID per socket — never anything client-controlled (userId / roomId / payload).
  // Buckets are reset eagerly on disconnect; limiters are stopped on wss close.
  const wsDefaultLimiter = createRateLimiter({
    windowMs: 1_000,
    limit: 60,
    label: 'ws-signaling-default',
  })
  const wsSnapshotLimiter = createRateLimiter({
    windowMs: 1_000,
    limit: 1,
    label: 'ws-signaling-snapshot',
  })
  const wsAudioMixLimiter = createRateLimiter({
    windowMs: 1_000,
    limit: 2,
    label: 'ws-signaling-audio-mix',
  })
  const wsSettingsLimiter = createRateLimiter({
    windowMs: 1_000,
    limit: 1,
    label: 'ws-signaling-settings',
  })
  const wsEatMutateLimiter = createRateLimiter({
    windowMs: 1_000,
    limit: 5,
    label: 'ws-signaling-eat-mutate',
  })
  const wsNoticeLimiter = createRateLimiter({
    windowMs: 1_000,
    limit: 1,
    label: 'ws-signaling-notice',
  })

  const socketLimiterKey = new WeakMap<WebSocket, string>()

  // Server-authoritative userId per socket, resolved from the HTTP-upgrade


  const socketSessionUserId = new WeakMap<WebSocket, string>()
  /**
   * Server-authoritative Prisma `User.id` per socket, resolved asynchronously
   * from the HTTP-upgrade session cookie via `resolvePrismaUserIdFromSession`.
   * Distinct from `socketSessionUserId` (which holds the session JWT `id`,
   * e.g. Twitch profile id) — see `Peer.prismaUserId` for context.
   *
   * Stored as a `Promise<string>` so `handleJoinRoom` can `await` the value
   * race-free: by the time the first `join-room` message is dispatched, the
   * lookup has typically completed; if it has not, the await suspends until
   * it does. The promise resolves to `''` for anonymous sockets, sockets
   * without a Prisma user, or any lookup failure (never rejects).
   *
   * Used by Eat First host authority (audit R3); other namespaces ignore it.
   */
  const socketSessionPrismaUserId = new WeakMap<WebSocket, Promise<string>>()
  const deps: SignalingDeps = {
    roomManager,
    socketPeer,
    socketSessionUserId,
    socketSessionPrismaUserId,
  }
  roomManager.bindSignalingDeps(deps)

  function readUpgradeSession(req: IncomingMessage): ReturnType<typeof readSessionFromCookie> {
    try {
      return readSessionFromCookie(req.headers.cookie)
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[signaling] readSessionFromCookie threw on upgrade', err)
      }
      return null
    }
  }

  function resolveSessionUserIdFromUpgrade(req: IncomingMessage): string {
    const session = readUpgradeSession(req)
    if (session && typeof session.id === 'string' && session.id.trim().length > 0) {
      return session.id.trim()
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
    wsDefaultLimiter.stop()
    wsSnapshotLimiter.stop()
    wsAudioMixLimiter.stop()
    wsSettingsLimiter.stop()
    wsEatMutateLimiter.stop()
    wsNoticeLimiter.stop()
  })

  wss.on('connection', (socket, req) => {
    // Audit R1: assign a server-generated rate-limit key for this socket. Never
    // derived from client input. Used only as opaque limiter bucket key.
    const limiterKey = randomUUID()
    socketLimiterKey.set(socket, limiterKey)



    // of this socket to avoid host-flapping mid-game.
    const sessionUserId = resolveSessionUserIdFromUpgrade(req)
    if (sessionUserId.length > 0) {
      socketSessionUserId.set(socket, sessionUserId)
    }
    // Audit R3: also resolve the Prisma `User.id` (different identity namespace
    // from the session JWT `id` for OAuth users) so Eat First host authority can
    // compare `peer.prismaUserId === room.ownerUserId` without falling back to
    // "first peer wins". Stored as a Promise so `handleJoinRoom` can await it
    // race-free — by the time `join-room` is dispatched, the lookup has
    // typically already completed.
    const upgradeSession = readUpgradeSession(req)
    if (upgradeSession) {
      const prismaUserIdPromise = resolvePrismaUserIdFromSession(upgradeSession)
        .then((prismaUserId) =>
          typeof prismaUserId === 'string' && prismaUserId.length > 0 ? prismaUserId : '',
        )
        .catch((err: unknown) => {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[signaling] resolvePrismaUserIdFromSession failed at upgrade', err)
          }
          return ''
        })
      socketSessionPrismaUserId.set(socket, prismaUserIdPromise)
    }

    const onDisconnect = (): void => {
      // Audit R1: drop per-socket limiter buckets eagerly so disconnected
      // sockets don't keep keys alive until the next reap interval.
      const key = socketLimiterKey.get(socket)
      if (key) {
        wsDefaultLimiter.reset(`def:${key}`)
        wsSnapshotLimiter.reset(`snap:${key}`)
        wsAudioMixLimiter.reset(`amix:${key}`)
        wsSettingsLimiter.reset(`set:${key}`)
        wsEatMutateLimiter.reset(`eat:${key}`)
        wsNoticeLimiter.reset(`notice:${key}`)
        socketLimiterKey.delete(socket)
      }
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

        // Audit R1: per-socket rate limit. Liveness frames bypass; everything
        // else flows through the default limiter, then a stricter category
        // limiter for expensive message types. Drop denied messages before the
        // dispatch switch — do not close the socket.
        if (!WS_LIMIT_BYPASS_TYPES.has(messageType)) {
          const key = socketLimiterKey.get(socket)
          if (key !== undefined) {
            const def = wsDefaultLimiter.tryConsume(`def:${key}`)
            let categoryAllowed = true
            if (def.allowed) {
              if (WS_SNAPSHOT_TYPES.has(messageType)) {
                categoryAllowed = wsSnapshotLimiter.tryConsume(`snap:${key}`).allowed
              } else if (WS_AUDIO_MIX_TYPES.has(messageType)) {
                categoryAllowed = wsAudioMixLimiter.tryConsume(`amix:${key}`).allowed
              } else if (WS_SETTINGS_TYPES.has(messageType)) {
                categoryAllowed = wsSettingsLimiter.tryConsume(`set:${key}`).allowed
              } else if (WS_EAT_MUTATE_TYPES.has(messageType)) {
                categoryAllowed = wsEatMutateLimiter.tryConsume(`eat:${key}`).allowed
              }
            }
            if (!def.allowed || !categoryAllowed) {
              if (wsNoticeLimiter.tryConsume(`notice:${key}`).allowed) {
                try {
                  if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({
                      type: 'rate-limited',
                      payload: {},
                    }))
                  }
                } catch {
                  /* socket may have closed mid-send */
                }
              }
              return
            }
          }
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
              try {
                await handleJoinRoom(socket, roomId, peerId, displayName, avatarUrl, userId, deps)
              } catch (err) {





                console.error('[signaling] join-room failed', {
                  roomId,
                  peerId,
                  err: err instanceof Error ? err.message : String(err),
                })
                try {
                  recordDiagnosticEvent({
                    id: newDiagnosticEventId(),
                    reportVersion: 1,
                    timestamp: Date.now(),
                    source: 'server',
                    level: 'error',
                    area: 'backend',
                    type: 'backend_handler_error',
                    roomId: typeof roomId === 'string' ? roomId : null,
                    gameType: null,
                    peerId: typeof peerId === 'string' ? peerId : null,
                    userId: null,
                    sessionId: null,
                    correlationId: null,
                    message: err instanceof Error
                      ? `join-room: ${err.name}: ${err.message || ''}`.trim()
                      : 'join-room failed',
                    context: { handler: 'join-room' },
                    error: err instanceof Error
                      ? {
                          name: err.name,
                          ...(err.stack ? { stack: err.stack } : {}),
                        }
                      : undefined,
                  })
                } catch {
                  /* never throw from diagnostics */
                }
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
            case 'set-camera-mirror': {
              const { mirrored } = parsed.data.payload
              handleSetCameraMirror(socket, mirrored, deps)
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
              await handleMafiaReshuffle(socket, parsed.data.payload, deps)
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
            case 'mafia:timer-preset-select': {
              handleMafiaTimerPresetSelect(socket, parsed.data.payload, deps)
              break
            }
            case 'mafia:player-kick': {
              await handleMafiaPlayerKick(socket, parsed.data.payload, deps)
              break
            }
            case 'mafia:player-revive': {
              await handleMafiaPlayerRevive(socket, parsed.data.payload, deps)
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
            case 'mafia:request-snapshot': {
              handleMafiaRequestSnapshot(socket, deps)
              break
            }
            // Generic game-room (Phase 3A) — parallel of the Mafia arms above.
            // Mafia arms are unmodified.
            case 'gameroom:claim-host': {
              handleGameRoomClaimHost(socket, parsed.data.payload, deps)
              break
            }
            case 'gameroom:transfer-host': {
              handleGameRoomTransferHost(socket, parsed.data.payload, deps)
              break
            }
            case 'gameroom:queue-update': {
              handleGameRoomQueueUpdate(socket, parsed.data.payload, deps)
              break
            }
            case 'gameroom:reshuffle': {
              await handleGameRoomReshuffle(socket, parsed.data.payload, deps)
              break
            }
            case 'gameroom:players-update': {
              handleGameRoomPlayersUpdate(socket, parsed.data.payload, deps)
              break
            }
            case 'gameroom:player-name-update': {
              handleGameRoomPlayerNameUpdate(socket, parsed.data.payload, deps)
              break
            }
            case 'gameroom:audio-mix-update': {
              handleGameRoomAudioMixUpdate(socket, parsed.data.payload, deps)
              break
            }
            case 'gameroom:timer-start': {
              handleGameRoomTimerStart(socket, parsed.data.payload, deps)
              break
            }
            case 'gameroom:timer-stop': {
              handleGameRoomTimerStop(socket, deps)
              break
            }
            case 'gameroom:timer-preset-select': {
              handleGameRoomTimerPresetSelect(socket, parsed.data.payload, deps)
              break
            }
            case 'gameroom:player-kick': {
              await handleGameRoomPlayerKick(socket, parsed.data.payload, deps)
              break
            }
            case 'gameroom:player-revive': {
              await handleGameRoomPlayerRevive(socket, parsed.data.payload, deps)
              break
            }
            case 'gameroom:force-camera-off': {
              await handleGameRoomForceCameraOff(socket, parsed.data.payload, deps)
              break
            }
            case 'gameroom:force-mute-all': {
              await handleGameRoomForceMuteAll(socket, parsed.data.payload, deps)
              break
            }
            case 'gameroom:request-snapshot': {
              handleGameRoomRequestSnapshot(socket, deps)
              break
            }
            case 'eat:force-mute-all': {
              await handleEatFirstForceMuteAll(socket, parsed.data.payload, deps)
              break
            }
            case 'eat:audio-mix-update': {
              handleEatFirstAudioMixUpdate(socket, parsed.data.payload, deps)
              break
            }
            case 'eat:page-background-settings': {
              handleEatFirstPageBackgroundSettings(socket, parsed.data.payload, deps)
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
              await handleEatFirstTraitRegenerateRequest(socket, parsed.data.payload, deps)
              break
            }
            case 'eat:trait-type-reroll-request': {
              await handleEatFirstTraitTypeRerollRequest(socket, parsed.data.payload, deps)
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
            case 'eat:timer-preset-select': {
              await handleEatFirstTimerPresetSelect(socket, parsed.data.payload, deps)
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
