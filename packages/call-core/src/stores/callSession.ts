import { defineStore } from 'pinia'
import { ref } from 'vue'
import { isVideoQualityPreset, type VideoQualityPreset } from '../media/videoQualityPreset'
import { guestDisplayNameForPeerId } from '../utils/participantsMapper'
import { normalizeDisplayName } from '../utils/normalizeDisplayName'
import { newCallTabPeerId, resetCallTabPeerId } from '../utils/callTabPeerId'

const LS_VIDEO_PRESET = 'streamassist_call_video_quality_preset'

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

export type RoomPeerEntry = { peerId: string; displayName: string; avatarUrl?: string }

export const useCallSessionStore = defineStore('callSession', () => {
  const roomId = ref('demo')
  const selfPeerId = ref(newCallTabPeerId())
  const selfDisplayName = ref('You')
  const inCall = ref(false)
  
  const videoQualityPreset = ref<VideoQualityPreset>(readVideoQualityFromStorage().preset)
  
  const videoQualityExplicit = ref(readVideoQualityFromStorage().explicit)
  
  const callDebugOverlay = ref(readCallDebugOverlay())
  /**
   * `undefined` — no `signaling-auth` yet for this socket.
   * `null` — server resolved an empty session on WS upgrade (no cookie / not logged in for this host).
   * string — JWT user id for this signaling connection (matches server `Peer.userId` after join).
   */
  const signalingAuthUserId = ref<string | null | undefined>(undefined)

  /** displayName from server (room-state / peer-joined / peer-display-name). */
  const remoteDisplayNames = ref<Record<string, string>>({})
  
  const remoteAvatarUrls = ref<Record<string, string>>({})

  
  function replaceRemoteDisplayNames(peers: RoomPeerEntry[]): void {
    const next: Record<string, string> = {}
    const nextAv: Record<string, string> = {}
    for (const p of peers) {
      if (p.peerId === selfPeerId.value) {
        continue
      }
      next[p.peerId] = p.displayName
      if (typeof p.avatarUrl === 'string' && p.avatarUrl.trim().length > 0) {
        nextAv[p.peerId] = p.avatarUrl.trim()
      }
    }
    remoteDisplayNames.value = next
    remoteAvatarUrls.value = nextAv
  }

  /** Merge avatar + name rows from producer-sync peer roster (does not wipe peers missing from this slice). */
  function mergeRemotePeersFromProducerSync(peers: RoomPeerEntry[]): void {
    if (peers.length === 0) {
      return
    }
    let names = remoteDisplayNames.value
    let avatars = remoteAvatarUrls.value
    let touched = false
    for (const p of peers) {
      if (p.peerId === selfPeerId.value) {
        continue
      }
      touched = true
      names = { ...names, [p.peerId]: p.displayName }
      if (typeof p.avatarUrl === 'string' && p.avatarUrl.trim().length > 0) {
        avatars = { ...avatars, [p.peerId]: p.avatarUrl.trim() }
      }
    }
    if (touched) {
      remoteDisplayNames.value = names
      remoteAvatarUrls.value = avatars
    }
  }

  function upsertRemoteDisplayName(peerId: string, displayName: string, avatarUrl?: string): void {
    if (peerId === selfPeerId.value) {
      return
    }
    remoteDisplayNames.value = { ...remoteDisplayNames.value, [peerId]: displayName }
    if (typeof avatarUrl === 'string' && avatarUrl.trim().length > 0) {
      remoteAvatarUrls.value = { ...remoteAvatarUrls.value, [peerId]: avatarUrl.trim() }
    }
  }

  function removeRemoteDisplayName(peerId: string): void {
    const next = { ...remoteDisplayNames.value }
    delete next[peerId]
    remoteDisplayNames.value = next
    const nextA = { ...remoteAvatarUrls.value }
    delete nextA[peerId]
    remoteAvatarUrls.value = nextA
  }

  function clearRemoteDisplayNames(): void {
    remoteDisplayNames.value = {}
    remoteAvatarUrls.value = {}
  }

  



  function labelFor(peerId: string): string {
    if (peerId === selfPeerId.value) {
      return normalizeDisplayName(selfDisplayName.value) || 'You'
    }
    const fromServer = remoteDisplayNames.value[peerId]
    if (fromServer) {
      return fromServer
    }
    return guestDisplayNameForPeerId(peerId)
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
    selfPeerId.value = resetCallTabPeerId()
  }

  function setSignalingAuthUserId(id: string | null | undefined): void {
    signalingAuthUserId.value = id
  }

  return {
    roomId,
    selfPeerId,
    selfDisplayName,
    inCall,
    videoQualityPreset,
    videoQualityExplicit,
    callDebugOverlay,
    signalingAuthUserId,
    remoteDisplayNames,
    remoteAvatarUrls,
    replaceRemoteDisplayNames,
    mergeRemotePeersFromProducerSync,
    upsertRemoteDisplayName,
    removeRemoteDisplayName,
    clearRemoteDisplayNames,
    labelFor,
    setInCall,
    setVideoQualityPreset,
    setVideoQualityImplicitDefault,
    setCallDebugOverlay,
    resetSessionIdentity,
    setSignalingAuthUserId,
  }
})
