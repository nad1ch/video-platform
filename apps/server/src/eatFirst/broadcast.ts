import type { IncomingMessage } from 'http'
import type { WebSocket } from 'ws'
import type { WebSocketServer } from 'ws'
import { prisma } from '../prisma'
import { attachWsHeartbeat } from '../utils/wsHeartbeat'
import { safeSendJson as safeSend } from '../utils/wsSafeSend'
import { eatFirstSnapshot } from './snapshot'
import { resolveEatFirstViewerMode, type EatFirstViewerMode } from './sessionGate'

/**
 * Per-socket subscription metadata. We previously kept only the socket set
 * per gameId, but audit R14 requires fanning out a viewer-mode-correct
 * snapshot — public sockets must not see unrevealed trait values, host
 * sockets get everything. Tracking the mode here lets `flushBroadcast`
 * send the right payload to each socket without re-deriving auth.
 */
type SubscriberInfo = { viewerMode: EatFirstViewerMode }

const subs = new Map<string, Map<WebSocket, SubscriberInfo>>()

function removeSubscription(gameId: string, ws: WebSocket): void {
  const m = subs.get(gameId)
  if (!m) {
    return
  }
  m.delete(ws)
  if (m.size === 0) {
    subs.delete(gameId)
  }
}

export function attachEatFirstSocketServer(wss: WebSocketServer): void {
  attachWsHeartbeat(wss, { logLabel: 'eat-first-ws' })

  wss.on('connection', (ws, req: IncomingMessage) => {
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
    /**
     * Cookie header captured at upgrade time. The HTTP request goes away
     * once the WS handshake completes, so we snapshot the cookies the
     * browser sent and re-use them on every (re-)subscribe to derive the
     * viewer mode (audit R14). The session JWT in the cookie has its own
     * 7-day expiry; if it expires mid-socket, future subscribes silently
     * downgrade to public mode.
     */
    const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined

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
            const viewerMode = await resolveEatFirstViewerMode(cookieHeader, gameId)
            let m = subs.get(gameId)
            if (!m) {
              m = new Map()
              subs.set(gameId, m)
            }
            m.set(ws, { viewerMode })
            const snap = await eatFirstSnapshot(prisma, gameId, viewerMode)
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

async function flushBroadcast(gameId: string): Promise<void> {
  try {
    const m = subs.get(gameId)
    if (!m || m.size === 0) {
      return
    }
    let hasHost = false
    let hasPublic = false
    for (const info of m.values()) {
      if (info.viewerMode === 'host') hasHost = true
      else hasPublic = true
      if (hasHost && hasPublic) break
    }
    const [hostSnap, publicSnap] = await Promise.all([
      hasHost ? eatFirstSnapshot(prisma, gameId, 'host') : null,
      hasPublic ? eatFirstSnapshot(prisma, gameId, 'public') : null,
    ])
    const hostMsg =
      hostSnap ? JSON.stringify({ type: 'eat-first:update', gameId, ...hostSnap }) : null
    const publicMsg =
      publicSnap ? JSON.stringify({ type: 'eat-first:update', gameId, ...publicSnap }) : null
    for (const [ws, info] of m) {
      if (ws.readyState !== 1) continue
      const msg = info.viewerMode === 'host' ? hostMsg : publicMsg
      if (!msg) continue
      try {
        ws.send(msg)
      } catch {
        /* ignore */
      }
    }
  } catch (err) {
    console.error('[eat-first-ws] flushBroadcast failed', {
      gameId,
      err: err instanceof Error ? err.message : String(err),
    })
  }
}

export function broadcastEatFirstUpdate(gameId: string): void {
  if (pendingBroadcasts.has(gameId)) {
    return
  }
  pendingBroadcasts.add(gameId)
  queueMicrotask(() => {
    pendingBroadcasts.delete(gameId)
    void flushBroadcast(gameId)
  })
}
