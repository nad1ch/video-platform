import WebSocket from 'ws'
import type { WebSocket as WsType, WebSocketServer } from 'ws'

/**
 * Shared WebSocket heartbeat / dead-client reaper for game sockets.
 *
 * Modeled on the inline implementation in `signaling/socketServer.ts`: every
 * new connection is marked `isAlive = true`; on each tick the server sets
 * `isAlive = false` and sends a WS `ping` frame. If the client did not answer
 * (`'pong'`) before the NEXT tick, `isAlive` stayed `false` and we
 * `terminate()` the socket. The corresponding `'close'` listener then runs
 * the socket's normal cleanup path.
 *
 * This is distinct from any app-level JSON ping: WS ping-frames cannot be
 * used by reverse proxies as application evidence of liveness, so game
 * sockets typically keep their existing JSON ping intervals. This helper
 * only reaps actually-dead TCP connections — JSON ping stays the nginx
 * keep-alive for background tabs.
 *
 * Safety:
 *   - Interval `.unref()`ed so it never keeps the process alive.
 *   - Interval cleared on `wss.close` (prevents module-scoped timer leaks
 *     when the server is shut down or hot-reloaded).
 *   - Returns a `stop()` function for tests / manual teardown.
 */

const DEFAULT_HEARTBEAT_MS = 45_000

type WsWithAlive = WsType & { isAlive?: boolean }

export type WsHeartbeatOptions = {
  /** Interval between WS ping frames. Default 45s (matches signaling). */
  intervalMs?: number
  
  logLabel?: string
}

export type WsHeartbeatHandle = {
  
  stop(): void
}

export function attachWsHeartbeat(
  wss: WebSocketServer,
  options: WsHeartbeatOptions = {},
): WsHeartbeatHandle {
  const intervalMs =
    typeof options.intervalMs === 'number' && options.intervalMs >= 1000
      ? options.intervalMs
      : DEFAULT_HEARTBEAT_MS
  const logLabel = typeof options.logLabel === 'string' ? options.logLabel : 'ws-heartbeat'

  const onConnection = (socket: WebSocket): void => {
    const ext = socket as WsWithAlive
    ext.isAlive = true
    socket.on('pong', () => {
      ext.isAlive = true
    })
  }

  
  
  
  for (const socket of wss.clients) {
    onConnection(socket as WebSocket)
  }

  wss.on('connection', onConnection)

  const timer = setInterval(() => {
    for (const socket of wss.clients) {
      const s = socket as WsWithAlive
      if (s.readyState !== WebSocket.OPEN) {
        continue
      }
      if (s.isAlive === false) {
        if (process.env.NODE_ENV !== 'production') {
          // No detailed identity here — the socket's own `'close'` handler
          // (registered by the game socket) logs the specific subscription
          
          console.warn(`[${logLabel}] terminating unresponsive socket`)
        }
        s.terminate()
        continue
      }
      s.isAlive = false
      try {
        s.ping()
      } catch {
        /* socket died mid-loop; next tick will terminate */
      }
    }
  }, intervalMs)

  if (typeof timer.unref === 'function') {
    timer.unref()
  }

  const onServerClose = (): void => {
    clearInterval(timer)
    wss.off('connection', onConnection)
    wss.off('close', onServerClose)
  }
  wss.on('close', onServerClose)

  return {
    stop(): void {
      onServerClose()
    },
  }
}
