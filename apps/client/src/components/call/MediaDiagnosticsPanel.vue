<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  dumpAudioDebug,
  dumpVideoDebug,
  MEDIA_DEBUG_TIMER_DRIFT_INTERVAL_MS,
  MEDIA_DEBUG_TIMER_DRIFT_THROTTLED_DELTA_MS,
  readMediaDebugTimerDrift,
  type MediaDebugAudioSnapshot,
  type MediaDebugTimerDrift,
  type MediaDebugVideoSnapshot,
} from '@/utils/mediaDebugRuntime'

/**
 * Dev-only floating overlay surfacing per-peer media element + track state.
 * Mounted only when `?mediaDebug=1` is set. Polls the registry every 1s; rows
 * are flat strings so the panel stays cheap even with 12+ tiles.
 *
 * No reactivity into Vue stores; no WS calls; no mediasoup access. Read-only.
 */

const POLL_MS = 1000

const audioRows = ref<Array<{ peerId: string } & MediaDebugAudioSnapshot>>([])
const videoRows = ref<Array<{ peerId: string } & MediaDebugVideoSnapshot>>([])
const drift = ref<MediaDebugTimerDrift>(readMediaDebugTimerDrift())
const collapsed = ref(false)

let timer: ReturnType<typeof setInterval> | null = null

function refresh(): void {
  const a = dumpAudioDebug()
  const v = dumpVideoDebug()
  audioRows.value = Object.entries(a).map(([peerId, snap]) => ({ peerId, ...snap }))
  videoRows.value = Object.entries(v).map(([peerId, snap]) => ({ peerId, ...snap }))
  drift.value = readMediaDebugTimerDrift()
}

onMounted(() => {
  refresh()
  timer = setInterval(refresh, POLL_MS)
})

onBeforeUnmount(() => {
  if (timer != null) {
    clearInterval(timer)
    timer = null
  }
})

const audioCount = computed(() => audioRows.value.length)
const videoCount = computed(() => videoRows.value.length)
const audioStalled = computed(() =>
  audioRows.value.filter((r) => r.hasSrcObject && !r.usingWebAudio && r.paused && !r.muted).length,
)
const videoStalled = computed(() => videoRows.value.filter((r) => r.stalled).length)
const driftSuspected = computed(
  () => drift.value.lastDeltaMs > MEDIA_DEBUG_TIMER_DRIFT_THROTTLED_DELTA_MS,
)
const driftSeen = computed(() => drift.value.throttledTickCount > 0)

function shortPeer(id: string): string {
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id
}

function fmtTrackState(snap: { trackReadyState: string | null; trackMuted: boolean | null; trackEnabled: boolean | null }): string {
  if (snap.trackReadyState == null) return '—'
  return `${snap.trackReadyState}${snap.trackMuted ? ' M' : ''}${snap.trackEnabled === false ? ' D' : ''}`
}
</script>

