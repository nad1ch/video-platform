<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import {
  isAudioPlaybackUnlocked,
  playAllPageAudioThrottled,
  registerAudioUnlockHook,
} from 'call-core/audio-unlock'
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

function shouldUseWebAudioPlayback(): boolean {
  if (props.listenMuted) {
    return false
  }
  const raw = Number(props.listenVolume ?? 1)
  return Number.isFinite(raw) && raw > 1
}

const offAudioUnlock = registerAudioUnlockHook(() => {
  const a = el.value
  if (!usingWebAudio && a?.srcObject) {
    void a.play().catch(() => {})
    return
  }
  if (usingWebAudio) {
    void resumeSharedCallPlaybackContext()
  }
})

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

function silenceElement(detach: boolean): void {
  const a = el.value
  if (!a) {
    return
  }
  try {
    a.pause()
  } catch {
    /* ignore */
  }
  a.muted = true
  a.volume = 0
  if (detach) {
    a.srcObject = null
  }
}

async function bindAudioGraph(): Promise<void> {
  await nextTick()
  clearPlayUnlock()
  teardownWebAudio()

  const s = props.stream

  if (!s || s.getAudioTracks().length === 0) {
    silenceElement(true)
    return
  }

  if (import.meta.env.DEV) {
    let ctxState = 'no-audio-context'
    if (typeof AudioContext !== 'undefined') {
      try {
        ctxState = getSharedCallPlaybackContext().state
      } catch {
        ctxState = 'unavailable'
      }
    }
    console.log('[stream-audio] bind', {
      tracks: s.getAudioTracks().map((t) => ({
        id: t.id,
        muted: t.muted,
        readyState: t.readyState,
        enabled: t.enabled,
      })),
      ctxState,
      unlocked: isAudioPlaybackUnlocked(),
    })
  }

  if (typeof AudioContext === 'undefined' || !shouldUseWebAudioPlayback()) {
    await bindElementFallback(s)
    return
  }

  try {
    await resumeSharedCallPlaybackContext()
    const ctx = getSharedCallPlaybackContext()
    silenceElement(true)
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
  if (props.listenMuted) {
    try {
      a.pause()
    } catch {
      /* ignore */
    }
    return
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
    const s = props.stream
    if (s && s.getAudioTracks().length > 0) {
      void bindAudioGraph()
      return
    }
    applyGain()
    applyElementVolume()
  },
  { flush: 'post' },
)

onUnmounted(() => {
  offAudioUnlock()
  clearPlayUnlock()
  teardownWebAudio()
  silenceElement(true)
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
