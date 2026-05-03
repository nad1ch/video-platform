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

/* safeSend is now `safeSendJson` from `../utils/wsSafeSend` (imported above). */

export function attachEatFirstSocketServer(wss: WebSocketServer): void {
  // WS-level ping-frame heartbeat so half-open TCP clients are reaped and do
  // not keep accumulating in `subs` forever. EatFirst has no separate JSON
  // keep-alive; the WS ping is enough because EatFirst WS traffic is already
  // chatty enough (state broadcasts) for proxies to see activity.
  attachWsHeartbeat(wss, { logLabel: 'eat-first-ws' })

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
