<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { createLogger } from '@/utils/logger'

const streamVideoLog = createLogger('stream-video')

const props = withDefaults(
  defineProps<{
    stream: MediaStream | null
    muted?: boolean
    playRev?: number
    fill?: boolean
    /** When `fill` is true: `false` → object-fit contain (screens), `true` → cover (local webcam in grid). */
    fillCover?: boolean
    /** When false, skip videoUi events (local preview). */
    reportVideoUi?: boolean
    /** Local preview: `none` = no outbound video (paused / no track). Remotes omit this prop. */
    videoPresentation?: 'camera' | 'screen' | 'none'
  }>(),
  {
    muted: false,
    fill: false,
    fillCover: false,
    reportVideoUi: true,
  },
)

const emit = defineEmits<{
  videoUi: [payload: { readyState: number; videoWidth: number; videoHeight: number }]
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

/** Cancels in-flight bind after `playRev`/stream churn (rapid cam toggle). */
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

/** Reserved for inbound track lifecycle; do not clear `<video>` on `track.muted` (flag can disagree with RTP). */
function attachInboundVideoTrackListeners(): void {
  clearInboundVideoTrackListeners()
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
    await playIgnoringAbort(v)
    if (generation !== bindStreamGeneration) {
      return
    }
    // Same bound track can go muted→unmuted (RTP start); re-emit so tiles leave “connecting” / frozen UI.
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

  await playIgnoringAbort(v)
  if (generation !== bindStreamGeneration) {
    return
  }

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

/** Before v-if removes the element: pause + clear so play() cannot race teardown. */
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
  () => [props.stream, props.playRev ?? 0, props.reportVideoUi, hasUsableVideoTrack] as const,
  () => {
    if (!hasUsableVideoTrack.value) {
      return
    }
    void bindStream()
  },
  { immediate: true, flush: 'post' },
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

onMounted(() => {
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onDocumentVisibleTryPlay)
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
})
</script>

<template>
  <video
    v-if="hasUsableVideoTrack"
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
  /* Смуги, які не закриває кадр (contain), — чорні, без «просвічування» фону сторінки. */
  background: #000;
}

.stream-video--fill.stream-video--fill-cover {
  object-fit: cover;
}
</style>
