<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useCallSessionStore } from '../../stores/callSession'
import { playAllPageAudio } from '../../features/room/audioPlaybackUnlock'
import { useActiveSpeaker } from '../../features/room/useActiveSpeaker'
import { useLocalMedia } from '../../features/room/useLocalMedia'
import { useMediasoupDevice } from '../../features/room/useMediasoupDevice'
import { useRemoteMedia } from '../../features/room/useRemoteMedia'
import { useRoomConnection } from '../../features/room/useRoomConnection'
import { useSendTransport } from '../../features/room/useSendTransport'
import { waitForCondition } from '../../features/room/waitForCondition'
import ParticipantTile from './ParticipantTile.vue'

const session = useCallSessionStore()

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
} = useRoomConnection()

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
const { remotePeerStreams, remotePlayRev, remoteVideoRefreshTick, setupReceivePath, stopRemoteMedia } =
  useRemoteMedia()

const roomApi = { sendJson, addMessageListener, drainPendingNewProducers }

const joining = ref(false)
const joinError = ref<string | null>(null)

const DISPLAY_NAME_DEBOUNCE_MS = 400
let displayNameDebounceTimer: ReturnType<typeof setTimeout> | null = null

type TileModel = {
  peerId: string
  stream: MediaStream | null
  displayName: string
  isLocal: boolean
  videoEnabled: boolean
  audioEnabled: boolean
  playRev?: number
  refreshTick?: number
}

const tiles = computed<TileModel[]>(() => {
  const selfId = session.selfPeerId
  const list: TileModel[] = [
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
    })),
  ),
  computed(() => session.inCall),
)

const sizeTier = computed<'sm' | 'md' | 'lg'>(() => {
  const n = tiles.value.length
  if (n <= 4) {
    return 'lg'
  }
  if (n <= 9) {
    return 'md'
  }
  return 'sm'
})

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

watch(
  () => localStream.value,
  (s) => {
    if (!import.meta.env.DEV) {
      return
    }
    console.log('[localTile] localStream', s)
    console.log('[localTile] videoTracks', s?.getVideoTracks())
    console.log('[localTile] audioTracks', s?.getAudioTracks())
  },
  { immediate: true },
)

watch(
  () => localPlayRev.value,
  (v) => {
    if (import.meta.env.DEV) {
      console.log('[localTile] localPlayRev', v)
    }
  },
  { immediate: true },
)

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
</script>

<template>
  <div class="call-page" :class="{ 'call-page--prejoin': !session.inCall }">
    <div class="call-page__shell">
      <header class="call-page__header">
        <h1 class="call-page__title">Video call</h1>
        <p v-if="!session.inCall" class="call-page__hint">
          One tap joins the room, sets up transports, camera and mic.
        </p>
      </header>

      <section v-if="!session.inCall" class="call-page__pre">
        <label class="call-page__field">
          <span>Room</span>
          <input v-model="session.roomId" type="text" autocomplete="off" placeholder="demo" />
        </label>
        <label class="call-page__field">
          <span>Your name</span>
          <input v-model="session.selfDisplayName" type="text" autocomplete="name" placeholder="You" />
        </label>
        <p v-if="joinError" class="call-page__error" role="alert">{{ joinError }}</p>
        <p class="call-page__meta">WS: {{ wsStatus }}</p>
        <button
          type="button"
          class="call-page__btn call-page__btn--primary"
          :disabled="joining"
          @click="joinCall"
        >
          {{ joining ? 'Joining…' : 'Join call' }}
        </button>
      </section>

      <section v-else class="call-page__active">
        <div class="call-page__toolbar">
          <button type="button" class="call-page__btn" @click="leaveCall">Leave</button>
          <button
            type="button"
            class="call-page__btn"
            :class="{ 'call-page__btn--muted': !micEnabled }"
            @click="toggleMic"
          >
            {{ micEnabled ? 'Mute mic' : 'Unmute' }}
          </button>
          <button
            type="button"
            class="call-page__btn"
            :class="{ 'call-page__btn--muted': !camEnabled }"
            @click="toggleCam"
          >
            {{ camEnabled ? 'Camera off' : 'Camera on' }}
          </button>
        </div>

        <div class="call-page__grid" :class="gridModifier">
          <ParticipantTile
            v-for="t in tiles"
            :key="t.peerId"
            :display-name="t.displayName"
            :stream="t.stream"
            :is-local="t.isLocal"
            :video-enabled="t.videoEnabled"
            :audio-enabled="t.audioEnabled"
            :play-rev="t.playRev"
            :refresh-tick="t.refreshTick"
            :size-tier="sizeTier"
            :active-speaker="activeSpeakerPeerId === t.peerId"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.call-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background: var(--bg);
  color: var(--text);
}

.call-page__shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 1rem 1.25rem 2rem;
  box-sizing: border-box;
}

.call-page--prejoin .call-page__shell {
  justify-content: center;
  align-items: center;
}

.call-page__header {
  margin-bottom: 1rem;
  width: 100%;
}

.call-page--prejoin .call-page__header {
  text-align: center;
  max-width: 420px;
  margin-bottom: 1.5rem;
}

.call-page__title {
  margin: 0 0 0.35rem;
  font-size: 1.35rem;
  color: var(--text-h);
}

.call-page__hint {
  margin: 0;
  font-size: 0.9rem;
  opacity: 0.85;
}

.call-page__pre {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 420px;
}

.call-page__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
}

.call-page__field input {
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text-h);
  font: inherit;
}

.call-page__error {
  margin: 0;
  color: #f87171;
  font-size: 0.9rem;
}

.call-page__meta {
  margin: 0;
  font-size: 0.8rem;
  opacity: 0.7;
  font-family: var(--mono, monospace);
}

.call-page__btn {
  padding: 0.55rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--code-bg);
  color: var(--text-h);
  font: inherit;
  cursor: pointer;
}

.call-page__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.call-page__btn--primary {
  background: var(--accent);
  color: #fff;
  border-color: transparent;
}

.call-page__btn--muted {
  opacity: 0.75;
}

.call-page__active {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
  width: 100%;
}

.call-page__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.call-page__grid {
  display: grid;
  gap: 0.75rem;
  flex: 1;
  min-height: 0;
  align-content: start;
}

.call-page__grid--1 {
  grid-template-columns: 1fr;
  max-width: 920px;
  margin: 0 auto;
  width: 100%;
}

.call-page__grid--4 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.call-page__grid--9 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.call-page__grid--12 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

@media (max-width: 720px) {
  .call-page__grid--4,
  .call-page__grid--9,
  .call-page__grid--12 {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 721px) and (max-width: 1100px) {
  .call-page__grid--9,
  .call-page__grid--12 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
