<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    stream: MediaStream | null
    muted?: boolean
    /** When remote stream is mutated in place (addTrack), parent bumps this so we call play() again. */
    playRev?: number
  }>(),
  {
    muted: false,
  },
)

const el = ref<HTMLVideoElement | null>(null)

let playRetryTimer: ReturnType<typeof setInterval> | null = null

function clearPlayRetry(): void {
  if (playRetryTimer !== null) {
    clearInterval(playRetryTimer)
    playRetryTimer = null
  }
}

function playSafely(v: HTMLVideoElement): void {
  void v.play().catch(() => {
    setTimeout(() => {
      void v.play().catch(() => {})
    }, 100)
  })
}

async function safePlay(v: HTMLVideoElement, stream: MediaStream | null): Promise<void> {
  clearPlayRetry()

  playSafely(v)

  if (!stream || stream.getVideoTracks().length === 0) {
    return
  }

  let attempts = 0
  playRetryTimer = setInterval(() => {
    const node = el.value
    if (!node || node !== v) {
      clearPlayRetry()
      return
    }

    const hasVideo =
      v.videoWidth > 0 && v.videoHeight > 0 && v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA

    if (hasVideo) {
      clearPlayRetry()
      return
    }

    attempts += 1
    if (attempts > 10) {
      clearPlayRetry()
      return
    }

    playSafely(v)
  }, 100)
}

watch(
  () => [props.stream, props.playRev ?? 0] as const,
  async () => {
    const v = el.value
    if (!v) {
      return
    }

    const stream = props.stream

    if (v.srcObject !== stream) {
      v.srcObject = stream
    }

    v.muted = Boolean(props.muted)

    if (!stream) {
      clearPlayRetry()
      return
    }

    await safePlay(v, stream)
  },
  { flush: 'post', immediate: true },
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
  clearPlayRetry()
})
</script>

<template>
  <video ref="el" class="sdp-vid" autoplay playsinline :muted="muted" />
</template>

<style scoped>
.sdp-vid {
  width: min(320px, 100%);
  max-height: 240px;
  background: #000;
  border: 1px solid #555;
}
</style>
