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





export function parseStreamerIdFromUpgrade(req: IncomingMessage): string | null {
  const u = parseUrl(req)
  if (!u) return null
  const id = u.searchParams.get('streamerId')
  if (typeof id !== 'string' || id.trim().length < 4) {
    return null
  }
  return id.trim()
}





export function parseOptionalPeerIdFromUpgrade(req: IncomingMessage): string | null {
  const u = parseUrl(req)
  if (!u) return null
  const raw = u.searchParams.get('peerId')
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  if (t.length < 4 || t.length > 200) return null
  return t
}
