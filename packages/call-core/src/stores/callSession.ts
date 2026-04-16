import { defineStore } from 'pinia'
import { ref } from 'vue'
import { isVideoQualityPreset, type VideoQualityPreset } from '../media/videoQualityPreset'
import { newCallTabPeerId } from '../utils/callTabPeerId'

const LS_VIDEO_PRESET = 'streamassist_call_video_quality_preset'
/** When `'1'`, the user chose economy / balanced / HD (or migrated from older persisted preset). */
const LS_VIDEO_EXPLICIT = 'streamassist_call_video_quality_explicit'
const LS_CALL_DEBUG = 'streamassist_call_debug_overlay'

function readVideoQualityFromStorage(): { preset: VideoQualityPreset; explicit: boolean } {
  if (typeof localStorage === 'undefined') {
    return { preset: 'balanced', explicit: false }
  }
  try {
    const explicitFlag = localStorage.getItem(LS_VIDEO_EXPLICIT)
    const v = localStorage.getItem(LS_VIDEO_PRESET)
    if (explicitFlag === '1' && v && isVideoQualityPreset(v)) {
      return { preset: v, explicit: true }
    }
    // Older builds only stored the preset — treat as an explicit choice.
    if (v && isVideoQualityPreset(v)) {
      return { preset: v, explicit: true }
    }
  } catch {
    /* ignore */
  }
  return { preset: 'balanced', explicit: false }
}

function readCallDebugOverlay(): boolean {
  if (typeof localStorage === 'undefined') {
    return false
  }
  try {
    return localStorage.getItem(LS_CALL_DEBUG) === '1'
  } catch {
    return false
  }
}

export type RoomPeerEntry = { peerId: string; displayName: string }

export const useCallSessionStore = defineStore('callSession', () => {
  const roomId = ref('demo')
  const selfPeerId = ref(newCallTabPeerId())
  const selfDisplayName = ref('You')
  const inCall = ref(false)
  /** Economy / balanced / HD — UI selection; encoding uses `videoPublishTier` (see `videoQualityExplicit`). */
  const videoQualityPreset = ref<VideoQualityPreset>(readVideoQualityFromStorage().preset)
  /** False until the user changes quality (or legacy preset was in localStorage). */
  const videoQualityExplicit = ref(readVideoQualityFromStorage().explicit)
  /** Technical overlay (stats, mode). Persisted so devs keep it across reloads. */
  const callDebugOverlay = ref(readCallDebugOverlay())
  /** displayName from server (room-state / peer-joined / peer-display-name). */
  const remoteDisplayNames = ref<Record<string, string>>({})

  /** Replace remote name map from server peer list (excludes self). */
  function replaceRemoteDisplayNames(peers: RoomPeerEntry[]): void {
    const next: Record<string, string> = {}
    for (const p of peers) {
      if (p.peerId === selfPeerId.value) {
        continue
      }
      next[p.peerId] = p.displayName
    }
    remoteDisplayNames.value = next
  }

  function upsertRemoteDisplayName(peerId: string, displayName: string): void {
    if (peerId === selfPeerId.value) {
      return
    }
    remoteDisplayNames.value = { ...remoteDisplayNames.value, [peerId]: displayName }
  }

  function removeRemoteDisplayName(peerId: string): void {
    const next = { ...remoteDisplayNames.value }
    delete next[peerId]
    remoteDisplayNames.value = next
  }

  function clearRemoteDisplayNames(): void {
    remoteDisplayNames.value = {}
  }

  function labelFor(peerId: string): string {
    if (peerId === selfPeerId.value) {
      const dn = selfDisplayName.value
      const t = typeof dn === 'string' ? dn.trim() : String(dn ?? '').trim()
      return t || 'You'
    }
    const fromServer = remoteDisplayNames.value[peerId]
    if (fromServer) {
      return fromServer
    }
    return `Guest ${peerId.length > 6 ? peerId.slice(-6) : peerId}`
  }

  function setInCall(v: boolean): void {
    inCall.value = v
  }

  function setVideoQualityPreset(p: VideoQualityPreset): void {
    videoQualityPreset.value = p
    videoQualityExplicit.value = true
    try {
      localStorage.setItem(LS_VIDEO_PRESET, p)
      localStorage.setItem(LS_VIDEO_EXPLICIT, '1')
    } catch {
      /* ignore */
    }
  }

  /** Back to automatic profiles on next capture/publish (clears persisted explicit choice). */
  function setVideoQualityImplicitDefault(): void {
    videoQualityExplicit.value = false
    videoQualityPreset.value = 'balanced'
    try {
      localStorage.removeItem(LS_VIDEO_PRESET)
      localStorage.removeItem(LS_VIDEO_EXPLICIT)
    } catch {
      /* ignore */
    }
  }

  function setCallDebugOverlay(v: boolean): void {
    callDebugOverlay.value = v
    try {
      localStorage.setItem(LS_CALL_DEBUG, v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  function resetSessionIdentity(): void {
    selfPeerId.value = newCallTabPeerId()
  }

  return {
    roomId,
    selfPeerId,
    selfDisplayName,
    inCall,
    videoQualityPreset,
    videoQualityExplicit,
    callDebugOverlay,
    remoteDisplayNames,
    replaceRemoteDisplayNames,
    upsertRemoteDisplayName,
    removeRemoteDisplayName,
    clearRemoteDisplayNames,
    labelFor,
    setInCall,
    setVideoQualityPreset,
    setVideoQualityImplicitDefault,
    setCallDebugOverlay,
    resetSessionIdentity,
  }
})
