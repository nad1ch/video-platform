import type { WebSocket } from 'ws'

/**
 * Send a JSON-serializable object over a WebSocket, silently no-opping when
 * the socket is not OPEN and swallowing `send` errors (the caller usually
 * does not have a retry loop and a single throw should not take down a
 * broadcast iteration).
 *
 * This replaces four byte-identical copies of the same helper across the
 * game WebSocket servers. Behavior is unchanged.
 */
export function safeSendJson(ws: WebSocket, obj: unknown): void {
  if (ws.readyState !== 1) {
    return
  }
  try {
    ws.send(JSON.stringify(obj))
  } catch {
    /* ignore */
  }
}
