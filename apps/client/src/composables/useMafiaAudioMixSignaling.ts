import { onBeforeUnmount, watch, type Ref } from 'vue'
import type { WsStatus } from 'call-core'
import { MafiaWs } from './mafiaWsProtocol'

/**
 * Mafia host-controlled audio mix sync.
 *
 * Direction A — host → room:
 *   The host's `setRemoteListenVolume` / `setRemoteListenMuted` calls fan out
 *   one delta entry via `mafia:audio-mix-update`. The server validates host
 *   authority, stores the snapshot keyed by stable `userId` (peerId fallback),
 *   and re-broadcasts to every peer. Late joiners (notably `?mode=view` OBS)
 *   receive the full snapshot from `handleJoinRoom`.
 *
 * Direction B — room → OBS view:
 *   Only the OBS view (`isViewMode`) applies inbound entries, via the same
 *   `setRemoteListenVolume` / `setRemoteListenMuted` setters used by tile UI
 *   (call-core SSOT). The host ignores its own echoes; regular participants
 *   keep their personal listening prefs untouched. Wire `volume` is always
 *   **gain 0..2** (ParticipantTile converts slider percent 0..200 to gain via
 *   `pct/100` before `setRemoteListenVolume`); Zod and `StreamAudio` match that.
 *   The OBS view **never** applies inbound `muted` for the current `hostPeerId`
 *   (snapshots may carry `muted:false`); after each batch it force-mutes the
 *   current host. On host transfer, the previous host peer is restored from
 *   `lastServerMixByPeerId`, not blindly unmuted.
 *
 * Mediasoup producer/consumer/transport lifecycle is unchanged: this is
 * a thin wrapper around the existing call-core listening prefs.
 */
export type MafiaAudioMixDelta = {
  peerId: string
  volume: number
  muted: boolean
}

export type MafiaAudioMixSignalingDeps = {
  sendSignalingMessage: (obj: object) => void
  subscribeSignalingMessage: (fn: (data: unknown) => void) => () => void
  wsStatus: Ref<WsStatus | string>
  isMafiaRoute: Ref<boolean>
  /** True only on the OBS / `?mode=view` page (recv-only viewer). */
  isViewMode: Ref<boolean>
  /** True on the host's own browser tab. Used to ignore inbound echoes. */
  isMafiaHost: Ref<boolean>
  /** Server-broadcast hostPeerId from `mafia:host-updated`. */
  hostPeerId: Ref<string | null>
  /** Apply to call-core listening prefs (peerId-keyed). */
  setRemoteListenVolume: (peerId: string, volume: number) => void
  setRemoteListenMuted: (peerId: string, muted: boolean) => void
}

export type MafiaAudioMixSignaling = {
  /**
   * Host-side: call after `setRemoteListenVolume` / `setRemoteListenMuted`
   * to broadcast the new entry. Resolves stable `userId` from the call
   * `room-state` / `peer-joined` listener it owns. No-op when not host,
   * when WS is closed, or when not in a Mafia call.
   */
  broadcastMafiaAudioMixDelta: (delta: MafiaAudioMixDelta) => void
}

function parseMafiaAudioMixUpdate(
  data: unknown,
): { entries: Array<{ peerId: string; userId: string | null; volume: number; muted: boolean }> } | null {
  if (!data || typeof data !== 'object') {
    return null
  }
  const o = data as { type?: unknown; payload?: unknown }
  if (o.type !== MafiaWs.audioMixUpdate) {
    return null
  }
  const p = o.payload
  if (!p || typeof p !== 'object') {
    return null
  }
  const raw = (p as { entries?: unknown }).entries
  if (!Array.isArray(raw)) {
    return null
  }
  const out: Array<{ peerId: string; userId: string | null; volume: number; muted: boolean }> = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as { peerId?: unknown; userId?: unknown; volume?: unknown; muted?: unknown }
    const peerId = typeof r.peerId === 'string' ? r.peerId.trim() : ''
    if (!peerId) continue
    const volumeRaw = typeof r.volume === 'number' && Number.isFinite(r.volume) ? r.volume : 1
    const volume = Math.min(2, Math.max(0, volumeRaw))
    const muted = r.muted === true
    const userIdRaw = typeof r.userId === 'string' ? r.userId.trim() : ''
    const userId = userIdRaw.length > 0 ? userIdRaw : null
    out.push({ peerId, userId, volume, muted })
  }
  return { entries: out }
}

