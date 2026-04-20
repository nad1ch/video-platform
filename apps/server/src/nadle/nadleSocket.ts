import type { IncomingMessage } from 'node:http'
import type { WebSocket } from 'ws'
import type { WebSocketServer } from 'ws'
import { isAdminConfigured, isAdminTwitchUserId } from './adminConfig'
import {
  adminStartNewGame,
  buildNadleRoundPersistencePayload,
  getGameStatePayload,
  getLeaderboardPayload,
  submitGuess,
} from './gameStore'
import { persistNadleRound } from './persistRound'
import { readSessionFromCookie } from './sessionJwt'
import { clearTwitchGuessThrottleForStreamer } from './tmiGuessThrottle'
import { NadleWs } from './wsProtocol'

const clientsByStreamer = new Map<string, Set<WebSocket>>()

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

function ensureNadleJsonPingTimer(): void {
  if (nadleJsonPingTimer !== null) {
    return
  }
  nadleJsonPingTimer = setInterval(pingAllNadleClients, NADLE_JSON_PING_MS)
  if (typeof nadleJsonPingTimer.unref === 'function') {
    nadleJsonPingTimer.unref()
  }
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

function safeSend(ws: WebSocket, obj: unknown): void {
  if (ws.readyState !== 1) {
    return
  }
  try {
    ws.send(JSON.stringify(obj))
  } catch {
    /* ignore */
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
  broadcastNadleToStreamer(streamerId, { type: NadleWs.state, payload: getGameStatePayload(streamerId) })
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
  | { type: typeof NadleWs.clientNextWord }

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
  const o = data as { type?: string; word?: unknown; gameId?: unknown }
  if (o.type === NadleWs.clientGuess && typeof o.word === 'string') {
    return {
      type: NadleWs.clientGuess,
      word: o.word,
      gameId: typeof o.gameId === 'string' ? o.gameId : undefined,
    }
  }
  if (o.type === NadleWs.clientNextWord) {
    return { type: NadleWs.clientNextWord }
  }
  return null
}

function parseStreamerId(req: IncomingMessage): string | null {
  try {
    const host = req.headers.host ?? 'localhost'
    const u = new URL(req.url ?? '/', `http://${host}`)
    const id = u.searchParams.get('streamerId')
    if (typeof id !== 'string' || id.trim().length < 4) {
      return null
    }
    return id.trim()
  } catch {
    return null
  }
}

/** Optional client tab id for logs (each tab should send a unique value). */
function parseOptionalPeerId(req: IncomingMessage): string | null {
  try {
    const host = req.headers.host ?? 'localhost'
    const u = new URL(req.url ?? '/', `http://${host}`)
    const raw = u.searchParams.get('peerId')
    if (typeof raw !== 'string') {
      return null
    }
    const t = raw.trim()
    if (t.length < 4 || t.length > 200) {
      return null
    }
    return t
  } catch {
    return null
  }
}

export function attachNadleSocketServer(wss: WebSocketServer): void {
  ensureNadleJsonPingTimer()

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const streamerId = parseStreamerId(req)
    if (!streamerId) {
      safeSend(ws, {
        type: NadleWs.error,
        payload: { code: 'bad_request', message: 'Missing streamerId (use /nadle-ws?streamerId=…)' },
      })
      ws.close(4400, 'missing streamerId')
      return
    }

    const tabPeerId = parseOptionalPeerId(req)
    if (process.env.NODE_ENV !== 'production' && tabPeerId) {
      console.log('[nadle-ws] client tab', { streamerId, peerId: tabPeerId.slice(0, 12) })
    }

    registerClient(streamerId, ws)
    const session = readSessionFromCookie(req.headers.cookie)

    safeSend(ws, { type: NadleWs.state, payload: getGameStatePayload(streamerId) })
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
        isAdmin: session ? isAdminTwitchUserId(session.id) : false,
        adminRouteConfigured: isAdminConfigured(),
      },
    })

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
        if (!session || !isAdminTwitchUserId(session.id)) {
          safeSend(ws, { type: NadleWs.error, payload: { code: 'forbidden', message: 'Admin only' } })
          return
        }
        const meta = adminStartNewGame(streamerId)
        broadcastNewRound(streamerId, meta)
      }
    })

    ws.on('error', () => {
      unregisterClient(streamerId, ws)
    })

    ws.on('close', () => {
      unregisterClient(streamerId, ws)
    })
  })
}
