<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { createLogger } from '@/utils/logger'
import {
  isMediaDebugEnabled,
  registerVideoDebugReader,
  type MediaDebugVideoSnapshot,
} from '@/utils/mediaDebugRuntime'
import { emitDiagnosticEvent } from '@/diagnostics'

const streamVideoLog = createLogger('stream-video')

const props = withDefaults(
  defineProps<{
    stream: MediaStream | null
    muted?: boolean
    playRev?: number
    fill?: boolean

    fillCover?: boolean

    reportVideoUi?: boolean

    videoPresentation?: 'camera' | 'screen' | 'none'




    playbackSuppressed?: boolean
    /**
     * Phase 3.5: soft cap on element presentation rate (remote grid). Omit or use ≥28 for native cadence.
     * Ignored when {@link playbackSuppressed} is true. Does not change WebRTC decode/consume.
     */
    targetPlaybackFps?: number




    remotePlaybackStallPeerId?: string | null
    /**
     * Optional peerId, used by the stall watchdog and the dev `?mediaDebug=1`
     * registry. When unset, both are no-ops. Has no effect on rendering.
     * Distinct from {@link remotePlaybackStallPeerId} (which is a separate
     * flag for the `<video>` `waiting`-event reporter); a tile may set both
     * to the same value.
     */
    peerId?: string | null
  }>(),
  {
    muted: false,
    fill: false,
    fillCover: false,
    reportVideoUi: true,
    playbackSuppressed: false,
    peerId: null,
  },
)

const emit = defineEmits<{
  videoUi: [payload: { readyState: number; videoWidth: number; videoHeight: number }]
  remotePlaybackStall: [payload: { peerId: string; stalling: boolean }]
  /**
   * Frame-decode stall detected: `<video>.currentTime` did not advance for
   * >= STALL_THRESHOLD_MS while the track was live and dimensions were
   * present. Consumer is expected to debounce globally and trigger a soft
   * producer resync.
   */
  videoStall: [payload: { peerId: string }]
}>()

const el = ref<HTMLVideoElement | null>(null)

/**
 * Media-driven: mount `<video>` when there is a **live** video track. Inbound WebRTC `muted` / `enabled`
 * can lag RTP — do not gate on them. `playRev` keeps this in sync when tracks change without stream ref churn.
 */
const hasUsableVideoTrack = computed(() => {
  void props.playRev
  void props.videoPresentation
  const s = props.stream
  if (!s) {
    return false
  }
  if (props.videoPresentation === 'none') {
    return false
  }
  const tracks = s.getVideoTracks()
  if (tracks.length === 0) {
    return false
  }
  return tracks.some((t) => t.readyState === 'live')
})

function cleanupVideoElement(v: HTMLVideoElement | null): void {
  clearPlaybackFpsThrottle()
  if (!v) {
    return
  }
  try {
    v.pause()
  } catch {
    /* ignore */
  }
  try {
    v.srcObject = null
  } catch {
    /* ignore */
  }
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: string }).name === 'AbortError'
  )
}

async function playIgnoringAbort(v: HTMLVideoElement): Promise<void> {
  try {
    await v.play()
  } catch (err) {
    if (isAbortError(err)) {
      streamVideoLog.debug('play aborted (element detached or replaced)', err)
      return
    }
    streamVideoLog.warn('play failed', err)
    // Best-effort diagnostics fanout. Per-peer 10s throttle lives in
    // the emitter; never throws into the playback path.
    try {
      emitDiagnosticEvent({
        level: 'warn',
        area: 'playback',
        type: 'video_play_failed',
        message: err instanceof Error ? `${err.name}: ${err.message || ''}`.trim() : 'video play failed',
        context: {
          peerId: props.peerId ?? null,
          presentation: props.videoPresentation ?? null,
        },
        error: err,
        override: { peerId: props.peerId ?? null },
      })
    } catch {
      /* never throw from diagnostics */
    }
  }
}

