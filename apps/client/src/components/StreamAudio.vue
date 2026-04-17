<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import {
  isAudioPlaybackUnlocked,
  playAllPageAudioThrottled,
} from 'call-core'
import { getSharedCallPlaybackContext, resumeSharedCallPlaybackContext } from '@/audio/callPlaybackAudioContext'
import { createLogger } from '@/utils/logger'

const streamAudioLog = createLogger('stream-audio')

const props = withDefaults(
  defineProps<{
    stream: MediaStream | null
    /** Bump when parent stream gains audio track in place. */
    playRev?: number
    /** Local listening gain 0..2 (0–200%; 1 = default). */
    listenVolume?: number
    /** Local-only mute for this stream (does not affect remote sender). */
    listenMuted?: boolean
  }>(),
  {
    playRev: 0,
    listenVolume: 1,
    listenMuted: false,
  },
)

const el = ref<HTMLAudioElement | null>(null)

/** One-shot gesture retry after autoplay policy blocks play() */
let playUnlockHandler: (() => void) | null = null

let sourceNode: MediaStreamAudioSourceNode | null = null
let gainNode: GainNode | null = null
let usingWebAudio = false

function clearPlayUnlock(): void {
  if (playUnlockHandler) {
    document.removeEventListener('pointerdown', playUnlockHandler, true)
    playUnlockHandler = null
  }
}

function teardownWebAudio(): void {
  try {
    sourceNode?.disconnect()
  } catch {
    /* ignore */
  }
  sourceNode = null
  try {
    gainNode?.disconnect()
  } catch {
    /* ignore */
  }
  gainNode = null
  usingWebAudio = false
}

function applyGain(): void {
  if (!gainNode) {
    return
  }
  const muted = Boolean(props.listenMuted)
  const raw = Number(props.listenVolume ?? 1)
  const g = muted ? 0 : Math.min(2, Math.max(0, Number.isFinite(raw) ? raw : 1))
  gainNode.gain.value = g
}

function applyElementVolume(): void {
  const a = el.value
  if (!a) {
    return
  }
  const vol = props.listenMuted ? 0 : Math.min(1, Math.max(0, Number(props.listenVolume ?? 1)))
  a.volume = vol
  a.muted = vol <= 0.0001
}

async function bindAudioGraph(): Promise<void> {
  await nextTick()
  clearPlayUnlock()
  teardownWebAudio()

  const s = props.stream
  const a = el.value

  if (!s || s.getAudioTracks().length === 0) {
    if (a) {
      a.srcObject = null
    }
    return
  }

  if (typeof AudioContext === 'undefined') {
    await bindElementFallback(s)
    return
  }

  try {
    await resumeSharedCallPlaybackContext()
    const ctx = getSharedCallPlaybackContext()
    sourceNode = ctx.createMediaStreamSource(s)
    gainNode = ctx.createGain()
    applyGain()
    sourceNode.connect(gainNode)
    gainNode.connect(ctx.destination)
    usingWebAudio = true

    if (isAudioPlaybackUnlocked()) {
      requestAnimationFrame(() => {
        playAllPageAudioThrottled()
      })
    }
  } catch (err) {
    streamAudioLog.warn('Web Audio path failed, falling back to element', err)
    teardownWebAudio()
    await bindElementFallback(s)
  }
}

async function bindElementFallback(s: MediaStream): Promise<void> {
  const a = el.value
  if (!a) {
    return
  }
  usingWebAudio = false
  a.autoplay = true
  applyElementVolume()
  ;(a as HTMLAudioElement & { playsInline?: boolean }).playsInline = true
  if (a.srcObject !== s) {
    a.srcObject = s
  }
  try {
    await a.play()
  } catch (e) {
    streamAudioLog.warn('play failed', e)
    const isNotAllowed =
      e instanceof DOMException
        ? e.name === 'NotAllowedError'
        : typeof e === 'object' &&
          e !== null &&
          'name' in e &&
          (e as { name?: string }).name === 'NotAllowedError'
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
      playAllPageAudioThrottled()
    })
  }
}

watch(
  () => [props.stream, props.playRev ?? 0] as const,
  () => {
    void bindAudioGraph()
  },
  { immediate: true, flush: 'post' },
)

watch(
  () => [props.listenVolume ?? 1, props.listenMuted ?? false] as const,
  () => {
    if (usingWebAudio && gainNode) {
      applyGain()
    } else if (!usingWebAudio && el.value?.srcObject) {
      applyElementVolume()
    }
  },
  { flush: 'post' },
)

onUnmounted(() => {
  clearPlayUnlock()
  teardownWebAudio()
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
