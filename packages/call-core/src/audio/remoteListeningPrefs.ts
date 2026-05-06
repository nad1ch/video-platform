const LS_PREFIX = 'streamassist_call_listen_v1:'

export type RemoteListenEntry = {
  volume: number
  muted: boolean
  /**
   * Last non-zero listen gain (0–2). Kept when `volume` is 0 so local unmute / icon restore can recover level.
   */
  nz?: number
}

function clampGain(v: number): number {
  if (!Number.isFinite(v)) {
    return 1
  }
  return Math.min(2, Math.max(0, v))
}

export function loadRemoteListeningPrefs(roomId: string): Map<string, RemoteListenEntry> {
  const out = new Map<string, RemoteListenEntry>()
  if (typeof localStorage === 'undefined') {
    return out
  }
  const key = LS_PREFIX + encodeURIComponent(roomId)
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return out
    }
    const o = JSON.parse(raw) as Record<string, unknown>
    if (!o || typeof o !== 'object') {
      return out
    }
    for (const [peerId, row] of Object.entries(o)) {
      if (!row || typeof row !== 'object') {
        continue
      }
      const r = row as { v?: unknown; m?: unknown; nz?: unknown }
      const volume = clampGain(typeof r.v === 'number' ? r.v : 1)
      const muted = r.m === true
      const nzRaw = r.nz
      const nz =
        typeof nzRaw === 'number' && Number.isFinite(nzRaw) ? clampGain(nzRaw) : undefined
      const entry: RemoteListenEntry = { volume, muted }
      if (nz !== undefined && nz > 0) {
        entry.nz = nz
      }
      out.set(peerId, entry)
    }
  } catch {
    /* ignore */
  }
  return out
}

export function saveRemoteListeningPrefs(roomId: string, map: Map<string, RemoteListenEntry>): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  const key = LS_PREFIX + encodeURIComponent(roomId)
  try {
    const o: Record<string, { v: number; m: boolean; nz?: number }> = {}
    for (const [peerId, e] of map.entries()) {
      const row: { v: number; m: boolean; nz?: number } = {
        v: clampGain(e.volume),
        m: e.muted === true,
      }
      if (typeof e.nz === 'number' && Number.isFinite(e.nz) && clampGain(e.nz) > 0) {
        row.nz = clampGain(e.nz)
      }
      o[peerId] = row
    }
    if (Object.keys(o).length === 0) {
      localStorage.removeItem(key)
      return
    }
    localStorage.setItem(key, JSON.stringify(o))
  } catch {
    /* ignore */
  }
}
