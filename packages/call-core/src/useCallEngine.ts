import { getActivePinia, storeToRefs } from 'pinia'
import { computed, onScopeDispose, ref, watch } from 'vue'
import { gridSizeTierFromParticipantCount } from './media/gridTier'
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
  /** Overrides `VITE_SIGNALING_URL`. Use a DNS-only host (e.g. media.example.com) if the SPA is behind a CDN proxy. */
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

export function useCallEngine(options?: CallEngineOptions) {
  if (getActivePinia() === undefined) {
    throw new Error(
      'useCallEngine requires an active Pinia app (call app.use(createPinia()) before mount). If you use a workspace package, ensure Vite resolve.dedupe includes "pinia" and "vue" so there is only one Pinia instance.',
    )
  }

  const session = options?.session ?? useCallSessionStore()
  const { roomId, selfPeerId, selfDisplayName, inCall } = storeToRefs(session)

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
  const { remotePeerStreams, remotePeerPlayRevs, setupReceivePath, stopRemoteMedia } = useRemoteMedia()

  const roomApi = { sendJson, addMessageListener, drainPendingNewProducers }

  const joining = ref(false)
  const joinError = ref<string | null>(null)
  let displayNameDebounceTimer: ReturnType<typeof setTimeout> | null = null

  const tiles = computed<CallTile[]>(() => {
    const selfId = selfPeerId.value
    const list: CallTile[] = [
      {
        peerId: selfId,
        stream: localStream.value,
        displayName: trimmedString(selfDisplayName.value) || 'You',
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
      if (!stream) {
        continue
      }
      const a = stream.getAudioTracks()[0]
      const v = stream.getVideoTracks()[0]
      list.push({
        peerId,
        stream,
        displayName: session.labelFor(peerId),
        isLocal: false,
        videoEnabled: v ? v.enabled : false,
        audioEnabled: a ? a.enabled : true,
        playRev: remotePeerPlayRevs.value.get(peerId) ?? 0,
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
    computed(() => inCall.value),
  )

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
        trimmedString(roomId.value) || 'demo',
        stringValue(selfPeerId.value) || `peer-${Math.random().toString(36).slice(2, 10)}`,
        trimmedString(selfDisplayName.value) || 'You',
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
