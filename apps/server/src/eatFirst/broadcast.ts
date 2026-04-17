import type { WebSocket } from 'ws'
import type { WebSocketServer } from 'ws'
import { prisma } from '../prisma'
import { eatFirstSnapshot } from './snapshot'

const subs = new Map<string, Set<WebSocket>>()

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

export function attachEatFirstSocketServer(wss: WebSocketServer): void {
  wss.on('connection', (ws) => {
    let subscribedId: string | null = null
    ws.on('message', (raw) => {
      void (async () => {
        try {
          const msg = JSON.parse(String(raw)) as { type?: string; gameId?: string }
          if (msg.type === 'subscribe' && typeof msg.gameId === 'string') {
            const gameId = msg.gameId.trim().slice(0, 80)
            if (!gameId) {
              return
            }
            subscribedId = gameId
            let set = subs.get(gameId)
            if (!set) {
              set = new Set()
              subs.set(gameId, set)
            }
            set.add(ws)
            const snap = await eatFirstSnapshot(prisma, gameId)
            safeSend(ws, { type: 'eat-first:init', gameId, ...snap })
          }
        } catch {
          /* ignore malformed */
        }
      })()
    })
    ws.on('close', () => {
      if (!subscribedId) {
        return
      }
      const set = subs.get(subscribedId)
      if (!set) {
        return
      }
      set.delete(ws)
      if (set.size === 0) {
        subs.delete(subscribedId)
      }
    })
  })
}

export function broadcastEatFirstUpdate(gameId: string): void {
  void eatFirstSnapshot(prisma, gameId).then((snap) => {
    const payload = { type: 'eat-first:update' as const, gameId, ...snap }
    const msg = JSON.stringify(payload)
    const set = subs.get(gameId)
    if (!set) {
      return
    }
    for (const ws of set) {
      if (ws.readyState === 1) {
        try {
          ws.send(msg)
        } catch {
          /* ignore */
        }
      }
    }
  })
}
