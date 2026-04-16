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
import {
  countActiveCameraPublishersAtWire,
  resolveOutgoingVideoPublishTier,
  type VideoPublishTier,
} from './media/videoQualityPreset'
import { shouldUseVideoSimulcastForRoom } from './media/videoSimulcast'
import { useSendTransport } from './transport/useSendTransport'
import { waitForCondition } from './utils/waitForCondition'
import { newCallTabPeerId } from './utils/callTabPeerId'

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
}

/** One grid tile: dumb UI maps this to `ParticipantTile`. */
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
}

export type CallChatLine = {
  id: string
  peerId: string
  displayName: string
  text: string
  at: number
}

const DISPLAY_NAME_DEBOUNCE_MS = 400

function trimmedString(v: unknown): string {
  if (typeof v === 'string') {
    return v.trim()
  }
  if (v == null) {
    return ''
  }
  return String(v).trim()
}

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

export function useCallEngine(options?: CallEngineOptions) {
  if (getActivePinia() === undefined) {
    throw new Error(
      'useCallEngine requires an active Pinia app (call app.use(createPinia()) before mount). If you use a workspace package, ensure Vite resolve.dedupe includes "pinia" and "vue" so there is only one Pinia instance.',
    )
  }

  const session = options?.session ?? useCallSessionStore()
  const { roomId, selfPeerId, selfDisplayName, inCall, videoQualityPreset, videoQualityExplicit } =
    storeToRefs(session)

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
    toggleCam,
    swapLocalAudioInput,
    swapLocalVideoInput,
  } = useLocalMedia({
    getVideoPublishTier: () => wirePublishTier.value,
  })

  /** When `getSettings().deviceId` is empty (some drivers), keep menu highlight on last explicit pick. */
  const lastPickedAudioInputId = ref('')
  const lastPickedVideoInputId = ref('')

  const localAudioInputDeviceId = computed(() => {
    const t = localStream.value?.getAudioTracks()[0]
    const id = t?.getSettings?.()?.deviceId
    if (typeof id === 'string' && id.length > 0) {
      return id
    }
    return lastPickedAudioInputId.value
  })

  const localVideoInputDeviceId = computed(() => {
    const t = localStream.value?.getVideoTracks()[0]
    const id = t?.getSettings?.()?.deviceId
    if (typeof id === 'string' && id.length > 0) {
      return id
    }
    return lastPickedVideoInputId.value
  })

  const {
    remotePeerStreams,
    remotePeerPlayRevs,
    remoteVideoSourceByPeerId,
    activeSpeakerPeerId,
    networkQuality,
    setupReceivePath,
    stopRemoteMedia,
    setActiveSpeaker,
    setNetworkQualityOverride,
    collectInboundVideoDebugStats,
    removeRemotePeer,
    requestForcedProducerResync,
  } = useRemoteMedia()

  const remoteListenPrefs = shallowRef(new Map<string, RemoteListenEntry>())
  const callPresenceMessages = ref<{ id: string; at: number; kind: 'join' | 'leave'; displayName: string }[]>([])

  const callChatMessages = ref<CallChatLine[]>([])
  const peerHandRaised = ref<Record<string, boolean>>({})
  /** Local user's raised-hand flag (also echoed from server). */
  const handRaised = ref(false)
  const screenSharing = ref(false)
  const screenShareStream = shallowRef<MediaStream | null>(null)
  let detachScreenShareEndedListener: (() => void) | null = null
  let stoppingScreenShare = false

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
    return trimmedString(roomId.value) || 'demo'
  }

  function syncListenPrefsFromStorage(): void {
    remoteListenPrefs.value = loadRemoteListeningPrefs(roomStorageKey())
  }

  function persistListenPrefs(): void {
    saveRemoteListeningPrefs(roomStorageKey(), remoteListenPrefs.value)
  }

  function setRemoteListenVolume(peerId: string, volume: number): void {
    const next = new Map(remoteListenPrefs.value)
    const cur = next.get(peerId) ?? { volume: 1, muted: false }
    cur.volume = Math.min(2, Math.max(0, volume))
    next.set(peerId, cur)
    remoteListenPrefs.value = next
    persistListenPrefs()
  }

  function setRemoteListenMuted(peerId: string, muted: boolean): void {
    const next = new Map(remoteListenPrefs.value)
    const cur = next.get(peerId) ?? { volume: 1, muted: false }
    cur.muted = muted
    next.set(peerId, cur)
    remoteListenPrefs.value = next
    persistListenPrefs()
  }

  function pushCallPresence(kind: 'join' | 'leave', displayName: string): void {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    callPresenceMessages.value = [...callPresenceMessages.value, { id, at: Date.now(), kind, displayName }].slice(-12)
  }

  const unsubPeerPresence = addMessageListener((data) => {
    if (!data || typeof data !== 'object') {
      return
    }
    const m = data as { type?: string; payload?: unknown }
    if (m.type === 'peer-joined') {
      const p = m.payload as { peerId?: string; displayName?: string }
      if (typeof p.peerId !== 'string' || p.peerId === selfPeerId.value) {
        return
      }
      const name =
        typeof p.displayName === 'string' && p.displayName.trim() ? p.displayName.trim() : p.peerId
      pushCallPresence('join', name)
      return
    }
    if (m.type === 'peer-left') {
      const p = m.payload as { peerId?: string }
      if (typeof p.peerId !== 'string') {
        return
      }
      const peerId = p.peerId
      const name =
        lastRoomState.value?.peers.find((x) => x.peerId === peerId)?.displayName ?? session.labelFor(peerId)
      pushCallPresence('leave', name)
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
      if (!peerId || !text.trim()) {
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

  const callDebugSnapshot = computed(() => ({
    videoQualityPreset: videoQualityPreset.value,
    videoQualityExplicit: videoQualityExplicit.value,
    videoPublishTier: wirePublishTier.value,
    activeCameraPublishersAtWire: lastWireActiveCameraPublishers.value,
    peerCountAtWire: lastWirePeerCount.value,
    publishSimulcast: lastWireVideoSimulcast.value,
    activeSpeakerPeerId: activeSpeakerPeerId.value,
  }))

  function clearReconnectTimer(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function callJoinRoomPayload(): { roomId: string; peerId: string; displayName: string } {
    return {
      roomId: trimmedString(roomId.value) || 'demo',
      peerId: stringValue(selfPeerId.value) || newCallTabPeerId(),
      displayName: trimmedString(selfDisplayName.value) || 'You',
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
    }

    // Merge-only producer list from server (no consumer teardown). Catches join races where
    // `new-producer` / `recv-connected` producer-sync overlapped initial `existingProducers` consume.
    try {
      sendJson({ type: 'request-producer-sync', payload: { resetConsumers: false } })
    } catch {
      /* ws closed */
    }

    startSignalingKeepAlive()
  }

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
      joinRoom(p.roomId, p.peerId, p.displayName)
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

  /**
   * Local tile preview: must follow the **same** video track as outbound `replaceTrack`, not only
   * `localStream` (camera). Use `screenShareStream` as soon as display capture exists — `screenSharing`
   * is toggled for UI and may lag behind `replaceTrack`, which caused a black local tile.
   */
  const localSelfPreviewStream = computed<MediaStream | null>(() => {
    if (readEngineRole(options) !== 'participant') {
      return localStream.value
    }
    const dm = screenShareStream.value
    const vt = dm?.getVideoTracks()[0]
    if (vt && vt.readyState === 'live') {
      // Preview the original display-capture stream directly. Re-wrapping the track into a synthetic
      // MediaStream was causing black local previews in some browsers while outbound replaceTrack worked.
      return dm
    }
    return localStream.value
  })

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
      remoteTiles.push({
        peerId,
        stream,
        displayName: session.labelFor(peerId),
        isLocal: false,
        videoEnabled: isRemoteVideoActive(v, remoteSource),
        audioEnabled: a ? a.enabled : true,
        /** Camera: cover in grid. Screen share (`replaceTrack`): contain so the whole desktop is visible. */
        videoFillCover: remoteSource === 'camera',
        playRev: remotePeerPlayRevs.value.get(peerId) ?? 0,
        remoteListenVolume: remoteListenPrefs.value.get(peerId)?.volume ?? 1,
        remoteListenMuted: remoteListenPrefs.value.get(peerId)?.muted ?? false,
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
        displayName: trimmedString(selfDisplayName.value) || 'You',
        isLocal: true,
        videoEnabled: screenSharing.value || camEnabled.value,
        audioEnabled: micEnabled.value,
        /** Webcam grid: cover. Screen capture: same as remote — contain. */
        videoFillCover: !screenSharing.value && camEnabled.value,
        playRev: localPlayRev.value,
        handRaised: handRaised.value,
      },
    ]
    list.push(...remoteTiles)
    return list
  })

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
      sendUpdateDisplayName(trimmedString(name) || 'You')
    }, DISPLAY_NAME_DEBOUNCE_MS)
  })

  watch(roomId, () => {
    if (!inCall.value) {
      syncListenPrefsFromStorage()
    }
  })

  if (import.meta.env.DEV) {
    watch(
      () => localStream.value,
      (s) => {
        console.log('[localTile] localStream', s)
        console.log('[localTile] videoTracks', s?.getVideoTracks())
        console.log('[localTile] audioTracks', s?.getAudioTracks())
      },
      { immediate: true },
    )
    watch(
      () => localPlayRev.value,
      (v) => {
        console.log('[localTile] localPlayRev', v)
      },
      { immediate: true },
    )
  }

  async function stopScreenShare(): Promise<void> {
    if (stoppingScreenShare) {
      return
    }
    const dm = screenShareStream.value
    const wasSharing = screenSharing.value
    if (!dm && !wasSharing) {
      return
    }
    stoppingScreenShare = true
    detachScreenShareEndedListener?.()
    detachScreenShareEndedListener = null

    // Swap the outbound producer back to the camera *before* stopping display tracks,
    // otherwise the producer can briefly reference an `ended` track and remotes/self glitch.
    try {
      if (wasSharing) {
        screenSharing.value = false
        try {
          const cam = localStream.value?.getVideoTracks().find((x) => x.readyState === 'live')
          if (cam) {
            const producerId = await replaceOutboundVideoTrack(cam)
            await nextTick()
            try {
              sendJson({ type: 'producer-video-source', payload: { producerId, source: 'camera' } })
            } catch {
              /* ws closed */
            }
          }
        } catch {
          /* producer may already be torn down */
        }
      }

      if (dm) {
        for (const t of dm.getTracks()) {
          t.stop()
        }
      }
      screenShareStream.value = null
      localPlayRev.value += 1
    } finally {
      stoppingScreenShare = false
    }
  }

  async function toggleScreenShare(): Promise<void> {
    if (readEngineRole(options) !== 'participant' || !inCall.value) {
      return
    }
    if (screenSharing.value) {
      await stopScreenShare()
      return
    }
    try {
      const dm = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      if (import.meta.env.DEV) {
        console.log('[screen-share] SCREEN STREAM', dm)
      }
      const vt = dm.getVideoTracks()[0]
      if (import.meta.env.DEV) {
        console.log('[screen-share] SCREEN TRACK', vt)
      }
      if (!vt) {
        for (const x of dm.getTracks()) {
          x.stop()
        }
        return
      }
      screenShareStream.value = dm
      detachScreenShareEndedListener?.()
      const onEnded = () => {
        void stopScreenShare()
      }
      vt.addEventListener('ended', onEnded, { once: true })
      detachScreenShareEndedListener = () => {
        vt.removeEventListener('ended', onEnded)
      }
      screenSharing.value = true
      localPlayRev.value += 1
      await nextTick()
      if (import.meta.env.DEV) {
        console.log('[screen-share] PRODUCING SCREEN (replaceTrack)', vt.id)
      }
      const producerId = await replaceOutboundVideoTrack(vt)
      await nextTick()
      try {
        sendJson({ type: 'producer-video-source', payload: { producerId, source: 'screen' } })
      } catch {
        /* ws closed */
      }
      localPlayRev.value += 1
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[screen-share] start failed', e)
      }
      const orphan = screenShareStream.value
      if (orphan) {
        for (const t of orphan.getTracks()) {
          t.stop()
        }
      }
      detachScreenShareEndedListener?.()
      detachScreenShareEndedListener = null
      screenShareStream.value = null
      screenSharing.value = false
      stoppingScreenShare = false
    }
  }

  /**
   * Local `track.enabled` alone does not stop RTP — remotes often keep `!muted` and draw black.
   * Mirror Meet-style camera off by pausing the **server** video producer when not screen-sharing.
   */
  watch(
    () =>
      [inCall.value, readEngineRole(options), camEnabled.value, screenSharing.value] as const,
    async ([inC, role, cam, screen]) => {
      if (!inC || role !== 'participant' || stoppingScreenShare) {
        return
      }
      const wantPaused = !screen && !cam
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
    const t = trimmedString(text)
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
    detachScreenShareEndedListener?.()
    detachScreenShareEndedListener = null
    for (const t of screenShareStream.value?.getTracks() ?? []) {
      t.stop()
    }
    screenShareStream.value = null
    screenSharing.value = false
    stoppingScreenShare = false
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
      joinRoom(p.roomId, p.peerId, p.displayName)
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

  watch(wsStatus, (st, prev) => {
    if (intentionalLeave.value || !inCall.value) {
      return
    }
    if (prev === 'open' && (st === 'closed' || st === 'error')) {
      scheduleReconnectSignaling('socket-not-open')
    }
  })

  let tabVisibleRecvResyncTimer: ReturnType<typeof setTimeout> | null = null

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
    if (intentionalLeave.value || !inCall.value) {
      return
    }
    if (wsStatus.value !== 'open') {
      scheduleReconnectSignaling('tab-visible-again')
      return
    }
    scheduleRecvResyncAfterTabForeground('visibility')
  }

  function onWindowFocusForRecvResync(): void {
    scheduleRecvResyncAfterTabForeground('focus')
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onDocumentVisibilityForReconnect)
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', onWindowFocusForRecvResync)
  }

  onScopeDispose(() => {
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
    refreshInboundVideoDebugStats: collectInboundVideoDebugStats,
    callPresenceMessages,
    setRemoteListenVolume,
    setRemoteListenMuted,
    callChatMessages,
    sendChatMessage,
    peerHandRaised,
    handRaised,
    toggleRaiseHand,
    screenSharing,
    toggleScreenShare,
  }
}