/** Pause or play without detaching `srcObject` (WebRTC / replaceTrack safe). */
async function applyPlaybackSuppression(v: HTMLVideoElement): Promise<void> {
  if (props.playbackSuppressed) {
    try {
      v.pause()
    } catch {
      /* ignore */
    }
    return
  }
  await playIgnoringAbort(v)
}


const PLAYBACK_FPS_THROTTLE_MIN = 12
const PLAYBACK_FPS_THROTTLE_MAX_EXCLUSIVE = 25

const LOCAL_WAITING_FPS_STALL_MS = 1500
const LOCAL_WAITING_FPS_RELATIVE = 0.85

const CAN_USE_PLAYBACK_RVFC =
  typeof HTMLVideoElement !== 'undefined' &&
  typeof HTMLVideoElement.prototype.requestVideoFrameCallback === 'function'


let playbackFpsPacingGen = 0
let playbackFpsThrottleInterval: ReturnType<typeof setInterval> | null = null
let playbackFpsThrottlePlayTimer: ReturnType<typeof setTimeout> | null = null
let playbackFpsThrottleBoundEl: HTMLVideoElement | null = null
let rvfcHandle: number | null = null
let rvfcBoundVideo: HTMLVideoElement | null = null
let rvfcSkipPlayTimer: ReturnType<typeof setTimeout> | null = null
let localWaitingStallUntil = 0
let localWaitingRestoreTimer: ReturnType<typeof setTimeout> | null = null


let remotePlaybackStallActive = false

function notifyRemotePlaybackStall(stalling: boolean): void {
  if (props.reportVideoUi) {
    return
  }
  const id = typeof props.remotePlaybackStallPeerId === 'string' ? props.remotePlaybackStallPeerId.trim() : ''
  if (!id) {
    return
  }
  if (stalling) {
    if (!remotePlaybackStallActive) {
      remotePlaybackStallActive = true
      emit('remotePlaybackStall', { peerId: id, stalling: true })
    }
    return
  }
  if (remotePlaybackStallActive) {
    remotePlaybackStallActive = false
    emit('remotePlaybackStall', { peerId: id, stalling: false })
  }
}

function clearWaitingStallState(): void {
  notifyRemotePlaybackStall(false)
  localWaitingStallUntil = 0
  if (localWaitingRestoreTimer !== null) {
    clearTimeout(localWaitingRestoreTimer)
    localWaitingRestoreTimer = null
  }
}

function getEffectivePlaybackFpsCap(): number | undefined {
  const cap = props.targetPlaybackFps
  if (
    typeof cap !== 'number' ||
    !Number.isFinite(cap) ||
    cap < PLAYBACK_FPS_THROTTLE_MIN ||
    cap >= PLAYBACK_FPS_THROTTLE_MAX_EXCLUSIVE
  ) {
    return undefined
  }
  const now = typeof performance !== 'undefined' ? performance.now() : 0
  if (localWaitingStallUntil > 0 && now < localWaitingStallUntil) {
    return Math.max(
      PLAYBACK_FPS_THROTTLE_MIN,
      Math.round(cap * LOCAL_WAITING_FPS_RELATIVE),
    )
  }
  return cap
}

function cancelRvfcIfAny(): void {
  const v = rvfcBoundVideo
  if (v != null && rvfcHandle !== null && typeof v.cancelVideoFrameCallback === 'function') {
    try {
      v.cancelVideoFrameCallback(rvfcHandle)
    } catch {
      /* ignore */
    }
  }
  rvfcHandle = null
  rvfcBoundVideo = null
  if (rvfcSkipPlayTimer !== null) {
    clearTimeout(rvfcSkipPlayTimer)
    rvfcSkipPlayTimer = null
  }
}

function clearPlaybackFpsThrottle(): void {
  playbackFpsPacingGen += 1
  cancelRvfcIfAny()
  if (playbackFpsThrottleInterval !== null) {
    clearInterval(playbackFpsThrottleInterval)
    playbackFpsThrottleInterval = null
  }
  if (playbackFpsThrottlePlayTimer !== null) {
    clearTimeout(playbackFpsThrottlePlayTimer)
    playbackFpsThrottlePlayTimer = null
  }
  playbackFpsThrottleBoundEl = null
}

