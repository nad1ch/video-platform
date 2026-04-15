import { defineStore } from 'pinia'
import { ref } from 'vue'
import { isVideoQualityPreset, type VideoQualityPreset } from '../media/videoQualityPreset'

const LS_VIDEO_PRESET = 'streamassist_call_video_quality_preset'
const LS_CALL_DEBUG = 'streamassist_call_debug_overlay'

function readVideoPreset(): VideoQualityPreset {
  if (typeof localStorage === 'undefined') {
    return 'balanced'
  }
  try {
    const v = localStorage.getItem(LS_VIDEO_PRESET)
    if (v && isVideoQualityPreset(v)) {
      return v
    }
  } catch {
    /* ignore */
  }
  return 'balanced'
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

function randomPeerId(): string {
  return `peer-${Math.random().toString(36).slice(2, 10)}`
}

export type RoomPeerEntry = { peerId: string; displayName: string }

export const useCallSessionStore = defineStore('callSession', () => {
  const roomId = ref('demo')
  const selfPeerId = ref(randomPeerId())
  const selfDisplayName = ref('You')
  const inCall = ref(false)
  /** Economy / balanced / HD — affects next `getUserMedia` + outbound encodings. */
  const videoQualityPreset = ref<VideoQualityPreset>(readVideoPreset())
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
    try {
      localStorage.setItem(LS_VIDEO_PRESET, p)
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
    selfPeerId.value = randomPeerId()
  }

  return {
    roomId,
    selfPeerId,
    selfDisplayName,
    inCall,
    videoQualityPreset,
    callDebugOverlay,
    remoteDisplayNames,
    replaceRemoteDisplayNames,
    upsertRemoteDisplayName,
    removeRemoteDisplayName,
    clearRemoteDisplayNames,
    labelFor,
    setInCall,
    setVideoQualityPreset,
    setCallDebugOverlay,
    resetSessionIdentity,
  }
})
