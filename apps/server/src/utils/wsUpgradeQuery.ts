import type { IncomingMessage } from 'node:http'

/**
 * Parse the HTTP-upgrade request URL into query parameters. Safe against
 * malformed URLs — returns `null` values instead of throwing.
 *
 * Both the Nadle and Nadraw WebSocket servers used byte-identical copies
 * of `parseStreamerId` / `parseOptionalPeerId`. They now share this module.
 * Behavior is preserved: the same trim + length bounds + try/catch wrapper.
 */

function parseUrl(req: IncomingMessage): URL | null {
  try {
    const host = req.headers.host ?? 'localhost'
    return new URL(req.url ?? '/', `http://${host}`)
  } catch {
    return null
  }
}

/**
 * `?streamerId=` — required on `/nadle-ws` and `/nadraw-show-ws`. Returns
 * the trimmed value when it is at least 4 characters, otherwise `null`.
 */
export function parseStreamerIdFromUpgrade(req: IncomingMessage): string | null {
  const u = parseUrl(req)
  if (!u) return null
  const id = u.searchParams.get('streamerId')
  if (typeof id !== 'string' || id.trim().length < 4) {
    return null
  }
  return id.trim()
}

/**
 * Optional client-tab id for debug logs. Each tab is expected to send a
 * unique value. Bounds mirror the original implementation.
 */
export function parseOptionalPeerIdFromUpgrade(req: IncomingMessage): string | null {
  const u = parseUrl(req)
  if (!u) return null
  const raw = u.searchParams.get('peerId')
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  if (t.length < 4 || t.length > 200) return null
  return t
}
