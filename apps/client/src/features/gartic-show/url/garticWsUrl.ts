import { sameOriginApiPrefix } from '@/utils/apiUrl'

export function buildGarticShowWsUrl(streamerId: string, peerId: string): string {
  const env = import.meta.env.VITE_GARTIC_WS_URL as string | undefined
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  if (typeof env === 'string' && env.trim().length > 0) {
    const u = new URL(env.trim())
    u.searchParams.set('streamerId', streamerId)
    u.searchParams.set('peerId', peerId)
    u.protocol = proto
    return u.toString()
  }
  const prefix = sameOriginApiPrefix()
  if (prefix.startsWith('http://') || prefix.startsWith('https://')) {
    const u = new URL('/gartic-show-ws', prefix.endsWith('/') ? prefix : `${prefix}/`)
    u.protocol = proto
    u.searchParams.set('streamerId', streamerId)
    u.searchParams.set('peerId', peerId)
    return u.toString()
  }
  const path = prefix ? `${prefix}/gartic-show-ws` : '/gartic-show-ws'
  const q = new URLSearchParams({ streamerId, peerId }).toString()
  return `${proto}//${location.host}${path}?${q}`
}