<template>
  <div class="media-debug" :class="{ 'media-debug--collapsed': collapsed }" role="region" aria-label="Media diagnostics">
    <header class="media-debug__head">
      <span class="media-debug__title">media debug</span>
      <span class="media-debug__counts">
        A {{ audioCount }}<span v-if="audioStalled > 0" class="media-debug__warn"> ({{ audioStalled }})</span>
        · V {{ videoCount }}<span v-if="videoStalled > 0" class="media-debug__warn"> ({{ videoStalled }})</span>
      </span>
      <button class="media-debug__toggle" type="button" @click="collapsed = !collapsed">
        {{ collapsed ? '▴' : '▾' }}
      </button>
    </header>
    <div v-if="!collapsed" class="media-debug__body">
      <section class="media-debug__section">
        <h4>audio</h4>
        <table>
          <thead>
            <tr><th>peer</th><th>el</th><th>vol</th><th>track</th><th>web</th><th>ctx</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in audioRows" :key="r.peerId" :class="{ 'media-debug__row--warn': r.hasSrcObject && !r.usingWebAudio && r.paused && !r.muted }">
              <td>{{ shortPeer(r.peerId) }}</td>
              <td>
                <span :class="{ 'media-debug__warn': r.paused && !r.muted }">
                  {{ r.paused ? 'P' : 'p' }}{{ r.muted ? 'M' : 'm' }}
                </span>
              </td>
              <td>{{ r.volume.toFixed(2) }}</td>
              <td>{{ fmtTrackState(r) }}</td>
              <td>{{ r.usingWebAudio ? 'wa' : '—' }}<span v-if="r.usingWebAudio">/{{ r.gainValue?.toFixed(2) ?? '?' }}</span></td>
              <td :class="{ 'media-debug__warn': r.audioCtxState === 'suspended' }">{{ r.audioCtxState }}</td>
            </tr>
          </tbody>
        </table>
      </section>
      <section class="media-debug__section">
        <h4>video</h4>
        <table>
          <thead>
            <tr><th>peer</th><th>dim</th><th>ct</th><th>rs</th><th>track</th><th>state</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in videoRows" :key="r.peerId" :class="{ 'media-debug__row--warn': r.stalled }">
              <td>{{ shortPeer(r.peerId) }}</td>
              <td>{{ r.videoWidth }}×{{ r.videoHeight }}</td>
              <td>{{ r.currentTime.toFixed(2) }}</td>
              <td>{{ r.readyState }}</td>
              <td>{{ fmtTrackState(r) }}</td>
              <td>
                <span v-if="r.stalled" class="media-debug__warn">STALL</span>
                <span v-else-if="r.playbackSuppressed">susp</span>
                <span v-else-if="r.paused">paused</span>
                <span v-else>ok</span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
      <section class="media-debug__section">
        <h4>timer drift</h4>
        <div class="media-debug__drift">
          <span>last:
            <span :class="{ 'media-debug__warn': driftSuspected }">{{ drift.lastDeltaMs }}ms</span>
          </span>
          <span>max: <span :class="{ 'media-debug__warn': driftSeen }">{{ drift.maxDeltaMs }}ms</span></span>
          <span>throttled: <span :class="{ 'media-debug__warn': driftSeen }">{{ drift.throttledTickCount }}</span></span>
          <span class="media-debug__drift-hint">expected ~{{ MEDIA_DEBUG_TIMER_DRIFT_INTERVAL_MS }}ms</span>
        </div>
        <div v-if="driftSeen" class="media-debug__warn media-debug__drift-hint">
          OBS / hidden-tab throttling suspected — recovery watchdogs may be unreliable.
        </div>
      </section>
      <footer class="media-debug__foot">
        console: <code>__MEDIA_DEBUG__.dumpAll()</code>, <code>.timerDrift()</code>, <code>.forceSoftResync()</code>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.media-debug {
  position: fixed;
  bottom: 8px;
  right: 8px;
  z-index: 99999;
  width: 360px;
  max-width: calc(100vw - 16px);
  max-height: calc(100vh - 16px);
  overflow: auto;
  padding: 6px 8px;
  background: rgb(10 10 14 / 0.92);
  color: #d8d8e0;
  border: 1px solid rgb(120 80 200 / 0.55);
  border-radius: 8px;
  font: 11px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace;
  pointer-events: auto;
  user-select: text;
}

.media-debug--collapsed {
  width: auto;
  max-width: 240px;
  overflow: hidden;
}

.media-debug__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.media-debug__title {
  font-weight: 700;
  color: #cfb6ff;
}

.media-debug__counts {
  flex: 1;
  font-variant-numeric: tabular-nums;
}

.media-debug__toggle {
  appearance: none;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0 4px;
}

.media-debug__body {
  margin-top: 4px;
}

.media-debug__section {
  margin-top: 6px;
}

.media-debug__section h4 {
  margin: 4px 0 2px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #9b8eb5;
}

.media-debug__section table {
  width: 100%;
  border-collapse: collapse;
}

.media-debug__section th,
.media-debug__section td {
  padding: 1px 4px;
  text-align: left;
  border-bottom: 1px solid rgb(120 80 200 / 0.18);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.media-debug__section th {
  color: #8e7dac;
  font-weight: 600;
  font-size: 10px;
}

.media-debug__warn {
  color: #ff8e8e;
}

.media-debug__row--warn {
  background: rgb(255 70 70 / 0.08);
}

.media-debug__foot {
  margin-top: 6px;
  font-size: 10px;
  color: #8e7dac;
}

.media-debug__foot code {
  background: rgb(255 255 255 / 0.06);
  padding: 0 4px;
  border-radius: 3px;
}

.media-debug__drift {
  display: flex;
  flex-wrap: wrap;
  gap: 0 10px;
  font-variant-numeric: tabular-nums;
}

.media-debug__drift-hint {
  flex-basis: 100%;
  font-size: 10px;
  color: #8e7dac;
}
</style>