/**
 * Phase 4: decode-aligned pacing via requestVideoFrameCallback (Chrome/Edge/Firefox).
 * Skips presentation beats by pausing only when frames arrive faster than target FPS.
 */
function startRvfcPlaybackFpsThrottle(v: HTMLVideoElement, token: number): void {
  rvfcBoundVideo = v
  let lastAcceptedMs = 0

  const scheduleNextFrame = (): void => {
    if (token !== playbackFpsPacingGen || v !== el.value) {
      return
    }
    if (props.playbackSuppressed) {
      return
    }
    const eff = getEffectivePlaybackFpsCap()
    if (
      eff === undefined ||
      eff < PLAYBACK_FPS_THROTTLE_MIN ||
      eff >= PLAYBACK_FPS_THROTTLE_MAX_EXCLUSIVE
    ) {
      clearPlaybackFpsThrottle()
      return
    }
    const id = v.requestVideoFrameCallback(() => {
      if (token !== playbackFpsPacingGen || v !== el.value) {
        return
      }
      rvfcHandle = null
      if (props.playbackSuppressed) {
        return
      }
      const effective = getEffectivePlaybackFpsCap()
      if (
        effective === undefined ||
        effective < PLAYBACK_FPS_THROTTLE_MIN ||
        effective >= PLAYBACK_FPS_THROTTLE_MAX_EXCLUSIVE
      ) {
        clearPlaybackFpsThrottle()
        return
      }
      const t = typeof performance !== 'undefined' ? performance.now() : 0
      const minDelta = 1000 / effective
      if (lastAcceptedMs === 0 || t - lastAcceptedMs >= minDelta) {
        lastAcceptedMs = t
        scheduleNextFrame()
      } else {
        const wait = Math.min(72, Math.max(8, minDelta - (t - lastAcceptedMs)))
        try {
          v.pause()
        } catch {
          /* ignore */
        }
        if (rvfcSkipPlayTimer !== null) {
          clearTimeout(rvfcSkipPlayTimer)
        }
        rvfcSkipPlayTimer = window.setTimeout(() => {
          rvfcSkipPlayTimer = null
          if (token !== playbackFpsPacingGen || v !== el.value) {
            return
          }
          void playIgnoringAbort(v).finally(() => {
            if (token !== playbackFpsPacingGen || v !== el.value) {
              return
            }
            scheduleNextFrame()
          })
        }, wait)
      }
    })
    rvfcHandle = id
  }

  scheduleNextFrame()
}

/**
 * Legacy fallback: fixed-interval pause/play pulse (Safari / no RVFC).
 */
function startPulsePlaybackFpsThrottle(v: HTMLVideoElement, token: number): void {
  playbackFpsThrottleBoundEl = v
  const cap = getEffectivePlaybackFpsCap()
  if (cap === undefined) {
    return
  }
  const period = Math.max(55, Math.floor(1000 / cap))

  playbackFpsThrottleInterval = window.setInterval(() => {
    if (token !== playbackFpsPacingGen) {
      clearPlaybackFpsThrottle()
      return
    }
    const bound = playbackFpsThrottleBoundEl
    if (!bound || bound !== el.value) {
      clearPlaybackFpsThrottle()
      return
    }
    const effective = getEffectivePlaybackFpsCap()
    if (
      props.playbackSuppressed ||
      effective === undefined ||
      effective < PLAYBACK_FPS_THROTTLE_MIN ||
      effective >= PLAYBACK_FPS_THROTTLE_MAX_EXCLUSIVE
    ) {
      clearPlaybackFpsThrottle()
      return
    }
    const activePeriod = Math.max(55, Math.floor(1000 / effective))
    const activePulse = Math.min(50, Math.max(12, Math.floor(activePeriod * 0.28)))
    try {
      bound.pause()
    } catch {
      /* ignore */
    }
    if (playbackFpsThrottlePlayTimer !== null) {
      clearTimeout(playbackFpsThrottlePlayTimer)
    }
    playbackFpsThrottlePlayTimer = window.setTimeout(() => {
      playbackFpsThrottlePlayTimer = null
      void playIgnoringAbort(bound)
    }, activePulse)
  }, period)
}




