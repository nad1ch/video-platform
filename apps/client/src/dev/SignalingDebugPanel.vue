<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  useLocalMedia,
  useMediasoupDevice,
  useRemoteMedia,
  useRoomConnection,
  useSendTransport,
} from 'call-core'
import StreamVideo from '../components/StreamVideo.vue'

const roomId = ref('demo')
const peerId = ref('peer-1')
const busy = ref(false)
const logs = ref<{ at: number; line: string }[]>([])

const {
  peers,
  wsStatus,
  lastRoomState,
  connect: roomConnect,
  joinRoom,
  disconnect: roomDisconnect,
  sendJson,
  addMessageListener,
  drainPendingNewProducers,
} = useRoomConnection()

const { device, loaded: deviceLoaded, loadDevice, reset: deviceReset } = useMediasoupDevice()
const { sendTransport, createSendTransport, closeSendTransport, publishLocalMedia } = useSendTransport()
const { localStream, startLocalMedia, stopLocalMedia } = useLocalMedia()
const {
  remotePeerStreams,
  remotePeerPlayRevs,
  recvTransport,
  setupReceivePath,
  stopRemoteMedia,
} = useRemoteMedia()

const peersDisplay = computed(() => JSON.stringify([...peers.value]))

const MAX_LOG = 300

function pushLog(line: string): void {
  logs.value = [...logs.value.slice(-(MAX_LOG - 1)), { at: Date.now(), line }]
}

const capsOk = computed(() => lastRoomState.value?.routerRtpCapabilities != null)

const sendTransportOpen = computed(() => {
  const t = sendTransport.value
  return !!t && !t.closed
})

const recvTransportOpen = computed(() => {
  const t = recvTransport.value
  return !!t && !t.closed
})

let unsubscribeMessages: (() => void) | null = null

function attachLogListener(): void {
  unsubscribeMessages?.()
  unsubscribeMessages = addMessageListener((data) => {
    if (!data || typeof data !== 'object' || !('type' in data)) {
      return
    }
    const type = String((data as { type: unknown }).type)
    if (
      type === 'room-state' ||
      type === 'peer-joined' ||
      type === 'peer-left' ||
      type === 'transport-created' ||
      type === 'transport-connected' ||
      type === 'produced' ||
      type === 'new-producer' ||
      type === 'consumed' ||
      type === 'producer-sync' ||
      type === 'peer-display-name' ||
      type === 'consume-failed'
    ) {
      try {
        pushLog(`[ws] ${type} ${JSON.stringify(data)}`)
      } catch {
        pushLog(`[ws] ${type}`)
      }
    }
  })
}

onMounted(() => {
  attachLogListener()
})

onBeforeUnmount(() => {
  unsubscribeMessages?.()
  unsubscribeMessages = null
})

