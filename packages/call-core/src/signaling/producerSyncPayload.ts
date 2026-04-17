import type { RemoteProducerInfo } from './useRoomConnection'

/** Parse server `producer-sync` JSON; returns null when not a valid producer-sync message. */
export function parseProducerSyncPayload(
  data: unknown,
): { producers: RemoteProducerInfo[]; forceResync: boolean } | null {
  if (!data || typeof data !== 'object') {
    return null
  }
  const msg = data as { type?: string; payload?: unknown }
  if (msg.type !== 'producer-sync') {
    return null
  }
  const payload = msg.payload
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const raw = (payload as { producers?: unknown; syncReason?: unknown }).producers
  if (!Array.isArray(raw)) {
    return null
  }
  const syncReason = (payload as { syncReason?: unknown }).syncReason
  const forceResync = syncReason === 'client-refresh'
  const list: RemoteProducerInfo[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') {
      continue
    }
    const r = row as { producerId?: unknown; peerId?: unknown; kind?: unknown; videoSource?: unknown }
    if (
      typeof r.producerId === 'string' &&
      typeof r.peerId === 'string' &&
      (r.kind === 'audio' || r.kind === 'video')
    ) {
      const rowInfo: RemoteProducerInfo = { producerId: r.producerId, peerId: r.peerId, kind: r.kind }
      if (r.kind === 'video' && (r.videoSource === 'camera' || r.videoSource === 'screen')) {
        rowInfo.videoSource = r.videoSource
      }
      list.push(rowInfo)
    }
  }
  return { producers: list, forceResync }
}