function syncPlaybackFpsThrottle(v: HTMLVideoElement): void {
  clearPlaybackFpsThrottle()
  if (props.reportVideoUi) {
    return
  }
  if (props.playbackSuppressed) {
    return
  }
  const cap = getEffectivePlaybackFpsCap()
  if (cap === undefined || cap < PLAYBACK_FPS_THROTTLE_MIN || cap >= PLAYBACK_FPS_THROTTLE_MAX_EXCLUSIVE) {
    return
  }

  const token = playbackFpsPacingGen
  if (CAN_USE_PLAYBACK_RVFC) {
    startRvfcPlaybackFpsThrottle(v, token)
  } else {
    startPulsePlaybackFpsThrottle(v, token)
  }
}

/**
 * Skip heavy work only when stream ref, video track id, and playRev are unchanged — then `play()` (+ UI emit).
 * When `playRev` bumps (e.g. track unmute / source change) on the **same** `MediaStream`, do not clear
 * `srcObject` (that aborts `play()` and fights mediasoup `replaceTrack`); refresh listeners and `play()` only.
 */
let lastBoundVideoTrackId: string | undefined
let lastBoundPlayRev: number | undefined

let detachUiListeners: (() => void) | null = null
let detachInboundVideoListeners: (() => void) | null = null
let detachLocalVideoEndedListener: (() => void) | null = null


let bindStreamGeneration = 0

function clearLocalVideoEndedListener(): void {
  detachLocalVideoEndedListener?.()
  detachLocalVideoEndedListener = null
}

function clearInboundVideoTrackListeners(): void {
  detachInboundVideoListeners?.()
  detachInboundVideoListeners = null
}

function detachVideoUi(): void {
  detachUiListeners?.()
  detachUiListeners = null
}


function attachInboundVideoTrackListeners(): void {
  clearInboundVideoTrackListeners()
  const v = el.value
  if (!v || props.reportVideoUi) {
    return
  }
  const onWaiting = (): void => {
    if (props.playbackSuppressed) {
      return
    }
    notifyRemotePlaybackStall(true)
    const cap = props.targetPlaybackFps
    const capOk =
      typeof cap === 'number' &&
      Number.isFinite(cap) &&
      cap >= PLAYBACK_FPS_THROTTLE_MIN &&
      cap < PLAYBACK_FPS_THROTTLE_MAX_EXCLUSIVE
    const now = typeof performance !== 'undefined' ? performance.now() : 0
    localWaitingStallUntil = capOk ? now + LOCAL_WAITING_FPS_STALL_MS : 0
    if (localWaitingRestoreTimer !== null) {
      clearTimeout(localWaitingRestoreTimer)
    }
    if (capOk) {
      syncPlaybackFpsThrottle(v)
    }
    localWaitingRestoreTimer = window.setTimeout(() => {
      localWaitingRestoreTimer = null
      localWaitingStallUntil = 0
      notifyRemotePlaybackStall(false)
      const cur = el.value
      if (cur === v && !props.playbackSuppressed && hasUsableVideoTrack.value) {
        syncPlaybackFpsThrottle(cur)
      }
    }, LOCAL_WAITING_FPS_STALL_MS)
  }
  v.addEventListener('waiting', onWaiting)
  detachInboundVideoListeners = (): void => {
    v.removeEventListener('waiting', onWaiting)
    clearWaitingStallState()
    detachInboundVideoListeners = null
  }
}