async function onConnect(): Promise<void> {
  busy.value = true
  try {
    await roomConnect()
    attachLogListener()
    pushLog('connected (WS open)')
  } catch (e) {
    pushLog(`error: connect — ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    busy.value = false
  }
}

function onJoin(): void {
  if (wsStatus.value !== 'open') {
    pushLog('error: join — WebSocket not open (connect first)')
    return
  }
  try {
    joinRoom(roomId.value.trim() || 'demo', peerId.value.trim() || 'peer-1', 'Debug client')
    pushLog(`join-room sent (${roomId.value} / ${peerId.value})`)
  } catch (e) {
    pushLog(`error: join — ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function onLoadDevice(): Promise<void> {
  const caps = lastRoomState.value?.routerRtpCapabilities
  if (!caps) {
    pushLog('error: load device — no routerRtpCapabilities (join room first)')
    return
  }
  busy.value = true
  try {
    await loadDevice(caps)
    pushLog('device loaded')
  } catch (e) {
    pushLog(`error: loadDevice — ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    busy.value = false
  }
}

async function onCreateSendTransport(): Promise<void> {
  const d = device.value
  if (!d?.loaded) {
    pushLog('error: create send transport — device not loaded')
    return
  }
  busy.value = true
  try {
    await createSendTransport(d, {
      sendJson,
      addMessageListener,
    })
    pushLog('send transport created + connect completed')
  } catch (e) {
    pushLog(`error: createSendTransport — ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    busy.value = false
  }
}

async function onSetupReceive(): Promise<void> {
  const d = device.value
  if (!d?.loaded) {
    pushLog('error: setup receive — device not loaded')
    return
  }
  busy.value = true
  try {
    const existing = lastRoomState.value?.existingProducers ?? []
    await setupReceivePath(d, { sendJson, addMessageListener, drainPendingNewProducers }, existing)
    pushLog('receive path ready (room-state + drained early new-producer buffer)')
  } catch (e) {
    pushLog(`error: setupReceive — ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    busy.value = false
  }
}

async function onPublishLocal(): Promise<void> {
  const d = device.value
  if (!d?.loaded || !sendTransport.value || sendTransport.value.closed) {
    pushLog('error: publish — need loaded device + active send transport')
    return
  }
  busy.value = true
  try {
    const stream = await startLocalMedia()
    await publishLocalMedia(stream)
    pushLog('local camera/mic published')
  } catch (e) {
    pushLog(`error: publishLocal — ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    busy.value = false
  }
}

function onDisconnect(): void {
  try {
    stopRemoteMedia()
    stopLocalMedia()
    closeSendTransport()
    deviceReset()
    roomDisconnect()
    attachLogListener()
    pushLog('disconnected (local cleanup)')
  } catch (e) {
    pushLog(`error: disconnect — ${e instanceof Error ? e.message : String(e)}`)
  }
}

function clearLogs(): void {
  logs.value = []
}
</script>

<template>
  <div class="sdp">
    <h2 class="sdp-title">Signaling debug (dev only)</h2>

    <fieldset class="sdp-field">
      <legend>Inputs</legend>
      <label>roomId <input v-model="roomId" type="text" autocomplete="off" /></label>
      <label>peerId <input v-model="peerId" type="text" autocomplete="off" /></label>
    </fieldset>

    <fieldset class="sdp-field">
      <legend>Actions</legend>
      <button type="button" :disabled="busy" @click="onConnect">Connect</button>
      <button type="button" :disabled="busy" @click="onJoin">Join room</button>
      <button type="button" :disabled="busy" @click="onLoadDevice">Load device</button>
      <button type="button" :disabled="busy" @click="onCreateSendTransport">Create send transport</button>
      <button type="button" :disabled="busy" @click="onSetupReceive">Setup receive (recv + consume)</button>
      <button type="button" :disabled="busy" @click="onPublishLocal">Start camera &amp; publish</button>
      <button type="button" :disabled="busy" @click="onDisconnect">Disconnect</button>
      <button type="button" @click="clearLogs">Clear logs</button>
    </fieldset>

    <fieldset class="sdp-field">
      <legend>Video</legend>
      <p class="sdp-hint">Local (muted)</p>
      <StreamVideo :stream="localStream" :muted="true" />
      <p class="sdp-hint">Remote ({{ remotePeerStreams.length }})</p>
      <div class="sdp-remote-row">
        <StreamVideo
          v-for="e in remotePeerStreams"
          :key="e.peerId"
          :stream="e.stream"
          :muted="false"
          :play-rev="remotePeerPlayRevs.get(e.peerId) ?? 0"
        />
      </div>
    </fieldset>

    <fieldset class="sdp-field">
      <legend>Status</legend>
      <ul class="sdp-status">
        <li>WebSocket: {{ wsStatus }}</li>
        <li>Peers: {{ peersDisplay }}</li>
        <li>routerRtpCapabilities: {{ capsOk ? 'yes' : 'no' }}</li>
        <li>Device loaded: {{ deviceLoaded }}</li>
        <li>Send transport active: {{ sendTransportOpen }}</li>
        <li>Recv transport active: {{ recvTransportOpen }}</li>
      </ul>
    </fieldset>

    <fieldset class="sdp-field sdp-log-wrap">
      <legend>Event log</legend>
      <ul class="sdp-log">
        <li v-for="(row, i) in logs" :key="row.at + '-' + i" class="sdp-log-line">
          <span class="sdp-log-ts">{{ new Date(row.at).toISOString() }}</span>
          {{ row.line }}
        </li>
      </ul>
    </fieldset>
  </div>
</template>

<style scoped>
.sdp {
  font-family: system-ui, sans-serif;
  max-width: 960px;
  margin: 0 auto 2rem;
  padding: 0.75rem;
  border: 1px solid #444;
  background: #1a1a1a;
  color: #e0e0e0;
}
.sdp-title {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
}
.sdp-field {
  margin-bottom: 0.75rem;
}
.sdp-field label {
  display: block;
  margin: 0.25rem 0;
}
.sdp-field input[type='text'] {
  margin-left: 0.35rem;
  width: min(280px, 100%);
}
.sdp-field button {
  margin: 0.25rem 0.35rem 0.25rem 0;
}
.sdp-status {
  margin: 0;
  padding-left: 1.25rem;
}
.sdp-log-wrap {
  min-height: 12rem;
}
.sdp-log {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 320px;
  overflow: auto;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  line-height: 1.35;
}
.sdp-log-line {
  margin-bottom: 0.2rem;
  word-break: break-all;
}
.sdp-log-ts {
  color: #888;
  margin-right: 0.35rem;
}
.sdp-hint {
  margin: 0.25rem 0;
  font-size: 0.85rem;
  color: #aaa;
}
.sdp-remote-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
