<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import {
  isAudioPlaybackUnlocked,
  playAllPageAudioThrottled,
} from 'call-core'

const props = withDefaults(
  defineProps<{
    stream: MediaStream | null
    /** Bump when parent stream gains audio track in place. */
    playRev?: number
  }>(),
  {
    playRev: 0,
  },
)

const el = ref<HTMLAudioElement | null>(null)

/** One-shot gesture retry after autoplay policy blocks play() */
let playUnlockHandler: (() => void) | null = null

function clearPlayUnlock(): void {
  if (playUnlockHandler) {
    document.removeEventListener('pointerdown', playUnlockHandler, true)
    playUnlockHandler = null
  }
}

async function bindAudio(): Promise<void> {
  await nextTick()
  const a = el.value
  const s = props.stream
  if (!a) {
    return
  }
  clearPlayUnlock()
  a.autoplay = true
  a.muted = false
  // DOM typings omit playsInline on HTMLAudioElement; iOS/Safari still honor it for inline playback.
  ;(a as HTMLAudioElement & { playsInline?: boolean }).playsInline = true
  if (!s) {
    a.srcObject = null
    return
  }
  if (import.meta.env.DEV) {
    console.log('[StreamAudio] attach', {
      streamId: s.id,
      element: { muted: a.muted, paused: a.paused, volume: a.volume },
      tracks: s.getAudioTracks().map((t) => ({
        id: t.id,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState,
      })),
    })
  }
  if (a.srcObject !== s) {
    a.srcObject = s
  }
  try {
    await a.play()
  } catch (err) {
    console.warn('[StreamAudio] play failed', err)
    const isNotAllowed =
      err instanceof DOMException
        ? err.name === 'NotAllowedError'
        : typeof err === 'object' &&
          err !== null &&
          'name' in err &&
          (err as { name?: string }).name === 'NotAllowedError'
    if (isNotAllowed) {
      playUnlockHandler = () => {
        clearPlayUnlock()
        void a.play().catch(() => {})
      }
      document.addEventListener('pointerdown', playUnlockHandler, { capture: true, once: true })
    }
  }

  if (isAudioPlaybackUnlocked()) {
    requestAnimationFrame(() => {
      void a.play().catch(() => {})
      playAllPageAudioThrottled()
    })
  }

}

watch(
  () => [props.stream, props.playRev ?? 0] as const,
  () => {
    void bindAudio()
  },
  { immediate: true, flush: 'post' },
)

onUnmounted(() => {
  clearPlayUnlock()
  const a = el.value
  if (a) {
    a.srcObject = null
  }
})
</script>

<template>
  <audio ref="el" class="stream-audio" />
</template>

<style scoped>
.stream-audio {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
</style>