function attachVideoUiListeners(v: HTMLVideoElement): void {
  if (!props.reportVideoUi) {
    return
  }
  detachVideoUi()
  const notify = (): void => {
    emit('videoUi', {
      readyState: v.readyState,
      videoWidth: v.videoWidth,
      videoHeight: v.videoHeight,
    })
  }
  notify()
  const on = (): void => {
    notify()
  }
  v.addEventListener('loadedmetadata', on)
  v.addEventListener('loadeddata', on)
  v.addEventListener('canplay', on)
  v.addEventListener('playing', on)
  v.addEventListener('waiting', on)
  v.addEventListener('stalled', on)
  v.addEventListener('emptied', on)
  detachUiListeners = () => {
    v.removeEventListener('loadedmetadata', on)
    v.removeEventListener('loadeddata', on)
    v.removeEventListener('canplay', on)
    v.removeEventListener('playing', on)
    v.removeEventListener('waiting', on)
    v.removeEventListener('stalled', on)
    v.removeEventListener('emptied', on)
    detachUiListeners = null
  }
}

async function bindStream(): Promise<void> {
  const generation = ++bindStreamGeneration
  await nextTick()
  if (generation !== bindStreamGeneration) {
    return
  }
  if (!hasUsableVideoTrack.value) {
    return
  }

  const v = el.value
  const s = props.stream

  if (!v) {
    return
  }

  clearInboundVideoTrackListeners()
  clearLocalVideoEndedListener()

  if (!s || s.getVideoTracks().length === 0) {
    lastBoundVideoTrackId = undefined
    lastBoundPlayRev = undefined
    detachVideoUi()
    cleanupVideoElement(v)
    if (props.reportVideoUi) {
      emit('videoUi', { readyState: -1, videoWidth: 0, videoHeight: 0 })
    }
    return
  }

  const vid = s.getVideoTracks()[0]
  const tid = vid?.id
  const rev = props.playRev ?? 0

  const samePlayRev = lastBoundPlayRev !== undefined && rev === lastBoundPlayRev
  const sameStreamAndTrack =
    v.srcObject === s && tid !== undefined && tid === lastBoundVideoTrackId && samePlayRev

  if (sameStreamAndTrack) {
    v.muted = Boolean(props.muted)
    await applyPlaybackSuppression(v)
    if (generation !== bindStreamGeneration) {
      return
    }
    syncPlaybackFpsThrottle(v)
    
    if (props.reportVideoUi) {
      emit('videoUi', {
        readyState: v.readyState,
        videoWidth: v.videoWidth,
        videoHeight: v.videoHeight,
      })
    }
    attachInboundVideoTrackListeners()
    return
  }

  lastBoundVideoTrackId = tid
  lastBoundPlayRev = rev
  detachVideoUi()

  if (import.meta.env.DEV && props.reportVideoUi) {
    streamVideoLog.debug('bindStream attach', {
      trackId: tid,
      fillCover: props.fillCover,
    })
  }

  if (v.srcObject !== s) {
    cleanupVideoElement(v)
    v.srcObject = s
  }

  v.muted = Boolean(props.muted)

  if (props.reportVideoUi) {
    attachVideoUiListeners(v)
  }

  await applyPlaybackSuppression(v)
  if (generation !== bindStreamGeneration) {
    return
  }
  syncPlaybackFpsThrottle(v)

  if (!props.reportVideoUi && vid) {
    clearLocalVideoEndedListener()
    const onEnded = (): void => {
      void bindStream()
    }
    vid.addEventListener('ended', onEnded)
    detachLocalVideoEndedListener = () => {
      vid.removeEventListener('ended', onEnded)
      detachLocalVideoEndedListener = null
    }
  }

  attachInboundVideoTrackListeners()
}

/**
 * When the inbound track is gone: pause and clear `srcObject` so a future
 * `play()` cannot race a stale binding. The element is now v-show-gated
 * rather than v-if-gated, so it stays in the DOM (PERF2: element identity
 * preserved across cam toggle / Mafia force-camera-off / showVideo flips).
 */
