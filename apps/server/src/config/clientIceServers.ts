/**
 * ICE servers sent to browsers with each WebRtcTransport (send + recv).
 * Enables TURN relay for symmetric NAT / strict corporate networks.
 *
 * Configure either:
 * - ICE_SERVERS_JSON — JSON array of RTCIceServer objects, or
 * - TURN_URLS + TURN_USERNAME + TURN_CREDENTIAL — comma-separated turn: URLs with static auth.
 *
 * Optional: ICE_TRANSPORT_POLICY=relay — force TURN-only (useful to verify relay path).
 */

export type ClientIceServer = {
  urls: string | string[]
  username?: string
  credential?: string
}

function parseJsonArray(raw: string): ClientIceServer[] | undefined {
  try {
    const v = JSON.parse(raw) as unknown
    if (!Array.isArray(v) || v.length === 0) {
      return undefined
    }
    const out: ClientIceServer[] = []
    for (const item of v) {
      if (!item || typeof item !== 'object') {
        continue
      }
      const o = item as Record<string, unknown>
      const urls = o.urls
      if (typeof urls === 'string') {
        out.push({
          urls,
          ...(typeof o.username === 'string' ? { username: o.username } : {}),
          ...(typeof o.credential === 'string' ? { credential: o.credential } : {}),
        })
        continue
      }
      if (Array.isArray(urls) && urls.every((u) => typeof u === 'string')) {
        out.push({
          urls: urls as string[],
          ...(typeof o.username === 'string' ? { username: o.username } : {}),
          ...(typeof o.credential === 'string' ? { credential: o.credential } : {}),
        })
      }
    }
    return out.length > 0 ? out : undefined
  } catch {
    return undefined
  }
}

/**
 * Reads env on each call so tests / dynamic config can override without restart if needed.
 */
export function getClientIceServersFromEnv(): ClientIceServer[] | undefined {
  const json = process.env.ICE_SERVERS_JSON?.trim()
  if (json) {
    const parsed = parseJsonArray(json)
    if (parsed) {
      return parsed
    }
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[ice] ICE_SERVERS_JSON set but parse failed or empty; ignoring')
    }
  }

  const urlsRaw = process.env.TURN_URLS?.trim()
  if (!urlsRaw) {
    return undefined
  }

  const urls = urlsRaw
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean)

  if (urls.length === 0) {
    return undefined
  }

  const username = process.env.TURN_USERNAME?.trim()
  const credential = process.env.TURN_CREDENTIAL?.trim()

  if (username && credential) {
    return urls.map((u) => ({ urls: u, username, credential }))
  }

  return urls.map((u) => ({ urls: u }))
}

export function getIceTransportPolicyFromEnv(): 'relay' | 'all' | undefined {
  const p = process.env.ICE_TRANSPORT_POLICY?.trim().toLowerCase()
  if (p === 'relay' || p === 'all') {
    return p
  }
  return undefined
}
