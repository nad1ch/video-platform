import type { IncomingMessage } from 'node:http'
import type { WebSocket } from 'ws'
import type { WebSocketServer } from 'ws'
import { isAdminConfigured, isAdminTwitchUserId } from './adminConfig'
import {
  adminStartNewGame,
  getGameStatePayload,
  getLeaderboardPayload,
  submitGuess,
} from './gameStore'
import { readSessionFromCookie } from './sessionJwt'
import { clearTwitchGuessThrottle } from './tmiGuessThrottle'
import { WordleWs } from './wsProtocol'

const clients = new Set<WebSocket>()

function safeSend(ws: WebSocket, obj: unknown): void {
  if (ws.readyState !== 1) {
    return
  }
  ws.send(JSON.stringify(obj))
}

export function broadcastWordle(obj: unknown): void {
  const raw = JSON.stringify(obj)
  for (const ws of clients) {
    if (ws.readyState === 1) {
      ws.send(raw)
    }
  }
}

function pushLeaderboard(): void {
  broadcastWordle({ type: WordleWs.leaderboard, payload: getLeaderboardPayload() })
}

export function broadcastGameState(): void {
  broadcastWordle({ type: WordleWs.state, payload: getGameStatePayload() })
}

export function broadcastUserGuess(payload: Record<string, unknown>): void {
  broadcastWordle({ type: WordleWs.userGuess, payload })
  broadcastGameState()
  pushLeaderboard()
}

export function broadcastNewRound(meta: {
  gameId: string
  wordLength: number
  startedAt: number
}): void {
  clearTwitchGuessThrottle()
  broadcastWordle({ type: WordleWs.newGame, payload: meta })
  broadcastGameState()
  pushLeaderboard()
}

export function broadcastTwitchChatLine(payload: {
  userId: string
  displayName: string
  text: string
  validGuess: boolean
  rateLimited?: boolean
}): void {
  broadcastWordle({ type: WordleWs.twitchChat, payload })
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

export function attachWordleSocketServer(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    clients.add(ws)
    const session = readSessionFromCookie(req.headers.cookie)

    safeSend(ws, { type: WordleWs.state, payload: getGameStatePayload() })
    safeSend(ws, { type: WordleWs.leaderboard, payload: getLeaderboardPayload() })
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
        const result = submitGuess(session.id, session.display_name, msg.word, msg.gameId)
        if (!result.ok) {
          safeSend(ws, { type: WordleWs.guessRejected, payload: { reason: result.reason } })
          return
        }
        broadcastUserGuess({
          gameId: result.gameId,
          userId: result.userId,
          displayName: result.displayName,
          guess: result.guess,
          feedback: result.feedback,
          attempts: result.attempts,
          guessed: result.guessed,
        })
        return
      }

      if (msg.type === WordleWs.clientNextWord) {
        if (!session || !isAdminTwitchUserId(session.id)) {
          safeSend(ws, { type: WordleWs.error, payload: { code: 'forbidden', message: 'Admin only' } })
          return
        }
        const meta = adminStartNewGame()
        broadcastNewRound(meta)
      }
    })

    ws.on('close', () => {
      clients.delete(ws)
    })
  })
}