watch(
  hasUsableVideoTrack,
  (ok) => {
    if (!ok) {
      cleanupVideoElement(el.value)
      clearInboundVideoTrackListeners()
      clearLocalVideoEndedListener()
      detachVideoUi()
      if (props.reportVideoUi) {
        emit('videoUi', { readyState: -1, videoWidth: 0, videoHeight: 0 })
      }
      lastBoundVideoTrackId = undefined
      lastBoundPlayRev = undefined
    }
  },
  { flush: 'sync' },
)

watch(
  () =>
    [props.stream, props.playRev ?? 0, props.reportVideoUi, hasUsableVideoTrack.value, props.playbackSuppressed] as const,
  () => {
    if (!hasUsableVideoTrack.value) {
      return
    }
    void bindStream()
  },
  { immediate: true, flush: 'post' },
)

watch(
  () => [props.targetPlaybackFps ?? null, props.playbackSuppressed, hasUsableVideoTrack.value] as const,
  () => {
    const v = el.value
    if (!hasUsableVideoTrack.value || !v) {
      clearPlaybackFpsThrottle()
      return
    }
    void nextTick(() => {
      if (el.value === v) {
        syncPlaybackFpsThrottle(v)
      }
    })
  },
  { flush: 'post' },
)

watch(
  () => props.muted,
  () => {
    const v = el.value
    if (v) {
      v.muted = Boolean(props.muted)
    }
  },
  { flush: 'post' },
)

function onDocumentVisibleTryPlay(): void {
  if (typeof document === 'undefined' || document.visibilityState !== 'visible') {
    return
  }
  // Re-bind after bfcache / tab sleep so `srcObject` and track attachment stay in sync (Chrome).
  void bindStream()
}

/**
 * Frame-decode stall watchdog (remote tiles only).
 *
 * The element-level `waiting` event fires on buffer underrun, but a key-frame
 * loss or a paused-by-server consumer can leave `currentTime` frozen with
 * `readyState >= 2`, no `waiting` event, and the track still `live`. We
 * sample every {@link STALL_SAMPLE_MS} and emit `videoStall` once when the
 * gap exceeds {@link STALL_THRESHOLD_MS}. Re-arms only after `currentTime`
 * advances again, so a single stall produces at most one event.
 *
 * Conditions to even sample:
 *   - This is a remote tile (`reportVideoUi === false`).
 *   - A peerId is provided (`props.peerId`).
 *   - There is a usable video track and dimensions are present.
 *   - Playback is not intentionally suppressed (off-screen / hidden tile).
 */
const STALL_SAMPLE_MS = 2000
const STALL_THRESHOLD_MS = 6000
const STALL_MIN_DELTA = 0.05

let stallTimer: ReturnType<typeof setInterval> | null = null
let lastStallSampleCurrentTime = -1
let lastStallSampleAt = 0
let stallFiredAt = 0
let stallCurrentlyDetected = false
/**
 * Tracks the inbound video track id between samples so we can reset the
 * watchdog state when the track is replaced (camera ↔ screen-share switch,
 * publisher camera unplug/replug, any `replaceTrack` flow). Without this,
 * `lastStallSampleCurrentTime` from the old track can be larger than the
 * new track's initial `currentTime`, producing a negative delta that
 * masquerades as "no advance" and emits a false stall after 6 s.
 */
let lastStallSampleTrackId: string | null = null

function shouldRunStallWatchdog(): boolean {
  if (props.reportVideoUi) return false
  const peerId = typeof props.peerId === 'string' ? props.peerId.trim() : ''
  if (peerId.length === 0) return false
  if (props.playbackSuppressed) return false
  if (!hasUsableVideoTrack.value) return false
  return true
}

