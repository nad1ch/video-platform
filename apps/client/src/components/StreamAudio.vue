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
    
    playRev?: number
    
    listenVolume?: number
    
    listenMuted?: boolean
    
    audioLevel?: number
    
    voiceDucked?: boolean
    
    audioProcessing?: boolean
  }>(),
  {
    playRev: 0,
    listenVolume: 1,
    listenMuted: false,
    audioLevel: 0,
    voiceDucked: false,
    audioProcessing: false,
  },
)

const el = ref<HTMLAudioElement | null>(null)
const NOISE_GATE_OPEN = 0.05
const NOISE_GATE_CLOSE = 0.02
const DUCKED_GAIN = 0.68
const GAIN_LERP = 0.25


let playUnlockHandler: (() => void) | null = null

let sourceNode: MediaStreamAudioSourceNode | null = null
let gainNode: GainNode | null = null
let usingWebAudio = false
let bindGeneration = 0
let gateOpen = true
let smoothGainRaf = 0
let currentGain = 1
let lastBoundAudioTrackId: string | null = null
let lastBoundUsingWebAudio = false

function shouldUseWebAudioPlayback(): boolean {
  if (props.listenMuted) {
    return false
  }
  if (props.audioProcessing) {
    return true
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
  stopSmoothGainLoop()
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

function updateNoiseGate(): void {
  if (!props.audioProcessing) {
    gateOpen = true
    return
  }
  const level = Number(props.audioLevel ?? 0)
  if (!Number.isFinite(level)) {
    gateOpen = true
    return
  }
  if (gateOpen && level <= NOISE_GATE_CLOSE) {
    gateOpen = false
  } else if (!gateOpen && level >= NOISE_GATE_OPEN) {
    gateOpen = true
  }
}

function targetGain(): number {
  const muted = Boolean(props.listenMuted)
  const raw = Number(props.listenVolume ?? 1)
  const base = muted ? 0 : Math.min(2, Math.max(0, Number.isFinite(raw) ? raw : 1))
  if (!props.audioProcessing) {
    return base
  }
  updateNoiseGate()
  if (!gateOpen) {
    return 0
  }
  return base * (props.voiceDucked ? DUCKED_GAIN : 1)
}

function stopSmoothGainLoop(): void {
  if (smoothGainRaf !== 0) {
    cancelAnimationFrame(smoothGainRaf)
    smoothGainRaf = 0
  }
}

function stepSmoothGain(): void {
  if (!gainNode || !usingWebAudio) {
    smoothGainRaf = 0
    return
  }
  const nextTarget = targetGain()
  const delta = nextTarget - currentGain
  // Stable: snap, write once, exit. The `audioLevel` / `voiceDucked` watcher restarts the loop on change.
  if (Math.abs(delta) < 0.001) {
    currentGain = nextTarget
    gainNode.gain.value = currentGain
    smoothGainRaf = 0
    return
  }
  currentGain += delta * GAIN_LERP
  gainNode.gain.value = currentGain
  smoothGainRaf = requestAnimationFrame(stepSmoothGain)
}

function startSmoothGainLoop(): void {
  if (smoothGainRaf !== 0) {
    return
  }
  smoothGainRaf = requestAnimationFrame(stepSmoothGain)
}

function applyGain(): void {
  if (!gainNode) {
    return
  }
  if (props.audioProcessing) {
    startSmoothGainLoop()
    return
  }
  stopSmoothGainLoop()
  currentGain = targetGain()
  gainNode.gain.value = currentGain
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

function softMuteElementForWebAudio(s: MediaStream): void {
  const a = el.value
  if (!a) {
    return
  }
  if (a.srcObject !== s) {
    a.srcObject = s
  }
  a.muted = true
  a.volume = 1
}

async function bindAudioGraph(): Promise<void> {
  const generation = ++bindGeneration
  await nextTick()
  if (generation !== bindGeneration) {
    return
  }

  const s = props.stream
  const newTrackId = s?.getAudioTracks()[0]?.id ?? null
  const targetUsingWebAudio = !!s && typeof AudioContext !== 'undefined' && shouldUseWebAudioPlayback()

  // Fast path: same audio track id + same playback path → skip teardown so a
  // `playRev` bump from an unrelated track event (video-source swap, screen
  // share start) does not introduce an audible audio gap.
  if (
    newTrackId !== null &&
    newTrackId === lastBoundAudioTrackId &&
    targetUsingWebAudio === lastBoundUsingWebAudio
  ) {
    if (usingWebAudio) {
      applyGain()
    } else {
      applyElementVolume()
    }
    return
  }

  clearPlayUnlock()
  teardownWebAudio()

  if (!s) {
    silenceElement(true)
    lastBoundAudioTrackId = null
    lastBoundUsingWebAudio = false
    return
  }

  if (s.getAudioTracks().length === 0) {
    silenceElement(true)
    lastBoundAudioTrackId = null
    lastBoundUsingWebAudio = false
    return
  }

  if (typeof AudioContext === 'undefined') {
    await bindElementFallback(s, generation)
    lastBoundAudioTrackId = newTrackId
    lastBoundUsingWebAudio = false
    return
  }

  if (!shouldUseWebAudioPlayback()) {
    await bindElementFallback(s, generation)
    lastBoundAudioTrackId = newTrackId
    lastBoundUsingWebAudio = false
    return
  }

  try {
    await resumeSharedCallPlaybackContext()
    if (generation !== bindGeneration) {
      return
    }
    const ctx = getSharedCallPlaybackContext()
    softMuteElementForWebAudio(s)
    sourceNode = ctx.createMediaStreamSource(s)
    gainNode = ctx.createGain()
    sourceNode.connect(gainNode)
    gainNode.connect(ctx.destination)
    usingWebAudio = true
    currentGain = targetGain()
    gainNode.gain.value = currentGain
    applyGain()
    lastBoundAudioTrackId = newTrackId
    lastBoundUsingWebAudio = true

    if (isAudioPlaybackUnlocked()) {
      requestAnimationFrame(() => {
        if (generation !== bindGeneration) {
          return
        }
        playAllPageAudioThrottled()
      })
    }
  } catch (err) {
    streamAudioLog.warn('Web Audio path failed, falling back to element', err)
    teardownWebAudio()
    await bindElementFallback(s, generation)
    lastBoundAudioTrackId = newTrackId
    lastBoundUsingWebAudio = false
  }
}

async function bindElementFallback(s: MediaStream, generation = bindGeneration): Promise<void> {
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
    if (generation !== bindGeneration) {
      return
    }
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
      if (generation !== bindGeneration) {
        return
      }
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
  () => [props.listenVolume ?? 1, props.listenMuted ?? false, props.audioProcessing] as const,
  () => {
    const s = props.stream
    if (s && s.getAudioTracks().length > 0) {
      if (usingWebAudio && shouldUseWebAudioPlayback()) {
        applyGain()
        return
      }
      void bindAudioGraph()
      return
    }
    applyGain()
    applyElementVolume()
  },
  { flush: 'post' },
)

watch(
  () => [props.audioLevel ?? 0, props.voiceDucked ?? false] as const,
  () => {
    if (usingWebAudio && props.audioProcessing) {
      startSmoothGainLoop()
    }
  },
  { flush: 'post' },
)

onUnmounted(() => {
  bindGeneration++
  offAudioUnlock()
  clearPlayUnlock()
  teardownWebAudio()
  silenceElement(true)
  lastBoundAudioTrackId = null
  lastBoundUsingWebAudio = false
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
