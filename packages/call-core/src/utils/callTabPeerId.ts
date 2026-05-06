const LS_CALL_DEVICE_ID = 'streamassist_call_device_id'
const SS_CALL_TAB_PEER_ID = 'streamassist_call_tab_peer_id'

function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`
}

/**
 * Stable per-browser-profile id (localStorage). Not a WebRTC peer id — use {@link newCallTabPeerId} for that.
 */
export function readOrCreateCallDeviceId(): string {
  if (typeof localStorage === 'undefined') {
    return 'runtime'
  }
  try {
    const existing = localStorage.getItem(LS_CALL_DEVICE_ID)
    if (existing && existing.length >= 8 && existing.length <= 128) {
      return existing
    }
    const id = randomUuid()
    localStorage.setItem(LS_CALL_DEVICE_ID, id)
    return id
  } catch {
    return 'runtime'
  }
}

function navigationTimingType(): string | undefined {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') {
    return undefined
  }
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  return nav?.type
}

/**
 * Reuse stored peer id only after reload or BFCache back/forward in this tab.
 * Duplicating a tab clones sessionStorage; treating that like a fresh navigation avoids duplicate peerId eviction on the server.
 */
function shouldReusePersistedTabPeerId(): boolean {
  const t = navigationTimingType()
  return t === 'reload' || t === 'back_forward'
}

/**
 * Mediasoup / signaling peer id: unique per browser tab (never the whole id from localStorage).
 * Includes a short device prefix for support logs. Duplicate-tab clones sessionStorage — see {@link shouldReusePersistedTabPeerId}.
 */
export function newCallTabPeerId(): string {
  if (typeof sessionStorage !== 'undefined') {
    try {
      if (shouldReusePersistedTabPeerId()) {
        const existing = sessionStorage.getItem(SS_CALL_TAB_PEER_ID)
        if (typeof existing === 'string' && existing.trim().length >= 16 && existing.startsWith('peer-')) {
          return existing.trim()
        }
      } else {
        sessionStorage.removeItem(SS_CALL_TAB_PEER_ID)
      }
    } catch {
      /* ignore */
    }
  }
  const device = readOrCreateCallDeviceId().replace(/-/g, '').slice(0, 8)
  const tab = randomUuid()
  const next = `peer-${device}-${tab}`
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(SS_CALL_TAB_PEER_ID, next)
    } catch {
      /* ignore */
    }
  }
  return next
}

/** Force a new per-tab peer id (used by explicit session identity resets). */
export function resetCallTabPeerId(): string {
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(SS_CALL_TAB_PEER_ID)
    } catch {
      /* ignore */
    }
  }
  return newCallTabPeerId()
}
