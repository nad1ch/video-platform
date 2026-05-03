import type { IncomingMessage } from 'node:http'
import type { WebSocket } from 'ws'
import type { WebSocketServer } from 'ws'
import { isAdminConfigured, isAdminTwitchUserId } from './adminConfig'
import {
  buildNadleRoundPersistencePayload,
  getGameStatePayload,
  getLeaderboardPayload,
  hydrateNadleLiveGame,
  startPlayerNewGame,
  submitGuess,
} from './gameStore'
import { persistNadleRound } from './persistRound'
import { readSessionFromCookie, type SessionPayload } from '../auth/session/sessionJwt'
import { resolveUserRole } from '../auth/resolveUserRole'
import { attachWsHeartbeat } from '../utils/wsHeartbeat'
import { safeSendJson as safeSend } from '../utils/wsSafeSend'
import {
  parseOptionalPeerIdFromUpgrade,
  parseStreamerIdFromUpgrade,
} from '../utils/wsUpgradeQuery'
import { clearTwitchGuessThrottleForStreamer } from './tmiGuessThrottle'
import { NadleWs } from './wsProtocol'
import { normalizeWordLength, type NadleWordLength } from './nadleLogic'

const clientsByStreamer = new Map<string, Set<WebSocket>>()
const clientSessionBySocket = new WeakMap<WebSocket, { id: string; displayName: string; canSeeSecret: boolean }>()

/**
 * Re-evaluate admin eligibility from the server-side env allowlist at WS
 * connect time. Previously this checked `session.role === 'admin'` from the
 * JWT — that claim was stamped once at sign time, so removing an operator
 * from `ADMIN_EMAILS` / `ADMIN_TWITCH_IDS` did not revoke their Nadle
 * "see the secret word" privilege until their JWT expired (up to 7 days).
 * `resolveUserRole` reads env fresh on every call.
 */
function canSessionControlNadle(session: SessionPayload | null): boolean {
  if (!session) return false
  if (isAdminTwitchUserId(session.id)) return true
  const twitchId =
    session.provider === 'twitch'
      ? typeof session.twitch_id === 'string' && session.twitch_id.length > 0
        ? session.twitch_id
        : session.id
      : undefined
  return (
    resolveUserRole({
      provider: session.provider,
      id: session.id,
      email: session.email,
      twitchId,
    }) === 'admin'
  )
}

/** JSON ping so nginx / proxies do not close idle upstream WebSockets. */
const NADLE_JSON_PING_MS = 25_000
let nadleJsonPingTimer: ReturnType<typeof setInterval> | null = null

function pingAllNadleClients(): void {
  for (const set of clientsByStreamer.values()) {
    for (const ws of set) {
      safeSend(ws, { type: 'ping' })
    }
  }
}

function ensureNadleJsonPingTimer(wss: WebSocketServer): void {
  if (nadleJsonPingTimer !== null) {
    return
  }
  nadleJsonPingTimer = setInterval(pingAllNadleClients, NADLE_JSON_PING_MS)
  if (typeof nadleJsonPingTimer.unref === 'function') {
    nadleJsonPingTimer.unref()
  }
  
  
  wss.on('close', () => {
    if (nadleJsonPingTimer !== null) {
      clearInterval(nadleJsonPingTimer)
      nadleJsonPingTimer = null
    }
  })
}

function clientSet(streamerId: string): Set<WebSocket> {
  let set = clientsByStreamer.get(streamerId)
  if (!set) {
    set = new Set()
    clientsByStreamer.set(streamerId, set)
  }
  return set
}

function registerClient(streamerId: string, ws: WebSocket): void {
  clientSet(streamerId).add(ws)
}

function unregisterClient(streamerId: string, ws: WebSocket): void {
  const set = clientsByStreamer.get(streamerId)
  if (!set) {
    return
  }
  set.delete(ws)
  if (set.size === 0) {
    clientsByStreamer.delete(streamerId)
  }
}



function broadcastNadleToStreamer(streamerId: string, obj: unknown): void {
  const set = clientsByStreamer.get(streamerId)
  if (!set) {
    return
  }
  const raw = JSON.stringify(obj)
  for (const ws of set) {
    if (ws.readyState !== 1) {
      continue
    }
    try {
      ws.send(raw)
    } catch {
      /* ignore */
    }
  }
}

function pushLeaderboard(streamerId: string): void {
  broadcastNadleToStreamer(streamerId, { type: NadleWs.leaderboard, payload: getLeaderboardPayload(streamerId) })
}

export function broadcastGameState(streamerId: string): void {
  const set = clientsByStreamer.get(streamerId)
  if (!set) {
    return
  }
  for (const ws of set) {
    const session = clientSessionBySocket.get(ws)
    safeSend(ws, {
      type: NadleWs.state,
      payload: getGameStatePayload(
        streamerId,
        session
          ? { userId: session.id, displayName: session.displayName, canSeeSecret: session.canSeeSecret }
          : undefined,
      ),
    })
  }
}

export function broadcastUserGuess(streamerId: string, payload: Record<string, unknown>): void {
  broadcastNadleToStreamer(streamerId, { type: NadleWs.userGuess, payload })
  broadcastGameState(streamerId)
  pushLeaderboard(streamerId)
}

export function broadcastNewRound(
  streamerId: string,
  meta: {
    gameId: string
    wordLength: number
    startedAt: number
  },
): void {
  clearTwitchGuessThrottleForStreamer(streamerId)
  broadcastNadleToStreamer(streamerId, { type: NadleWs.newGame, payload: meta })
  broadcastGameState(streamerId)
  pushLeaderboard(streamerId)
}

