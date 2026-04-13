<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    stream: MediaStream | null
    muted?: boolean
    playRev?: number
    refreshTick?: number
    fill?: boolean
    /** When false, skip videoUi events (local preview). */
    reportVideoUi?: boolean
  }>(),
  {
    muted: false,
    fill: false,
    refreshTick: 0,
    reportVideoUi: true,
  },
)

const emit = defineEmits<{
  videoUi: [payload: { readyState: number; videoWidth: number; videoHeight: number }]
}>()

const el = ref<HTMLVideoElement | null>(null)

let detachUiListeners: (() => void) | null = null

function detachVideoUi(): void {
  detachUiListeners?.()
  detachUiListeners = null
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
  await nextTick()
  const v = el.value
  const s = props.stream

  if (!v) {
    return
  }

  detachVideoUi()

  if (!s) {
    v.srcObject = null
    if (props.reportVideoUi) {
      emit('videoUi', { readyState: -1, videoWidth: 0, videoHeight: 0 })
    }
    return
  }

  if (v.srcObject !== s) {
    v.srcObject = s
  }

  v.muted = Boolean(props.muted)

  if (props.reportVideoUi) {
    attachVideoUiListeners(v)
  }

  try {
    await v.play()
  } catch (err) {
    console.warn('[StreamVideo] play failed', err)
  }
}

watch(
  () => [props.stream, props.playRev ?? 0, props.refreshTick ?? 0, props.reportVideoUi] as const,
  () => {
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

onUnmounted(() => {
  detachVideoUi()
})
</script>

<template>
  <video
    ref="el"
    class="stream-video"
    :class="{ 'stream-video--fill': fill }"
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
  background: #0a0a0c;
  border: 1px solid var(--border, #2e303a);
}

.stream-video--fill {
  width: 100%;
  height: 100%;
  max-height: none;
  min-height: 0;
  /* contain = full frame visible; cover crops sides on wide video in a boxy tile */
  object-fit: contain;
  object-position: center;
  border: none;
}
</style>
