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

/**
 * Mediasoup / signaling peer id: unique per tab (never read from localStorage as the whole id).
 * Includes a short device prefix for support logs; collision across tabs is practically impossible.
 */
export function newCallTabPeerId(): string {
  if (typeof sessionStorage !== 'undefined') {
    try {
      const existing = sessionStorage.getItem(SS_CALL_TAB_PEER_ID)
      if (typeof existing === 'string' && existing.trim().length >= 16 && existing.startsWith('peer-')) {
        return existing.trim()
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