function tickStallWatchdog(): void {
  if (!shouldRunStallWatchdog()) {
    if (lastStallSampleCurrentTime !== -1) {
      lastStallSampleCurrentTime = -1
      lastStallSampleTrackId = null
      stallCurrentlyDetected = false
    }
    return
  }
  const v = el.value
  if (!v) return
  if (v.videoWidth <= 0 || v.videoHeight <= 0) return
  const trackId = v.srcObject
    ? (v.srcObject as MediaStream).getVideoTracks()[0]?.id ?? null
    : null
  if (trackId !== lastStallSampleTrackId) {
    lastStallSampleTrackId = trackId
    lastStallSampleCurrentTime = -1
    stallCurrentlyDetected = false
  }
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const ct = v.currentTime
  if (lastStallSampleCurrentTime === -1) {
    lastStallSampleCurrentTime = ct
    lastStallSampleAt = now
    return
  }
  const delta = ct - lastStallSampleCurrentTime
  if (delta >= STALL_MIN_DELTA) {
    lastStallSampleCurrentTime = ct
    lastStallSampleAt = now
    if (stallCurrentlyDetected) {
      stallCurrentlyDetected = false
    }
    return
  }
  if (now - lastStallSampleAt < STALL_THRESHOLD_MS) {
    return
  }
  if (stallCurrentlyDetected) {
    return
  }
  if (now - stallFiredAt < STALL_THRESHOLD_MS) {
    return
  }
  stallCurrentlyDetected = true
  stallFiredAt = now
  const peerId = typeof props.peerId === 'string' ? props.peerId.trim() : ''
  if (peerId.length === 0) return
  if (import.meta.env.DEV) {
    streamVideoLog.warn('decode stall detected (currentTime not advancing)', {
      peerId,
      currentTime: ct,
      videoWidth: v.videoWidth,
      videoHeight: v.videoHeight,
      readyState: v.readyState,
    })
  }
  emit('videoStall', { peerId })
}

let detachVideoDebugReader: (() => void) | null = null

onMounted(() => {
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onDocumentVisibleTryPlay)
  }
  stallTimer = setInterval(tickStallWatchdog, STALL_SAMPLE_MS)

  if (isMediaDebugEnabled()) {
    const peerId = typeof props.peerId === 'string' && props.peerId.length > 0 ? props.peerId : null
    if (peerId != null) {
      detachVideoDebugReader = registerVideoDebugReader(peerId, (): MediaDebugVideoSnapshot => {
        const v = el.value
        const track = v?.srcObject ? (v.srcObject as MediaStream).getVideoTracks()[0] ?? null : null
        return {
          el: v,
          currentTime: v?.currentTime ?? 0,
          readyState: v?.readyState ?? 0,
          videoWidth: v?.videoWidth ?? 0,
          videoHeight: v?.videoHeight ?? 0,
          paused: v?.paused ?? true,
          trackId: track?.id ?? null,
          trackMuted: track ? track.muted : null,
          trackEnabled: track ? track.enabled : null,
          trackReadyState: track ? track.readyState : null,
          lastSampleCurrentTime: lastStallSampleCurrentTime,
          lastSampleAt: lastStallSampleAt,
          stalled: stallCurrentlyDetected,
          playbackSuppressed: !!props.playbackSuppressed,
        }
      })
    }
  }
})

onUnmounted(() => {
  cleanupVideoElement(el.value)
  detachVideoUi()
  clearInboundVideoTrackListeners()
  clearLocalVideoEndedListener()
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onDocumentVisibleTryPlay)
  }
  if (stallTimer != null) {
    clearInterval(stallTimer)
    stallTimer = null
  }
  detachVideoDebugReader?.()
  detachVideoDebugReader = null
})
</script>

<template>
  <video
    v-show="hasUsableVideoTrack"
    ref="el"
    class="stream-video"
    :class="{ 'stream-video--fill': fill, 'stream-video--fill-cover': fill && fillCover }"
    autoplay
    playsinline
    :muted="muted"
  />
</template>

<style scoped>
.stream-video {
  display: block;
  width: min(320px, 100%);
  max-height: 240px;
  background: transparent;
  border: 1px solid var(--border, #2e303a);
}

.stream-video--fill {
  display: block;
  width: 100%;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  object-fit: contain;
  object-position: center;
  border: none;
  overflow: hidden;
  
  background: #000;
}

.stream-video--fill.stream-video--fill-cover {
  object-fit: cover;
}
</style>
