import type { RemoteProducerInfo, RoomPeerInfo } from './useRoomConnection'

/** Parse server `producer-sync` JSON; returns null when not a valid producer-sync message. */
export function parseProducerSyncPayload(
  data: unknown,
): { producers: RemoteProducerInfo[]; forceResync: boolean; peers?: RoomPeerInfo[] } | null {
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

  const rawPeers = (payload as { peers?: unknown }).peers
  const peers: RoomPeerInfo[] = []
  if (Array.isArray(rawPeers)) {
    for (const row of rawPeers) {
      if (!row || typeof row !== 'object') {
        continue
      }
      const r = row as { peerId?: unknown; displayName?: unknown; avatarUrl?: unknown }
      if (typeof r.peerId !== 'string' || typeof r.displayName !== 'string') {
        continue
      }
      const entry: RoomPeerInfo = { peerId: r.peerId, displayName: r.displayName.slice(0, 64) }
      if (typeof r.avatarUrl === 'string' && r.avatarUrl.trim().length > 0) {
        entry.avatarUrl = r.avatarUrl.trim().slice(0, 2048)
      }
      peers.push(entry)
    }
  }

  const list: RemoteProducerInfo[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') {
      continue
    }
    const r = row as {
      producerId?: unknown
      peerId?: unknown
      kind?: unknown
      videoSource?: unknown
      outboundVideoPaused?: unknown
    }
    if (
      typeof r.producerId === 'string' &&
      typeof r.peerId === 'string' &&
      (r.kind === 'audio' || r.kind === 'video')
    ) {
      const rowInfo: RemoteProducerInfo = { producerId: r.producerId, peerId: r.peerId, kind: r.kind }
      if (r.kind === 'video' && (r.videoSource === 'camera' || r.videoSource === 'screen')) {
        rowInfo.videoSource = r.videoSource
      }
      if (r.kind === 'video' && typeof r.outboundVideoPaused === 'boolean') {
        rowInfo.outboundVideoPaused = r.outboundVideoPaused
      }
      list.push(rowInfo)
    }
  }
  const out: { producers: RemoteProducerInfo[]; forceResync: boolean; peers?: RoomPeerInfo[] } = {
    producers: list,
    forceResync,
  }
  if (peers.length > 0) {
    out.peers = peers
  }
  return out
}
