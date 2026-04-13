import { computed, onScopeDispose, ref, watch } from 'vue'
import { gridSizeTierFromParticipantCount } from './media/videoSimulcast'
import { useCallSessionStore } from './stores/callSession'
import { playAllPageAudio } from './audio/audioPlaybackUnlock'
import { useActiveSpeaker } from './audio/useActiveSpeaker'
import { useLocalMedia } from './media/useLocalMedia'
import { useMediasoupDevice } from './media/useMediasoupDevice'
import { useRemoteMedia } from './media/useRemoteMedia'
import { useRoomConnection } from './signaling/useRoomConnection'
import { useSendTransport } from './transport/useSendTransport'
import { waitForCondition } from './utils/waitForCondition'

/** Pinia session store from this package (or a compatible drop-in). */
export type CallSessionStore = ReturnType<typeof useCallSessionStore>

export type CallEngineOptions = {
  /** Overrides `VITE_SIGNALING_URL` / default WS URL. */
  signalingUrl?: string
  /**
   * Identity / room UI state. Omit to use `useCallSessionStore()` from this package.
   * Pass your own store when reusing the engine outside this app or with a custom Pinia slice.
   */
  session?: CallSessionStore
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
  refreshTick?: number
}

const DISPLAY_NAME_DEBOUNCE_MS = 400

export function useCallEngine(options?: CallEngineOptions) {
  const session = options?.session ?? useCallSessionStore()

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
  } = useRoomConnection(options?.signalingUrl)

  const { device, loadDevice, reset: deviceReset } = useMediasoupDevice()
  const { createSendTransport, closeSendTransport, publishLocalMedia } = useSendTransport()
  const {
    localStream,
    localPlayRev,
    micEnabled,
    camEnabled,
    startLocalMedia,
    stopLocalMedia,
    toggleMic,
    toggleCam,
  } = useLocalMedia()
  const {
    remotePeerStreams,
    remotePlayRev,
    remoteVideoRefreshTick,
    setupReceivePath,
    stopRemoteMedia,
    setVideoConsumerGridTier,
  } = useRemoteMedia()

  const roomApi = { sendJson, addMessageListener, drainPendingNewProducers }

  const joining = ref(false)
  const joinError = ref<string | null>(null)
  let displayNameDebounceTimer: ReturnType<typeof setTimeout> | null = null

  const tiles = computed<CallTile[]>(() => {
    const selfId = session.selfPeerId
    const list: CallTile[] = [
      {
        peerId: selfId,
        stream: localStream.value,
        displayName: session.selfDisplayName.trim() || 'You',
        isLocal: true,
        videoEnabled: camEnabled.value,
        audioEnabled: micEnabled.value,
        playRev: localPlayRev.value,
      },
    ]

    const remotes = [...remotePeerStreams.value]
      .filter((e) => e.peerId !== selfId)
      .sort((a, b) => a.peerId.localeCompare(b.peerId))

    for (const { peerId, stream } of remotes) {
      const a = stream.getAudioTracks()[0]
      const v = stream.getVideoTracks()[0]
      list.push({
        peerId,
        stream,
        displayName: session.labelFor(peerId),
        isLocal: false,
        videoEnabled: v ? v.enabled : false,
        audioEnabled: a ? a.enabled : true,
        playRev: remotePlayRev.value,
        refreshTick: remoteVideoRefreshTick.value,
      })
    }

    return list
  })

  const { activeSpeakerPeerId } = useActiveSpeaker(
    computed(() =>
      tiles.value.map((t) => ({
        peerId: t.peerId,
        stream: t.stream,
        audioEnabled: t.audioEnabled,
        excludeFromLevelAnalysis: t.isLocal,
      })),
    ),
    computed(() => session.inCall),
  )

  const sizeTier = computed<'sm' | 'md' | 'lg'>(() =>
    gridSizeTierFromParticipantCount(tiles.value.length),
  )

  watch(
    () => [sizeTier.value, session.inCall] as const,
    ([tier, inCall]) => {
      if (!inCall) {
        return
      }
      setVideoConsumerGridTier(tier)
    },
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

  watch(
    () => session.selfDisplayName,
    (name) => {
      if (!session.inCall) {
        return
      }
      if (displayNameDebounceTimer !== null) {
        clearTimeout(displayNameDebounceTimer)
      }
      displayNameDebounceTimer = setTimeout(() => {
        displayNameDebounceTimer = null
        sendUpdateDisplayName(name.trim() || 'You')
      }, DISPLAY_NAME_DEBOUNCE_MS)
    },
  )

  onScopeDispose(() => {
    if (displayNameDebounceTimer !== null) {
      clearTimeout(displayNameDebounceTimer)
      displayNameDebounceTimer = null
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

  function teardownMedia(): void {
    stopRemoteMedia()
    stopLocalMedia()
    closeSendTransport()
    deviceReset()
    roomDisconnect()
    session.clearRemoteDisplayNames()
    session.setInCall(false)
  }

  async function joinCall(): Promise<void> {
    joinError.value = null
    joining.value = true
    try {
      await roomConnect()
      joinRoom(
        session.roomId.trim() || 'demo',
        session.selfPeerId,
        session.selfDisplayName.trim() || 'You',
      )
      await waitForCondition(() => lastRoomState.value != null, 15_000)

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
      await setupReceivePath(d, roomApi, existing)
      await createSendTransport(d, roomApi)

      const stream = await startLocalMedia()
      if (!localStream.value || stream.getTracks().length === 0) {
        throw new Error('Camera/microphone not available (no tracks)')
      }
      await publishLocalMedia(stream)

      session.setInCall(true)
      queueMicrotask(() => {
        playAllPageAudio()
      })
    } catch (e) {
      joinError.value = e instanceof Error ? e.message : String(e)
      teardownMedia()
    } finally {
      joining.value = false
    }
  }

  function leaveCall(): void {
    teardownMedia()
  }

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
    micEnabled,
    camEnabled,
    toggleMic,
    toggleCam,
    wsStatus,
  }
}