export function broadcastNadleIrcStatus(
  streamerId: string,
  payload: {
    status: 'connected' | 'disconnected' | 'reconnecting' | 'connecting' | 'error'
    reason?: string
  },
): void {
  broadcastNadleToStreamer(streamerId, { type: NadleWs.ircStatus, payload })
}

export function broadcastTwitchChatLine(
  streamerId: string,
  payload: {
    userId: string
    displayName: string
    text: string
    validGuess: boolean
    rateLimited?: boolean
    cooldownMs?: number
    guessFeedback?: Array<'correct' | 'present' | 'absent'>
  },
): void {
  broadcastNadleToStreamer(streamerId, { type: NadleWs.twitchChat, payload })
}

type ClientMsg =
  | { type: typeof NadleWs.clientGuess; word: string; gameId?: string }
  | { type: typeof NadleWs.clientNextWord; wordLength?: NadleWordLength }

function parseClientMsg(raw: string): ClientMsg | null {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') {
    return null
  }
  const o = data as { type?: string; word?: unknown; gameId?: unknown; wordLength?: unknown }
  if (o.type === NadleWs.clientGuess && typeof o.word === 'string') {
    return {
      type: NadleWs.clientGuess,
      word: o.word,
      gameId: typeof o.gameId === 'string' ? o.gameId : undefined,
    }
  }
  if (o.type === NadleWs.clientNextWord) {
    return { type: NadleWs.clientNextWord, wordLength: normalizeWordLength(o.wordLength) }
  }
  return null
}




export function attachNadleSocketServer(wss: WebSocketServer): void {
  ensureNadleJsonPingTimer(wss)
  
  
  attachWsHeartbeat(wss, { logLabel: 'nadle-ws' })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const streamerId = parseStreamerIdFromUpgrade(req)
    if (!streamerId) {
      safeSend(ws, {
        type: NadleWs.error,
        payload: { code: 'bad_request', message: 'Missing streamerId (use /nadle-ws?streamerId=…)' },
      })
      ws.close(4400, 'missing streamerId')
      return
    }

    const tabPeerId = parseOptionalPeerIdFromUpgrade(req)
    if (process.env.NODE_ENV !== 'production' && tabPeerId) {
      console.log('[nadle-ws] client tab', { streamerId, peerId: tabPeerId.slice(0, 12) })
    }

    const session = readSessionFromCookie(req.headers.cookie)

    void (async () => {
      await hydrateNadleLiveGame(streamerId)
      registerClient(streamerId, ws)
      const sessionCanSeeSecret = canSessionControlNadle(session)
      if (session) {
        clientSessionBySocket.set(ws, {
          id: session.id,
          displayName: session.display_name,
          canSeeSecret: sessionCanSeeSecret,
        })
      }

      safeSend(ws, {
        type: NadleWs.state,
        payload: getGameStatePayload(
          streamerId,
          session
            ? { userId: session.id, displayName: session.display_name, canSeeSecret: sessionCanSeeSecret }
            : undefined,
        ),
      })
      safeSend(ws, { type: NadleWs.leaderboard, payload: getLeaderboardPayload(streamerId) })
      safeSend(ws, {
        type: NadleWs.session,
        payload: {
          user: session
            ? {
                id: session.id,
                display_name: session.display_name,
                profile_image_url: session.profile_image_url,
              }
            : null,
          isAdmin: sessionCanSeeSecret,
          adminRouteConfigured: isAdminConfigured(),
        },
      })
    })()

    ws.on('message', (buf) => {
      const raw = buf.toString()
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        return
      }
      if (parsed && typeof parsed === 'object' && (parsed as { type?: unknown }).type === 'pong') {
        return
      }

      const msg = parseClientMsg(raw)
      if (!msg) {
        return
      }

      void (async () => {
        
        
        
        // effectively free — but awaiting here closes the pre-hydration race
        
        
        await hydrateNadleLiveGame(streamerId)

        if (msg.type === NadleWs.clientGuess) {
          if (!session) {
            safeSend(ws, {
              type: NadleWs.error,
              payload: { code: 'auth_required', message: 'Login to submit from web' },
            })
            return
          }
          const result = submitGuess(streamerId, session.id, session.display_name, msg.word, msg.gameId)
          if (!result.ok) {
            safeSend(ws, { type: NadleWs.guessRejected, payload: { reason: result.reason } })
            return
          }
          broadcastUserGuess(streamerId, {
            gameId: result.gameId,
            userId: result.userId,
            displayName: result.displayName,
            guess: result.guess,
            feedback: result.feedback,
            word: result.guess,
            result: result.feedback,
            attempts: result.attempts,
            guessed: result.guessed,
          })
          if (result.guessed) {
            const payload = buildNadleRoundPersistencePayload(streamerId, result.userId)
            if (payload) {
              void persistNadleRound(payload)
            }
          }
          return
        }

        if (msg.type === NadleWs.clientNextWord) {
          if (!session) {
            safeSend(ws, { type: NadleWs.error, payload: { code: 'auth_required', message: 'Login to start a new word' } })
            return
          }
          const meta = startPlayerNewGame(streamerId, session.id, session.display_name, msg.wordLength)
          clearTwitchGuessThrottleForStreamer(streamerId)
          safeSend(ws, { type: NadleWs.newGame, payload: meta })
          safeSend(ws, {
            type: NadleWs.state,
            payload: getGameStatePayload(streamerId, {
              userId: session.id,
              displayName: session.display_name,
              canSeeSecret: canSessionControlNadle(session),
            }),
          })
          pushLeaderboard(streamerId)
        }
      })()
    })

    ws.on('error', () => {
      unregisterClient(streamerId, ws)
    })

    ws.on('close', () => {
      unregisterClient(streamerId, ws)
    })
  })
}
