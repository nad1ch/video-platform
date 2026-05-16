import type { WebSocket } from 'ws'
import type { WebSocketServer } from 'ws'
import { prisma } from '../prisma'
import { attachWsHeartbeat } from '../utils/wsHeartbeat'
import { safeSendJson as safeSend } from '../utils/wsSafeSend'
import { eatFirstSnapshot } from './snapshot'

const subs = new Map<string, Set<WebSocket>>()

function removeSubscription(gameId: string, ws: WebSocket): void {
  const set = subs.get(gameId)
  if (!set) {
    return
  }
  set.delete(ws)
  if (set.size === 0) {
    subs.delete(gameId)
  }
}



export function attachEatFirstSocketServer(wss: WebSocketServer): void {
  
  
  
  
  attachWsHeartbeat(wss, { logLabel: 'eat-first-ws' })

  wss.on('connection', (ws) => {
    let subscribedId: string | null = null
    /**
     * Per-socket rolling-window subscribe limiter. Each subscribe runs a DB
     * snapshot read, so a spammy client could amplify DB load across all
     * subscribers of the same gameId. Normal clients send one subscribe on
     * mount and at most one re-subscribe on gameId change — 2 per second is
     * generous. Reconnects use a fresh socket and therefore a fresh counter.
     */
    const SUBSCRIBE_WINDOW_MS = 1000
    const SUBSCRIBE_LIMIT_PER_WINDOW = 2
    let subscribeWindowStart = 0
    let subscribeCount = 0
    ws.on('message', (raw) => {
      void (async () => {
        try {
          const msg = JSON.parse(String(raw)) as { type?: string; gameId?: string }
          if (msg.type === 'subscribe' && typeof msg.gameId === 'string') {
            const gameId = msg.gameId.trim().slice(0, 80)
            if (!gameId) {
              return
            }
            const now = Date.now()
            if (now - subscribeWindowStart >= SUBSCRIBE_WINDOW_MS) {
              subscribeWindowStart = now
              subscribeCount = 0
            }
            subscribeCount += 1
            if (subscribeCount > SUBSCRIBE_LIMIT_PER_WINDOW) {
              return
            }
            if (subscribedId && subscribedId !== gameId) {
              removeSubscription(subscribedId, ws)
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
      removeSubscription(subscribedId, ws)
    })
  })
}

/**
 * Coalesce repeated broadcast requests for the same gameId inside a single
 * synchronous call batch. Many service-layer code paths triggered 2-3
 * `broadcast(gameId)` calls per request (`ensureGame` → mutate → broadcast);
 * each previously ran a full `eatFirstSnapshot` DB read + fan-out. With the
 * microtask flush, the snapshot is read once per burst and subscribers
 * always converge on the latest state.
 */
const pendingBroadcasts = new Set<string>()

function flushBroadcast(gameId: string): void {
  eatFirstSnapshot(prisma, gameId)
    .then((snap) => {
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
    .catch((err) => {
      console.error('[eat-first-ws] flushBroadcast failed', {
        gameId,
        err: err instanceof Error ? err.message : String(err),
      })
    })
}

export function broadcastEatFirstUpdate(gameId: string): void {
  if (pendingBroadcasts.has(gameId)) {
    return
  }
  pendingBroadcasts.add(gameId)
  queueMicrotask(() => {
    pendingBroadcasts.delete(gameId)
    flushBroadcast(gameId)
  })
}
