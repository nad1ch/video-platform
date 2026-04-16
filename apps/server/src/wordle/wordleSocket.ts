import type { IncomingMessage } from 'node:http'
import type { WebSocket } from 'ws'
import type { WebSocketServer } from 'ws'
import { isAdminConfigured, isAdminTwitchUserId } from './adminConfig'
import {
  adminStartNewGame,
  buildWordleRoundPersistencePayload,
  getGameStatePayload,
  getLeaderboardPayload,
  submitGuess,
} from './gameStore'
import { persistWordleRound } from './persistRound'
import { readSessionFromCookie } from './sessionJwt'
import { clearTwitchGuessThrottleForStreamer } from './tmiGuessThrottle'
import { WordleWs } from './wsProtocol'

const clientsByStreamer = new Map<string, Set<WebSocket>>()

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
  ws.send(JSON.stringify(obj))
}

function broadcastWordleToStreamer(streamerId: string, obj: unknown): void {
  const set = clientsByStreamer.get(streamerId)
  if (!set) {
    return
  }
  const raw = JSON.stringify(obj)
  for (const ws of set) {
    if (ws.readyState === 1) {
      ws.send(raw)
    }
  }
}

function pushLeaderboard(streamerId: string): void {
  broadcastWordleToStreamer(streamerId, { type: WordleWs.leaderboard, payload: getLeaderboardPayload(streamerId) })
}

export function broadcastGameState(streamerId: string): void {
  broadcastWordleToStreamer(streamerId, { type: WordleWs.state, payload: getGameStatePayload(streamerId) })
}

export function broadcastUserGuess(streamerId: string, payload: Record<string, unknown>): void {
  broadcastWordleToStreamer(streamerId, { type: WordleWs.userGuess, payload })
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
  broadcastWordleToStreamer(streamerId, { type: WordleWs.newGame, payload: meta })
  broadcastGameState(streamerId)
  pushLeaderboard(streamerId)
}

export function broadcastWordleIrcStatus(
  streamerId: string,
  payload: {
    status: 'connected' | 'disconnected' | 'reconnecting' | 'connecting' | 'error'
    reason?: string
  },
): void {
  broadcastWordleToStreamer(streamerId, { type: WordleWs.ircStatus, payload })
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
  broadcastWordleToStreamer(streamerId, { type: WordleWs.twitchChat, payload })
}

type ClientMsg =
  | { type: typeof WordleWs.clientGuess; word: string; gameId?: string }
  | { type: typeof WordleWs.clientNextWord }

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
  if (o.type === WordleWs.clientGuess && typeof o.word === 'string') {
    return {
      type: WordleWs.clientGuess,
      word: o.word,
      gameId: typeof o.gameId === 'string' ? o.gameId : undefined,
    }
  }
  if (o.type === WordleWs.clientNextWord) {
    return { type: WordleWs.clientNextWord }
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

export function attachWordleSocketServer(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const streamerId = parseStreamerId(req)
    if (!streamerId) {
      safeSend(ws, {
        type: WordleWs.error,
        payload: { code: 'bad_request', message: 'Missing streamerId (use /wordle-ws?streamerId=…)' },
      })
      ws.close(4400, 'missing streamerId')
      return
    }

    const tabPeerId = parseOptionalPeerId(req)
    if (process.env.NODE_ENV !== 'production' && tabPeerId) {
      console.log('[wordle-ws] client tab', { streamerId, peerId: tabPeerId.slice(0, 12) })
    }

    registerClient(streamerId, ws)
    const session = readSessionFromCookie(req.headers.cookie)

    safeSend(ws, { type: WordleWs.state, payload: getGameStatePayload(streamerId) })
    safeSend(ws, { type: WordleWs.leaderboard, payload: getLeaderboardPayload(streamerId) })
    safeSend(ws, {
      type: WordleWs.session,
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
      const msg = parseClientMsg(buf.toString())
      if (!msg) {
        return
      }

      if (msg.type === WordleWs.clientGuess) {
        if (!session) {
          safeSend(ws, {
            type: WordleWs.error,
            payload: { code: 'auth_required', message: 'Login to submit from web' },
          })
          return
        }
        const result = submitGuess(streamerId, session.id, session.display_name, msg.word, msg.gameId)
        if (!result.ok) {
          safeSend(ws, { type: WordleWs.guessRejected, payload: { reason: result.reason } })
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
          const payload = buildWordleRoundPersistencePayload(streamerId, result.userId)
          if (payload) {
            void persistWordleRound(payload)
          }
        }
        return
      }

      if (msg.type === WordleWs.clientNextWord) {
        if (!session || !isAdminTwitchUserId(session.id)) {
          safeSend(ws, { type: WordleWs.error, payload: { code: 'forbidden', message: 'Admin only' } })
          return
        }
        const meta = adminStartNewGame(streamerId)
        broadcastNewRound(streamerId, meta)
      }
    })

    ws.on('close', () => {
      unregisterClient(streamerId, ws)
    })
  })
}
