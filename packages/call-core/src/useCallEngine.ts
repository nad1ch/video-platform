import { getActivePinia, storeToRefs } from 'pinia'
import type { ComputedRef, Ref } from 'vue'
import { computed, nextTick, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { loadRemoteListeningPrefs, saveRemoteListeningPrefs } from './audio/remoteListeningPrefs'
import type { RemoteListenEntry } from './audio/remoteListeningPrefs'
import { gridSizeTierFromParticipantCount } from './media/gridTier'
import { useCallSessionStore } from './stores/callSession'
import { playAllPageAudio } from './audio/audioPlaybackUnlock'
import { useLocalMedia } from './media/useLocalMedia'
import { useMediasoupDevice } from './media/useMediasoupDevice'
import { useRemoteMedia } from './media/useRemoteMedia'
import { useRoomConnection } from './signaling/useRoomConnection'
import { parseProducerSyncPayload } from './signaling/producerSyncPayload'
import {
  countActiveCameraPublishersAtWire,
  resolveOutgoingVideoPublishTier,
  type VideoPublishTier,
} from './media/videoQualityPreset'
import { shouldUseVideoSimulcastForRoom } from './media/videoSimulcast'
import { useActiveSpeaker, type ActiveSpeakerTile } from './audio/useActiveSpeaker'
import { useSendTransport } from './transport/useSendTransport'
import { buildRequestProducerSyncPayload } from './media/recoveryCoordinator'
import {
  decideAfterDocumentBecameVisible,
  decideAfterSocketStatusChange,
  decideAfterWindowFocus,
} from './reconnectOrchestrationPolicy'
import { normalizeDisplayName } from './utils/normalizeDisplayName'
import { resolveParticipantDisplayName } from './utils/participantsMapper'
import { waitForCondition } from './utils/waitForCondition'
import { newCallTabPeerId } from './utils/callTabPeerId'
import { pickOutboundCameraVideoTrack } from './screenShare/outboundCameraTrack'
import { useCallScreenShare } from './screenShare/useCallScreenShare'

/** Pinia session store from this package (or a compatible drop-in). */
export type CallSessionStore = ReturnType<typeof useCallSessionStore>

/** `viewer` = recv-only (e.g. OBS overlay); `participant` = publish camera/mic after join. */
export type CallEngineRole = 'participant' | 'viewer'

export type CallEngineOptions = {
  /** Overrides `VITE_SIGNALING_URL`. Use a DNS-only host (e.g. media.example.com) if the SPA is behind a CDN proxy. */
  signalingUrl?: string
  /**
   * Identity / room UI state. Omit to use `useCallSessionStore()` from this package.
   * Pass your own store when reusing the engine outside this app or with a custom Pinia slice.
   */
  session?: CallSessionStore
  /**
   * Read on each `joinCall()` and when computing `tiles`. Use a computed for modes that switch
   * between publish and recv-only (e.g. Eat overlay spectator vs player).
   */
  role?: Ref<CallEngineRole> | ComputedRef<CallEngineRole>
  /**
   * When true, manual economy/balanced/hd controls apply. Regular users should omit or pass false
   * so outbound quality follows automatic room profiles only.
   */
  allowManualVideoQuality?: Ref<boolean> | ComputedRef<boolean>
  /**
   * Http(s) profile URL mirrored in `join-room` for other participants; also used as local tile `avatarUrl` SSOT.
   */
  joinAvatarUrl?: Ref<string | undefined> | ComputedRef<string | undefined>
}

/**
 * One grid tile: dumb UI maps this to `ParticipantTile`.
 * `displayName` feeds `mapTilesToParticipants` / `buildCallParticipantMap` (same strings as
 * `resolveParticipantDisplayName`); call UI should use `resolvePeerDisplayNameForUi` / presence `displayName`.
 */
export type CallTile = {
  peerId: string
  stream: MediaStream | null
  displayName: string
  isLocal: boolean
  videoEnabled: boolean
  audioEnabled: boolean
  playRev?: number
  /**
   * Local camera-only tiles: `cover` often looks better in a square grid.
   * Screen share and all remote tiles use `contain` (default false).
   */
  videoFillCover?: boolean
  /** Local-only listening gain for this remote peer (0..2 → 0–200%). */
  remoteListenVolume?: number
  /** Local-only mute for this remote peer (does not affect their mic). */
  remoteListenMuted?: boolean
  /** Signaled “raise hand” for this peer. */
  handRaised?: boolean
  /** Local outbound / remote inbound presentation (outbound SSOT or `remoteVideoSourceByPeerId`). */
  videoPresentation?: 'camera' | 'screen' | 'none'
  /** Profile image when video is off (`join-room` for local; server roster for remotes). */
  avatarUrl?: string
}

export type CallChatLine = {
  id: string
  peerId: string
  displayName: string
  text: string
  at: number
}

const DISPLAY_NAME_DEBOUNCE_MS = 400

function stringValue(v: unknown): string {
  if (typeof v === 'string') {
    return v
  }
  if (v == null) {
    return ''
  }
  return String(v)
}

/** `undefined` = not this message; `null` = silence (clear highlight / layers). */
function parseActiveSpeakerFromServer(data: unknown): string | null | undefined {
  if (!data || typeof data !== 'object') {
    return undefined
  }
  const m = data as { type?: string; payload?: unknown }
  if (m.type !== 'active-speaker') {
    return undefined
  }
  const p = m.payload
  if (!p || typeof p !== 'object') {
    return undefined
  }
  const peerId = (p as { peerId?: unknown }).peerId
  if (peerId === null) {
    return null
  }
  if (typeof peerId === 'string') {
    return peerId
  }
  return undefined
}

function readEngineRole(options: CallEngineOptions | undefined): CallEngineRole {
  const r = options?.role
  if (r && typeof r === 'object' && 'value' in r) {
    return (r as Ref<CallEngineRole>).value === 'viewer' ? 'viewer' : 'participant'
  }
  return 'participant'
}

function readAllowManualVideoQuality(options: CallEngineOptions | undefined): boolean {
  const r = options?.allowManualVideoQuality
  if (r && typeof r === 'object' && 'value' in r) {
    return Boolean((r as Ref<boolean>).value)
  }
  return false
}

function readJoinAvatarUrl(options: CallEngineOptions | undefined): string {
  const r = options?.joinAvatarUrl
  if (r && typeof r === 'object' && 'value' in r) {
    const v = (r as Ref<string | undefined>).value
    if (typeof v === 'string' && v.trim().length > 0) {
      return v.trim().slice(0, 2048)
    }
  }
  return ''
}

export function useCallEngine(options?: CallEngineOptions) {
  if (getActivePinia() === undefined) {
    throw new Error(
      'useCallEngine requires an active Pinia app (call app.use(createPinia()) before mount). If you use a workspace package, ensure Vite resolve.dedupe includes "pinia" and "vue" so there is only one Pinia instance.',
    )
  }

  const session = options?.session ?? useCallSessionStore()
  const {
    roomId,
    selfPeerId,
    selfDisplayName,
    inCall,
    videoQualityPreset,
    videoQualityExplicit,
    remoteDisplayNames,
    remoteAvatarUrls,
  } = storeToRefs(session)

  const {
    lastRoomState,
    wsStatus,
    connect: roomConnect,
    joinRoom,
    sendUpdateDisplayName,
    disconnect: roomDisconnect,
    sendJson,
    addMessageListener,
    drainPendingNewProducers,
    startSignalingKeepAlive,
    stopSignalingKeepAlive,
  } = useRoomConnection(options?.signalingUrl)

  const { device, loadDevice, reset: deviceReset } = useMediasoupDevice()
  const {
    createSendTransport,
    closeSendTransport,
    publishLocalMedia,
    replaceOutboundVideoTrack,
    replaceOutboundAudioTrack,
  } = useSendTransport()

  const wirePublishTier = ref<VideoPublishTier>('auto_large_room')
  const lastWireActiveCameraPublishers = ref(0)

  const {
    localStream,
    localPlayRev,
    micEnabled,
    camEnabled,
    audioInputDevices,
    videoInputDevices,
    refreshMediaDevices,
    startLocalMedia,
    stopLocalMedia,
    toggleMic,
    toggleCam: toggleLocalCam,
    swapLocalAudioInput,
    swapLocalVideoInput,
  } = useLocalMedia({
    getVideoPublishTier: () => wirePublishTier.value,
  })

  /** When `getSettings().deviceId` is empty (some drivers), keep menu highlight on last explicit pick. */
  const lastPickedAudioInputId = ref('')
  const lastPickedVideoInputId = ref('')

  /**
   * UI highlight for device menus: prefer the last explicit pick when it still appears in
   * `enumerateDevices`, because `track.getSettings().deviceId` can lag or diverge (e.g. Windows
   * multi-endpoint / virtual devices) while capture already switched.
   */
  const localAudioInputDeviceId = computed(() => {
    const picked = lastPickedAudioInputId.value.trim()
    const trackId = (localStream.value?.getAudioTracks()[0]?.getSettings?.()?.deviceId ?? '').trim()

    if (picked && audioInputDevices.value.some((d) => d.deviceId === picked)) {
      return picked
    }
    if (trackId) {
      return trackId
    }
    return picked
  })

  const localVideoInputDeviceId = computed(() => {
    const picked = lastPickedVideoInputId.value.trim()
    const trackId = (localStream.value?.getVideoTracks()[0]?.getSettings?.()?.deviceId ?? '').trim()

    if (picked && videoInputDevices.value.some((d) => d.deviceId === picked)) {
      return picked
    }
    if (trackId) {
      return trackId
    }
    return picked
  })

  const {
    remotePeerStreams,
    remotePeerPlayRevs,
    remoteVideoSourceByPeerId,
    remoteOutboundVideoPausedByPeerId,
    activeSpeakerPeerId: serverActiveSpeakerPeerId,
    networkQuality,
    setupReceivePath,
    stopRemoteMedia,
    setActiveSpeaker,
    setUiActiveSpeakerPeerIdForPreferredLayers,
    setNetworkQualityOverride,
    collectInboundVideoDebugStats,
    setPeerVisible,
    removeRemotePeer,
    requestForcedProducerResync,
    receiveQualityPressure,
    receiveDeviceProfile,
    lastPreferredLayerTargetsByPeerId,
    playbackRenderFpsPressureByPeerId,
  } = useRemoteMedia()

  const remoteListenPrefs = shallowRef(new Map<string, RemoteListenEntry>())
  const callPresenceMessages = ref<
    { id: string; at: number; kind: 'join' | 'leave'; peerId: string; displayName: string }[]
  >([])

  const callChatMessages = ref<CallChatLine[]>([])
  const peerHandRaised = ref<Record<string, boolean>>({})
  /** Local user's raised-hand flag (also echoed from server). */
  const handRaised = ref(false)

  /**
   * Refreshes local camera capture if there is no live track (fresh `getUserMedia` via {@link swapLocalVideoInput}),
   * so screen-share stop can always `replaceTrack` with a valid track when a device is available.
   */
  async function ensureOutboundCameraTrackForScreenShareRestore(): Promise<void> {
    const picked = pickOutboundCameraVideoTrack(localStream.value)
    if (picked && picked.readyState === 'live') {
      return
    }
    const raw =
      (typeof lastPickedVideoInputId.value === 'string' && lastPickedVideoInputId.value.trim()) ||
      localStream.value?.getVideoTracks()[0]?.getSettings?.()?.deviceId?.trim() ||
      ''
    if (!raw) {
      return
    }
    try {
      await swapLocalVideoInput(raw)
    } catch {
      /* device unavailable */
    }
  }

  const {
    outboundVideoSource,
    screenSharing,
    activePreviewStream,
    stoppingScreenShare,
    stopScreenShare,
    toggleScreenShare: toggleScreenShareInternal,
    teardownScreenShare,
    applyCamStateForOutbound,
  } = useCallScreenShare({
    localStream,
    camEnabled,
    localPlayRev,
    replaceOutboundVideoTrack,
    notifyProducerVideoSource: (producerId, source) => {
      try {
        sendJson({ type: 'producer-video-source', payload: { producerId, source } })
      } catch {
        /* ws closed */
      }
    },
    canShareScreen: () => readEngineRole(options) === 'participant' && Boolean(inCall.value),
    ensureOutboundCameraTrack: ensureOutboundCameraTrackForScreenShareRestore,
  })

  /**
   * Camera ↔ screen are mutually exclusive: toggling camera while sharing
   * stops screen share first; outbound state stays consistent via {@link applyCamStateForOutbound}.
   */
  async function toggleCam(): Promise<void> {
    if (readEngineRole(options) === 'participant' && inCall.value && outboundVideoSource.value === 'screen') {
      await stopScreenShare()
    }
    toggleLocalCam()
    applyCamStateForOutbound()
  }

  /**
   * Starting screen share turns the physical webcam off if it was on, then starts capture.
   * Stopping when already shared delegates to the composable (single toggle).
   */
  async function toggleScreenShare(): Promise<void> {
    if (readEngineRole(options) !== 'participant' || !inCall.value) {
      await toggleScreenShareInternal()
      return
    }
    if (outboundVideoSource.value === 'screen') {
      await toggleScreenShareInternal()
      return
    }
    if (camEnabled.value) {
      toggleLocalCam()
    }
    applyCamStateForOutbound()
    await nextTick()
    await toggleScreenShareInternal()
  }

  const isCameraActive = computed(() => outboundVideoSource.value === 'camera')
  const isScreenActive = computed(() => outboundVideoSource.value === 'screen')

  async function setCallAudioInputDevice(deviceId: string): Promise<void> {
    lastPickedAudioInputId.value = deviceId.trim()
    await swapLocalAudioInput(deviceId)
    if (readEngineRole(options) !== 'participant' || !inCall.value) {
      return
    }
    const t = localStream.value?.getAudioTracks()[0]
    if (t && t.readyState === 'live') {
      await replaceOutboundAudioTrack(t)
    }
  }

  async function setCallVideoInputDevice(deviceId: string): Promise<void> {
    lastPickedVideoInputId.value = deviceId.trim()
    await swapLocalVideoInput(deviceId)
    if (screenSharing.value) {
      return
    }
    if (readEngineRole(options) !== 'participant' || !inCall.value) {
      return
    }
    const t = localStream.value?.getVideoTracks()[0]
    if (t && t.readyState === 'live') {
      await replaceOutboundVideoTrack(t)
    }
  }

  const MAX_CALL_CHAT = 200

  function roomStorageKey(): string {
    return normalizeDisplayName(roomId.value) || 'demo'
  }

  function remoteListenPrefsKey(peerId: string): string {
    const parts = peerId.trim().split('-')
    if (parts.length >= 2 && parts[0] === 'peer' && parts[1]) {
      return `${parts[0]}-${parts[1]}`
    }
    return peerId
  }

  function syncListenPrefsFromStorage(): void {
    remoteListenPrefs.value = loadRemoteListeningPrefs(roomStorageKey())
  }

  function persistListenPrefs(): void {
    saveRemoteListeningPrefs(roomStorageKey(), remoteListenPrefs.value)
  }

  function setRemoteListenVolume(peerId: string, volume: number): void {
    const next = new Map(remoteListenPrefs.value)
    const key = remoteListenPrefsKey(peerId)
    const prev = next.get(key) ?? next.get(peerId) ?? { volume: 1, muted: false }
    const entry = { ...prev, volume: Math.min(2, Math.max(0, volume)) }
    next.delete(peerId)
    next.set(key, entry)
    remoteListenPrefs.value = next
    persistListenPrefs()
  }

  function setRemoteListenMuted(peerId: string, muted: boolean): void {
    const next = new Map(remoteListenPrefs.value)
    const key = remoteListenPrefsKey(peerId)
    const prev = next.get(key) ?? next.get(peerId) ?? { volume: 1, muted: false }
    const entry = { ...prev, muted }
    next.delete(peerId)
    next.set(key, entry)
    remoteListenPrefs.value = next
    persistListenPrefs()
  }

  function pushCallPresence(kind: 'join' | 'leave', peerId: string): void {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const displayName = resolveParticipantDisplayName(
      peerId,
      '',
      peerId === selfPeerId.value,
      remoteDisplayNames.value,
    )
    callPresenceMessages.value = [
      ...callPresenceMessages.value,
      { id, at: Date.now(), kind, peerId, displayName },
    ].slice(-12)
  }

  const unsubProducerSyncPeerMeta = addMessageListener((data) => {
    const parsed = parseProducerSyncPayload(data as unknown)
    if (parsed?.peers && parsed.peers.length > 0) {
      session.mergeRemotePeersFromProducerSync(parsed.peers)
    }
  })

  const unsubPeerPresence = addMessageListener((data) => {
    if (!data || typeof data !== 'object') {
      return
    }
    const m = data as { type?: string; payload?: unknown }
    if (m.type === 'peer-joined') {
      const p = m.payload as { peerId?: string; displayName?: string; avatarUrl?: string }
      if (typeof p.peerId !== 'string' || p.peerId === selfPeerId.value) {
        return
      }
      const rawName = typeof p.displayName === 'string' ? normalizeDisplayName(p.displayName) : ''
      const name = rawName || p.peerId
      const av =
        typeof p.avatarUrl === 'string' && p.avatarUrl.trim().length > 0 ? p.avatarUrl.trim() : undefined
      session.upsertRemoteDisplayName(p.peerId, name, av)
      pushCallPresence('join', p.peerId)
      return
    }
    if (m.type === 'peer-left') {
      const p = m.payload as { peerId?: string }
      if (typeof p.peerId !== 'string') {
        return
      }
      const peerId = p.peerId
      pushCallPresence('leave', peerId)
      removeRemotePeer(peerId)
      if (peerHandRaised.value[peerId]) {
        const next = { ...peerHandRaised.value }
        delete next[peerId]
        peerHandRaised.value = next
      }
    }
  })

  const unsubRoomChatAndHands = addMessageListener((data) => {
    if (!data || typeof data !== 'object') {
      return
    }
    const m = data as { type?: string; payload?: unknown }
    if (m.type === 'call-chat' && m.payload && typeof m.payload === 'object') {
      const p = m.payload as Record<string, unknown>
      const peerId = typeof p.peerId === 'string' ? p.peerId : ''
      const displayName = typeof p.displayName === 'string' ? p.displayName : peerId || '—'
      const text = typeof p.text === 'string' ? p.text : ''
      const at = typeof p.at === 'number' && Number.isFinite(p.at) ? p.at : Date.now()
      if (!peerId || !normalizeDisplayName(text)) {
        return
      }
      const id = `${at}-${Math.random().toString(36).slice(2, 8)}`
      callChatMessages.value = [...callChatMessages.value, { id, peerId, displayName, text: text.slice(0, 500), at }].slice(
        -MAX_CALL_CHAT,
      )
      return
    }
    if (m.type === 'raise-hand' && m.payload && typeof m.payload === 'object') {
      const p = m.payload as Record<string, unknown>
      const peerId = typeof p.peerId === 'string' ? p.peerId : ''
      const raised = Boolean(p.raised)
      if (!peerId) {
        return
      }
      const next = { ...peerHandRaised.value }
      if (raised) {
        next[peerId] = true
      } else {
        delete next[peerId]
      }
      peerHandRaised.value = next
      if (peerId === selfPeerId.value) {
        handRaised.value = raised
      }
    }
  })

  const roomApi = { sendJson, addMessageListener, drainPendingNewProducers }

  const joining = ref(false)
  const joinError = ref<string | null>(null)
  /** When true, socket close must not trigger auto-reconnect (user left or failed join cleanup). */
  const intentionalLeave = ref(false)
  let displayNameDebounceTimer: ReturnType<typeof setTimeout> | null = null
  let unsubActiveSpeaker: (() => void) | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectFailures = 0
  const MAX_AUTO_RECONNECT = 20

  /** Snapshot after last successful `wireCallMediaAfterRoomState` (for debug overlay). */
  const lastWirePeerCount = ref(0)
  const lastWireVideoSimulcast = ref(false)

  function clearReconnectTimer(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function callJoinRoomPayload(): { roomId: string; peerId: string; displayName: string; avatarUrl?: string } {
    const av = readJoinAvatarUrl(options)
    return {
      roomId: normalizeDisplayName(roomId.value) || 'demo',
      peerId: stringValue(selfPeerId.value) || newCallTabPeerId(),
      displayName: normalizeDisplayName(selfDisplayName.value) || 'You',
      ...(av.length > 0 ? { avatarUrl: av } : {}),
    }
  }

  /**
   * After `room-state` is available: transports, consume, produce, keepalive.
   * Used on first join and after signaling reconnect.
   */
  async function wireCallMediaAfterRoomState(): Promise<void> {
    session.replaceRemoteDisplayNames(lastRoomState.value?.peers ?? [])

    const caps = lastRoomState.value?.routerRtpCapabilities
    if (!caps) {
      throw new Error('No router capabilities from room')
    }

    await loadDevice(caps)

    const d = device.value
    if (!d?.loaded) {
      throw new Error('Device failed to load')
    }

    const existing = lastRoomState.value?.existingProducers ?? []
    const peerCount = lastRoomState.value?.peers.length ?? 0
    const videoSimulcast = shouldUseVideoSimulcastForRoom(peerCount)
    lastWirePeerCount.value = peerCount
    lastWireVideoSimulcast.value = videoSimulcast

    const mode = readEngineRole(options)
    if (import.meta.env.DEV) {
      console.log('[call-qa:wire] wireCallMediaAfterRoomState', {
        mode,
        peerCount,
        videoSimulcast,
        branch:
          mode === 'participant'
            ? 'participant: create send transport, publishLocalMedia'
            : 'viewer: recv-only, no send transport, no publish',
      })
    }
    const activeCam = countActiveCameraPublishersAtWire(
      existing,
      selfPeerId.value,
      mode === 'participant' && camEnabled.value,
    )
    lastWireActiveCameraPublishers.value = activeCam
    wirePublishTier.value = resolveOutgoingVideoPublishTier({
      manualPreset: videoQualityPreset.value,
      manualExplicit: videoQualityExplicit.value,
      allowManualQuality: readAllowManualVideoQuality(options),
      activeCameraPublishersAtWire: activeCam,
    })

    await setupReceivePath(d, roomApi, existing, {
      enableVideoSpatialLayerSignaling: videoSimulcast,
    })

    unsubActiveSpeaker?.()
    unsubActiveSpeaker = addMessageListener((data) => {
      const v = parseActiveSpeakerFromServer(data)
      if (v === undefined) {
        return
      }
      setActiveSpeaker(v)
    })

    if (mode === 'participant') {
      await createSendTransport(d, roomApi)

      let stream = localStream.value
      const tracksLive =
        stream !== null && stream.getTracks().some((t) => t.readyState === 'live')
      if (!tracksLive) {
        stream = await startLocalMedia()
      }
      const toPublish = localStream.value ?? stream
      if (!toPublish || toPublish.getTracks().length === 0) {
        throw new Error('Camera/microphone not available (no tracks)')
      }
      await publishLocalMedia(toPublish, {
        videoSimulcast,
        videoPublishTier: wirePublishTier.value,
      })
      applyCamStateForOutbound()
    }

    // Merge-only producer list from server (no consumer teardown). Catches join races where
    // `new-producer` / `recv-connected` producer-sync overlapped initial `existingProducers` consume.
    try {
      sendJson({ type: 'request-producer-sync', payload: buildRequestProducerSyncPayload('soft') })
    } catch {
      /* ws closed */
    }

    startSignalingKeepAlive()
  }

  /**
   * Single-flight reconnect timer (same backoff formula for all reasons). Also used from
   * `tryReconnectSignalingAndMedia` via `'after-error'`. Policy covers the `wsStatus` watcher path;
   * joining/timer guards stay here for all callers (including tab-foreground reconnect).
   */
  function scheduleReconnectSignaling(reason: string): void {
    if (intentionalLeave.value || !inCall.value) {
      return
    }
    if (joining.value || reconnectTimer !== null) {
      return
    }
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(reconnectFailures, 5))
    console.warn('[WS] disconnected, reconnecting...', { reason, delayMs: delay })
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      void tryReconnectSignalingAndMedia()
    }, delay)
  }

  async function tryReconnectSignalingAndMedia(): Promise<void> {
    if (intentionalLeave.value || !inCall.value) {
      return
    }
    if (wsStatus.value === 'open') {
      reconnectFailures = 0
      return
    }
    if (joining.value) {
      return
    }

    joining.value = true
    joinError.value = null
    let retryLater = false
    try {
      stopSignalingKeepAlive()
      stopRemoteMedia()
      closeSendTransport()

      await roomConnect()
      const p = callJoinRoomPayload()
      joinRoom(p.roomId, p.peerId, p.displayName, p.avatarUrl)
      await waitForCondition(() => lastRoomState.value != null, 15_000)

      await wireCallMediaAfterRoomState()

      queueMicrotask(() => {
        playAllPageAudio()
      })
      reconnectFailures = 0
    } catch (e) {
      reconnectFailures += 1
      if (reconnectFailures >= MAX_AUTO_RECONNECT) {
        joinError.value = e instanceof Error ? e.message : String(e)
        intentionalLeave.value = true
        teardownMedia()
      } else {
        retryLater = true
      }
    } finally {
      joining.value = false
    }
    if (retryLater && !intentionalLeave.value && inCall.value) {
      scheduleReconnectSignaling('after-error')
    }
  }

  /** Local tile preview: driven only by {@link outboundVideoSource} + streams (see `activePreviewStream`). */
  const localSelfPreviewStream = computed<MediaStream | null>(() =>
    readEngineRole(options) !== 'participant'
      ? localStream.value
      : activePreviewStream.value,
  )

  /**
   * VAD source for the local-tile speaking highlight.
   *
   * Must **not** follow {@link localSelfPreviewStream} (which is video-preview-oriented and goes
   * `null` when outbound is `'none'`): that hid the local glow whenever the camera was off, even
   * with the mic on. The raw getUserMedia stream keeps the audio track alive across camera
   * toggles / device swaps, so we expose it explicitly under a name that documents the intent.
   *
   * Stable identity: `localStream` ref only re-assigns on start / stop / device change,
   * so `useLocalTileSpeakingVisual` reconnects its `AnalyserNode` only when the track id changes.
   */
  const localAudioSourceStream = computed<MediaStream | null>(() => localStream.value)

  function isRemoteVideoActive(
    track: MediaStreamTrack | undefined,
    source: 'camera' | 'screen',
  ): boolean {
    if (!track || track.readyState !== 'live') {
      return false
    }
    if (source === 'screen') {
      return true
    }
    // Camera: require both sender-enabled track and inbound RTP (`!muted`).
    // `enabled || !muted` was too loose (e.g. `enabled=false` + `muted=false` still showed a black tile).
    return Boolean(track.enabled && !track.muted)
  }

  const tiles = computed<CallTile[]>(() => {
    const selfId = selfPeerId.value
    const mode = readEngineRole(options)
    const joinAvatarTrim = readJoinAvatarUrl(options)

    const remotes = [...remotePeerStreams.value]
      .filter((e) => e.peerId !== selfId)
      .sort((a, b) => a.peerId.localeCompare(b.peerId))

    const remoteTiles: CallTile[] = []
    for (const { peerId, stream } of remotes) {
      if (!stream) {
        continue
      }
      const a = stream.getAudioTracks()[0]
      const v = stream.getVideoTracks()[0]
      const remoteSource = remoteVideoSourceByPeerId.value.get(peerId) ?? 'camera'
      const outboundPaused = remoteOutboundVideoPausedByPeerId.value.get(peerId) === true
      const remoteVideoOn =
        remoteSource === 'screen'
          ? isRemoteVideoActive(v, 'screen')
          : !outboundPaused && isRemoteVideoActive(v, 'camera')
      remoteTiles.push({
        peerId,
        stream,
        displayName: resolveParticipantDisplayName(peerId, '', false, remoteDisplayNames.value),
        avatarUrl: remoteAvatarUrls.value[peerId] ?? '',
        isLocal: false,
        videoEnabled: remoteVideoOn,
        audioEnabled: a ? a.enabled : true,
        /** Camera: cover in grid. Screen share (`replaceTrack`): contain so the whole desktop is visible. */
        videoFillCover: remoteSource === 'camera',
        videoPresentation: remoteSource,
        playRev: remotePeerPlayRevs.value.get(peerId) ?? 0,
        remoteListenVolume: (remoteListenPrefs.value.get(remoteListenPrefsKey(peerId)) ?? remoteListenPrefs.value.get(peerId))?.volume ?? 1,
        remoteListenMuted: (remoteListenPrefs.value.get(remoteListenPrefsKey(peerId)) ?? remoteListenPrefs.value.get(peerId))?.muted ?? false,
        handRaised: Boolean(peerHandRaised.value[peerId]),
      })
    }

    if (mode === 'viewer') {
      return remoteTiles
    }

    const list: CallTile[] = [
      {
        peerId: selfId,
        stream: localSelfPreviewStream.value,
        displayName: normalizeDisplayName(selfDisplayName.value) || 'You',
        avatarUrl: joinAvatarTrim,
        isLocal: true,
        videoEnabled: outboundVideoSource.value === 'screen' || camEnabled.value,
        audioEnabled: micEnabled.value,
        /** Webcam grid: cover. Screen share / no local video: contain or off. */
        videoFillCover: outboundVideoSource.value === 'camera' && camEnabled.value,
        videoPresentation: outboundVideoSource.value,
        playRev: localPlayRev.value,
        handRaised: handRaised.value,
      },
    ]
    list.push(...remoteTiles)
    return list
  })

  /**
   * UI highlight: derived from local Web Audio analysis of remote tile streams
   * (dominant talker with hysteresis). The same id is mirrored into recv preferred-layer ranking
   * so perceived speaker gets high simulcast before SFU `active-speaker` catches up.
   */
  const activeSpeakerTileInputs = computed<ActiveSpeakerTile[]>(() =>
    tiles.value.map((t) => ({
      peerId: t.peerId,
      stream: t.stream,
      audioEnabled: t.audioEnabled,
      excludeFromLevelAnalysis: t.isLocal,
    })),
  )
  const { activeSpeakerPeerId } = useActiveSpeaker(activeSpeakerTileInputs, inCall)

  watch(
    activeSpeakerPeerId,
    (id) => {
      setUiActiveSpeakerPeerIdForPreferredLayers(id)
    },
    { flush: 'post', immediate: true },
  )

  const callDebugSnapshot = computed(() => ({
    videoQualityPreset: videoQualityPreset.value,
    videoQualityExplicit: videoQualityExplicit.value,
    videoPublishTier: wirePublishTier.value,
    activeCameraPublishersAtWire: lastWireActiveCameraPublishers.value,
    peerCountAtWire: lastWirePeerCount.value,
    publishSimulcast: lastWireVideoSimulcast.value,
    effectiveActiveSpeakerPeerId: activeSpeakerPeerId.value ?? serverActiveSpeakerPeerId.value,
    activeSpeakerPeerId: activeSpeakerPeerId.value,
    serverActiveSpeakerPeerId: serverActiveSpeakerPeerId.value,
    receiveQualityPressure: receiveQualityPressure.value,
    receiveDeviceProfile: receiveDeviceProfile.value.profile,
    receiveAdaptiveMaxHigh: receiveDeviceProfile.value.maxHighStreams,
    receiveAdaptiveMaxMedium: receiveDeviceProfile.value.maxMediumStreams,
    receiveAllowRenderSuppression: receiveDeviceProfile.value.allowRenderSuppression,
    receiveMaxActiveRemoteVideos: receiveDeviceProfile.value.maxActiveRemoteVideos,
    receivePressureBadStreakToShift: receiveDeviceProfile.value.pressureBadStreakToShift,
    receivePreferredLayersByPeerId: lastPreferredLayerTargetsByPeerId.value,
  }))

  const sizeTier = computed<'sm' | 'md' | 'lg'>(() =>
    gridSizeTierFromParticipantCount(tiles.value.length),
  )

  const gridModifier = computed(() => {
    const n = tiles.value.length
    if (n <= 1) {
      return 'call-page__grid--1'
    }
    if (n <= 4) {
      return 'call-page__grid--4'
    }
    if (n <= 9) {
      return 'call-page__grid--9'
    }
    return 'call-page__grid--12'
  })

  if (import.meta.env.DEV) {
    watch(
      () => tiles.value,
      (list) => {
        for (const row of list) {
          if (row.isLocal) {
            continue
          }
          const v = row.stream?.getVideoTracks()[0]
          console.log('[call-engine] remote tile', {
            peerId: row.peerId,
            hasStream: Boolean(row.stream),
            videoPresentation: row.videoPresentation,
            videoEnabled: row.videoEnabled,
            videoFillCover: row.videoFillCover,
            playRev: row.playRev,
            vt: v
              ? {
                  readyState: v.readyState,
                  muted: v.muted,
                  enabled: v.enabled,
                }
              : null,
          })
        }
      },
      { deep: true, flush: 'post' },
    )
  }

  watch(
    () => lastRoomState.value?.peers,
    (list) => {
      if (list) {
        session.replaceRemoteDisplayNames(list)
      }
    },
    { deep: true },
  )

  watch(selfDisplayName, (name) => {
    if (!inCall.value) {
      return
    }
    if (displayNameDebounceTimer !== null) {
      clearTimeout(displayNameDebounceTimer)
    }
    displayNameDebounceTimer = setTimeout(() => {
      displayNameDebounceTimer = null
      sendUpdateDisplayName(normalizeDisplayName(name) || 'You')
    }, DISPLAY_NAME_DEBOUNCE_MS)
  })

  watch(roomId, () => {
    if (!inCall.value) {
      syncListenPrefsFromStorage()
    }
  })

  watch(
    () => [inCall.value, readEngineRole(options), camEnabled.value, localStream.value] as const,
    async () => {
      if (!inCall.value || readEngineRole(options) !== 'participant') {
        return
      }
      if (outboundVideoSource.value === 'screen') {
        return
      }
      applyCamStateForOutbound()
      if (stoppingScreenShare.value) {
        return
      }
      if (outboundVideoSource.value !== 'camera' || !camEnabled.value) {
        return
      }
      const t = pickOutboundCameraVideoTrack(localStream.value)
      if (!t || t.readyState !== 'live') {
        return
      }
      try {
        if (import.meta.env.DEV) {
          console.log('[call-engine] sync outbound video producer with local camera', {
            trackId: t.id,
            label: t.label,
          })
        }
        await replaceOutboundVideoTrack(t)
      } catch {
        /* producer not ready */
      }
    },
    { flush: 'post' },
  )

  /**
   * Local `track.enabled` alone does not stop RTP — remotes often keep `!muted` and draw black.
   * Mirror Meet-style camera off by pausing the **server** video producer when not screen-sharing.
   */
  watch(
    () =>
      [inCall.value, readEngineRole(options), camEnabled.value, outboundVideoSource.value] as const,
    async ([inC, role, cam, outbound]) => {
      if (!inC || role !== 'participant' || stoppingScreenShare.value) {
        return
      }
      const wantPaused = outbound !== 'screen' && !cam
      try {
        sendJson({
          type: 'set-outbound-video-paused',
          payload: { paused: wantPaused },
        })
      } catch {
        /* ws closed */
      }
    },
    { flush: 'post' },
  )

  function sendChatMessage(text: string): void {
    const t = normalizeDisplayName(text)
    if (!t || !inCall.value) {
      return
    }
    try {
      sendJson({ type: 'call-chat', payload: { text: t.slice(0, 500) } })
    } catch {
      /* ws closed */
    }
  }

  function setRaiseHand(raised: boolean): void {
    if (!inCall.value) {
      return
    }
    try {
      sendJson({ type: 'raise-hand', payload: { raised } })
      handRaised.value = raised
    } catch {
      /* ignore */
    }
  }

  function toggleRaiseHand(): void {
    setRaiseHand(!handRaised.value)
  }

  function teardownMedia(): void {
    lastPickedAudioInputId.value = ''
    lastPickedVideoInputId.value = ''
    teardownScreenShare()
    callChatMessages.value = []
    peerHandRaised.value = {}
    handRaised.value = false
    lastWirePeerCount.value = 0
    lastWireVideoSimulcast.value = false
    lastWireActiveCameraPublishers.value = 0
    callPresenceMessages.value = []
    clearReconnectTimer()
    stopSignalingKeepAlive()
    unsubActiveSpeaker?.()
    unsubActiveSpeaker = null
    stopRemoteMedia()
    stopLocalMedia()
    closeSendTransport()
    deviceReset()
    roomDisconnect()
    session.clearRemoteDisplayNames()
    session.setInCall(false)
  }

  async function joinCall(): Promise<void> {
    intentionalLeave.value = false
    reconnectFailures = 0
    clearReconnectTimer()
    joinError.value = null
    joining.value = true
    syncListenPrefsFromStorage()
    try {
      await roomConnect()
      const p = callJoinRoomPayload()
      joinRoom(p.roomId, p.peerId, p.displayName, p.avatarUrl)
      await waitForCondition(() => lastRoomState.value != null, 15_000)

      await wireCallMediaAfterRoomState()

      session.setInCall(true)
      queueMicrotask(() => {
        playAllPageAudio()
      })
    } catch (e) {
      intentionalLeave.value = true
      joinError.value = e instanceof Error ? e.message : String(e)
      teardownMedia()
    } finally {
      joining.value = false
    }
  }

  function leaveCall(): void {
    intentionalLeave.value = true
    teardownMedia()
  }

  /** Signaling socket drop → backoff reconnect. Decisions: `reconnectOrchestrationPolicy`. */
  watch(wsStatus, (st, prev) => {
    const decision = decideAfterSocketStatusChange(prev, st, {
      intentionalLeave: intentionalLeave.value,
      inCall: inCall.value,
      joining: joining.value,
      wsStatus: st,
      reconnectTimerActive: reconnectTimer !== null,
    })
    if (decision.kind === 'schedule-reconnect') {
      scheduleReconnectSignaling(decision.reason)
    }
  })

  let tabVisibleRecvResyncTimer: ReturnType<typeof setTimeout> | null = null

  /** Debounced `requestForcedProducerResync`; policy only chooses visibility vs focus vs reconnect-before-resync. */
  function scheduleRecvResyncAfterTabForeground(source: 'visibility' | 'focus'): void {
    if (intentionalLeave.value || !inCall.value) {
      return
    }
    if (wsStatus.value !== 'open') {
      return
    }
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return
    }
    if (tabVisibleRecvResyncTimer !== null) {
      clearTimeout(tabVisibleRecvResyncTimer)
    }
    tabVisibleRecvResyncTimer = setTimeout(() => {
      tabVisibleRecvResyncTimer = null
      if (intentionalLeave.value || !inCall.value || wsStatus.value !== 'open') {
        return
      }
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return
      }
      if (import.meta.env.DEV) {
        console.log('[visibility] visible → resync', { source })
      }
      requestForcedProducerResync()
    }, 200)
  }

  function onDocumentVisibilityForReconnect(): void {
    if (typeof document === 'undefined') {
      return
    }
    if (document.visibilityState !== 'visible') {
      return
    }
    const decision = decideAfterDocumentBecameVisible({
      intentionalLeave: intentionalLeave.value,
      inCall: inCall.value,
      joining: joining.value,
      wsStatus: wsStatus.value,
      reconnectTimerActive: reconnectTimer !== null,
    })
    if (decision.kind === 'noop') {
      return
    }
    if (decision.kind === 'schedule-reconnect') {
      scheduleReconnectSignaling(decision.reason)
      return
    }
    scheduleRecvResyncAfterTabForeground(decision.source)
  }

  function onWindowFocusForRecvResync(): void {
    const decision = decideAfterWindowFocus({
      intentionalLeave: intentionalLeave.value,
      inCall: inCall.value,
      joining: joining.value,
      wsStatus: wsStatus.value,
      reconnectTimerActive: reconnectTimer !== null,
    })
    if (decision.kind === 'soft-resync') {
      scheduleRecvResyncAfterTabForeground(decision.source)
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onDocumentVisibilityForReconnect)
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', onWindowFocusForRecvResync)
  }

  onScopeDispose(() => {
    unsubProducerSyncPeerMeta()
    unsubPeerPresence()
    unsubRoomChatAndHands()
    if (displayNameDebounceTimer !== null) {
      clearTimeout(displayNameDebounceTimer)
      displayNameDebounceTimer = null
    }
    if (tabVisibleRecvResyncTimer !== null) {
      clearTimeout(tabVisibleRecvResyncTimer)
      tabVisibleRecvResyncTimer = null
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onDocumentVisibilityForReconnect)
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', onWindowFocusForRecvResync)
    }
  })

  return {
    session,
    joining,
    joinError,
    joinCall,
    leaveCall,
    tiles,
    sizeTier,
    gridModifier,
    activeSpeakerPeerId,
    localAudioSourceStream,
    networkQuality,
    setNetworkQualityOverride,
    micEnabled,
    camEnabled,
    toggleMic,
    toggleCam,
    audioInputDevices,
    videoInputDevices,
    refreshMediaDevices,
    localAudioInputDeviceId,
    localVideoInputDeviceId,
    setCallAudioInputDevice,
    setCallVideoInputDevice,
    wsStatus,
    callDebugSnapshot,
    receiveQualityPressure,
    /** SFU `active-speaker` id (simulcast policy); differs from UI {@link activeSpeakerPeerId} from Web Audio. */
    serverActiveSpeakerPeerId,
    receiveDeviceProfile,
    playbackRenderFpsPressureByPeerId,
    refreshInboundVideoDebugStats: collectInboundVideoDebugStats,
    /** Remote simulcast helper: `useRemoteMedia` maps this to `set-consumer-preferred-layers` (consumers stay open). */
    setPeerVisible,
    callPresenceMessages,
    setRemoteListenVolume,
    setRemoteListenMuted,
    callChatMessages,
    sendChatMessage,
    peerHandRaised,
    handRaised,
    toggleRaiseHand,
    screenSharing,
    isCameraActive,
    isScreenActive,
    toggleScreenShare,
    /** Same WebSocket as the call; for app-level room messages (e.g. Mafia host). */
    sendSignalingMessage: sendJson,
    subscribeSignalingMessage: addMessageListener,
  }
}