export function useMafiaAudioMixSignaling(deps: MafiaAudioMixSignalingDeps): MafiaAudioMixSignaling {
  const {
    sendSignalingMessage,
    subscribeSignalingMessage,
    wsStatus,
    isMafiaRoute,
    isViewMode,
    isMafiaHost,
    hostPeerId,
    setRemoteListenVolume,
    setRemoteListenMuted,
  } = deps

  // Local peerId → userId index maintained from call signaling. Lets the host
  // emit entries with a stable `userId` so the server can rebind across
  // peerId changes (host or participant reload).
  const userIdByPeerId = new Map<string, string>()

  function rememberPeerUserIdFromRoomState(data: unknown): void {
    if (!data || typeof data !== 'object') return
    const m = data as { type?: unknown; payload?: unknown }
    if (m.type === 'room-state') {
      const p = m.payload as { peers?: unknown } | null
      const list = Array.isArray(p?.peers) ? p?.peers : null
      if (!list) return
      for (const row of list) {
        if (!row || typeof row !== 'object') continue
        const r = row as { peerId?: unknown; userId?: unknown }
        const pid = typeof r.peerId === 'string' ? r.peerId.trim() : ''
        if (!pid) continue
        const uid = typeof r.userId === 'string' ? r.userId.trim() : ''
        if (uid.length > 0) {
          userIdByPeerId.set(pid, uid)
        }
      }
      return
    }
    if (m.type === 'peer-joined') {
      const p = m.payload as { peerId?: unknown; userId?: unknown } | null
      if (!p) return
      const pid = typeof p.peerId === 'string' ? p.peerId.trim() : ''
      if (!pid) return
      const uid = typeof p.userId === 'string' ? p.userId.trim() : ''
      if (uid.length > 0) {
        userIdByPeerId.set(pid, uid)
      }
      return
    }
    if (m.type === 'peer-left') {
      const p = m.payload as { peerId?: unknown } | null
      const pid = typeof p?.peerId === 'string' ? p.peerId.trim() : ''
      if (pid) {
        userIdByPeerId.delete(pid)
        // `lastServerMixByPeerId` is the OBS-side cache used to restore the
        // previous host's tile mix on host transfer. Without this prune, it
        // accumulated one orphan entry per anonymous-peer reload across long
        // sessions. Authenticated peers re-snapshot through the server's
        // userId-keyed mix on the next join, so dropping the peerId entry is
        // safe — the entry will be re-added if the same peerId returns.
        lastServerMixByPeerId.delete(pid)
      }
    }
  }

  /**
   * Last server-authoritative mix per peerId (from snapshots / deltas). Used to
   * restore the previous host's tile when host transfers — not a blind unmute.
   */
  const lastServerMixByPeerId = new Map<string, { volume: number; muted: boolean }>()

  function currentHostPeerIdTrimmed(): string {
    const h = hostPeerId.value
    return typeof h === 'string' ? h.trim() : ''
  }

  function applyEntriesIfViewMode(
    entries: Array<{ peerId: string; userId: string | null; volume: number; muted: boolean }>,
  ): void {
    // Cache userId hint from inbound entries so reload-and-resnapshot still
    // resolves identity even before `peer-joined` fires for the new peerId.
    for (const e of entries) {
      if (e.userId) {
        userIdByPeerId.set(e.peerId, e.userId)
      }
    }
    for (const e of entries) {
      lastServerMixByPeerId.set(e.peerId, { volume: e.volume, muted: e.muted })
    }
    if (!isViewMode.value) {
      return
    }
    const hp = currentHostPeerIdTrimmed()
    for (const e of entries) {
      setRemoteListenVolume(e.peerId, e.volume)
      // Never apply inbound mute for the current room host: snapshots may
      // carry muted:false for that peerId; OBS must keep host playback muted.
      if (hp.length > 0 && e.peerId === hp) {
        continue
      }
      setRemoteListenMuted(e.peerId, e.muted)
    }
    if (hp.length > 0) {
      setRemoteListenMuted(hp, true)
    }
  }

  const off = subscribeSignalingMessage((data) => {
    rememberPeerUserIdFromRoomState(data)
    const parsed = parseMafiaAudioMixUpdate(data)
    if (parsed) {
      applyEntriesIfViewMode(parsed.entries)
    }
  })
  onBeforeUnmount(off)

  // OBS view: force-mute current host playback (mic is captured separately in OBS).
  // Previous host is restored from lastServerMixByPeerId (not blindly unmuted).
  let lastForcedHostMutePeerId: string | null = null
  watch(
    [isViewMode, isMafiaRoute, hostPeerId],
    ([viewMode, mafiaRoute, hpid]) => {
      if (!mafiaRoute || !viewMode) {
        if (lastForcedHostMutePeerId != null) {
          const prev = lastForcedHostMutePeerId
          const rec = lastServerMixByPeerId.get(prev)
          setRemoteListenVolume(prev, rec?.volume ?? 1)
          setRemoteListenMuted(prev, rec?.muted ?? false)
          lastForcedHostMutePeerId = null
        }
        return
      }
      const next = typeof hpid === 'string' && hpid.trim().length > 0 ? hpid.trim() : null
      if (lastForcedHostMutePeerId === next) {
        return
      }
      if (lastForcedHostMutePeerId != null) {
        const prev = lastForcedHostMutePeerId
        const rec = lastServerMixByPeerId.get(prev)
        setRemoteListenVolume(prev, rec?.volume ?? 1)
        setRemoteListenMuted(prev, rec?.muted ?? false)
      }
      lastForcedHostMutePeerId = next
      if (next != null) {
        setRemoteListenMuted(next, true)
      }
    },
    { immediate: true },
  )

  function broadcastMafiaAudioMixDelta(delta: MafiaAudioMixDelta): void {
    if (!isMafiaRoute.value || !isMafiaHost.value) {
      return
    }
    if (wsStatus.value !== 'open') {
      return
    }
    const peerId = typeof delta.peerId === 'string' ? delta.peerId.trim() : ''
    if (!peerId) {
      return
    }
    const volumeRaw = typeof delta.volume === 'number' && Number.isFinite(delta.volume) ? delta.volume : 1
    const volume = Math.min(2, Math.max(0, volumeRaw))
    const muted = delta.muted === true
    const userId = userIdByPeerId.get(peerId)
    try {
      sendSignalingMessage({
        type: MafiaWs.audioMixUpdate,
        payload: {
          entries: [
            {
              peerId,
              ...(userId ? { userId } : {}),
              volume,
              muted,
            },
          ],
        },
      })
    } catch {
      /* ws closed mid-send: server snapshot replay covers the gap on next open */
    }
  }

  return { broadcastMafiaAudioMixDelta }
}
