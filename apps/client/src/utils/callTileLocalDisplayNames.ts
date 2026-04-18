const LS_KEY = 'streamassist_call_tile_display_overrides_v1'

/** Local-only nickname overrides keyed by signaling peer id (no server round-trip). */
export function loadCallTileLocalDisplayOverrides(): Record<string, string> {
  if (typeof localStorage === 'undefined') {
    return {}
  }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) {
      return {}
    }
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== 'object') {
      return {}
    }
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(o)) {
      if (typeof k === 'string' && k.trim().length > 0 && typeof v === 'string' && v.trim().length > 0) {
        out[k.trim()] = v.trim().slice(0, 64)
      }
    }
    return out
  } catch {
    return {}
  }
}

export function saveCallTileLocalDisplayOverrides(map: Record<string, string>): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  try {
    if (Object.keys(map).length === 0) {
      localStorage.removeItem(LS_KEY)
      return
    }
    localStorage.setItem(LS_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}
