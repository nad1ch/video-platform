<script setup lang="ts">
import type { Ref } from 'vue'
import { inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  isAudioPlaybackUnlocked,
  playAllPageAudioThrottled,
  registerAudioUnlockHook,
} from 'call-core/audio-unlock'
import { getSharedCallPlaybackContext, resumeSharedCallPlaybackContext } from '@/audio/callPlaybackAudioContext'
import { CALL_AUDIO_OUTPUT_DEVICE_ID_KEY } from '@/audio/callAudioOutputInjection'
import { createLogger } from '@/utils/logger'
import {
  isMediaDebugEnabled,
  registerAudioDebugReader,
  type MediaDebugAudioSnapshot,
} from '@/utils/mediaDebugRuntime'
import { emitDiagnosticEvent } from '@/diagnostics'

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
    /**
     * Optional peerId, used only by the dev `?mediaDebug=1` registry. When
     * unset the diagnostics row is skipped. Has no effect on playback.
     */
    peerId?: string | null
    /**
     * "Server says this peer should be sending audio right now."
     *
     * Sourced from call-core's `tile.audioEnabled` which is computed as
     * `track.readyState === 'live' && !remoteAudioMutedByPeerId[peerId]`.
     * The map is populated from server `peer-audio-muted` deltas — so this
     * is FALSE for: user self-mute, host force-mute, force-mute-all, Mafia
     * kill, no track, ended track. It is TRUE only when the server expects
     * audio to be flowing to us right now.
     *
     * The audio-stall watchdog uses this as the authoritative gate: it ONLY
     * fires when `audioEnabled === true` AND the local `track.muted === true`
     * AND `listenMuted === false` for >=30s, which is the "server says this
     * peer is sending but my track is silent" anomaly that maps to the
     * "one listener stops hearing one specific speaker" production symptom.
     *
     * When the prop is unset or false, the watchdog is dormant — protecting
     * legitimate mute scenarios from spurious recovery.
     */
    audioEnabled?: boolean
  }>(),
  {
    playRev: 0,
    listenVolume: 1,
    listenMuted: false,
    audioLevel: 0,
    voiceDucked: false,
    audioProcessing: false,
    peerId: null,
    audioEnabled: false,
  },
)

const emit = defineEmits<{
  /**
   * Emitted at most once per anomaly cycle when this listener's inbound
   * audio for `peerId` has been stuck `track.muted = true` while the server
   * said the peer should be sending (`audioEnabled = true`) and we're not
   * listen-muting them. Routed by CallPage through the same soft → hard
   * producer-resync ladder as `videoStall` (≤ 1 soft per 60s, hard requires
   * grace + 5min cooldown). Resets on track id change, listenMuted = true,
   * audioEnabled = false, track.muted clearing, or unmount.
   */
  audioStall: [payload: { peerId: string }]
}>()

const el = ref<HTMLAudioElement | null>(null)

const callAudioOutputDeviceId = inject<Ref<string> | null>(CALL_AUDIO_OUTPUT_DEVICE_ID_KEY, null)

async function applyCallOutputSinkToElement(): Promise<void> {
  const id = callAudioOutputDeviceId?.value?.trim() ?? ''
  const a = el.value
  if (!a || id.length < 1) {
    return
  }
  const ext = a as HTMLAudioElement & { setSinkId?: (sinkId: string) => Promise<void> }
  if (typeof ext.setSinkId !== 'function') {
    return
  }
  try {
    await ext.setSinkId(id)
  } catch (err) {
    streamAudioLog.warn('setSinkId', err)
  }
}
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
      // Mirror `bindElementFallback`'s tail so a listen-mute toggle on an
      // existing track does not leave the <audio> element silently paused
      // (slow-path mounted muted → fast-path unmute would otherwise just
      // flip `muted=false` without resuming playback).
      applyElementVolume()
      const a = el.value
      if (a) {
        if (props.listenMuted) {
          try {
            a.pause()
          } catch {
            /* ignore */
          }
        } else {
          void a.play().catch(() => {
            /* idempotent: already-playing resolves; abort/autoplay handled by slow path on next bind */
          })
        }
      }
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
    // Best-effort diagnostics fanout. Per-peer 10s throttle in the emitter.
    try {
      emitDiagnosticEvent({
        level: 'warn',
        area: 'playback',
        type: 'audio_play_failed',
        message: e instanceof Error ? `${e.name}: ${e.message || ''}`.trim() : 'audio play failed',
        context: { peerId: props.peerId ?? null, stage: 'initial-play' },
        error: e,
        override: { peerId: props.peerId ?? null },
      })
    } catch {
      /* never throw from diagnostics */
    }
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

/**
 * Long-session recovery: when the host toggles `listenMuted` back to false,
 * the bind-graph fast-path calls `play()` and silently swallows a rejection
 * (autoplay policy can deny if the gesture window has expired). One guarded
 * retry on the next animation frame catches the common case where the call
 * tab is still focused but the play promise was racing with another bind.
 *
 * - Only fires on a true→false transition (no looping).
 * - Only on the element-fallback path (WebAudio path is unaffected; gain is
 *   live and there is no `<audio>` element to be paused).
 * - Logs to `[stream-audio]` via the existing logger; gated diagnostics only.
 */
let listenMutedRetryToken = 0
watch(
  () => props.listenMuted ?? false,
  (next, prev) => {
    if (prev !== true || next !== false) return
    if (usingWebAudio) return
    const a = el.value
    if (!a || !a.srcObject) return
    listenMutedRetryToken += 1
    const token = listenMutedRetryToken
    requestAnimationFrame(() => {
      if (token !== listenMutedRetryToken) return
      const cur = el.value
      if (!cur || !cur.srcObject) return
      if (!cur.paused) return
      void cur
        .play()
        .then(() => {
          if (import.meta.env.DEV) {
            streamAudioLog.debug('unmute play() recovered', { peerId: props.peerId })
          }
        })
        .catch((err) => {
          if (import.meta.env.DEV) {
            streamAudioLog.warn('unmute play() rejected; will rely on next user gesture', {
              peerId: props.peerId,
              error: (err as { name?: string })?.name ?? String(err),
            })
          }
          // Production-visible: surface as audio_play_failed too, throttled per peer.
          try {
            emitDiagnosticEvent({
              level: 'warn',
              area: 'playback',
              type: 'audio_play_failed',
              message: err instanceof Error
                ? `${err.name}: ${err.message || ''}`.trim()
                : 'audio unmute play() rejected',
              context: { peerId: props.peerId ?? null, stage: 'unmute-recovery' },
              error: err,
              override: { peerId: props.peerId ?? null },
            })
          } catch {
            /* never throw */
          }
        })
    })
  },
  { flush: 'post' },
)

/**
 * Long-session recovery: a shared `AudioContext` can be auto-suspended by
 * the browser after long idle (no audio activity) or on output device change.
 * The component's WebAudio chain stays wired but produces no sound until we
 * resume. A 5s heartbeat is cheap and only does work when a resume is needed.
 *
 * Only runs while WebAudio is in use; element-fallback peers never start it.
 * The resume promise is fire-and-forget — it can only reject if no user
 * gesture has happened yet, in which case the existing `audioUnlockHook`
 * already handles the next gesture.
 */
const AUDIO_CTX_HEARTBEAT_MS = 5000
let audioCtxHeartbeat: ReturnType<typeof setInterval> | null = null

function tickAudioCtxHeartbeat(): void {
  if (!usingWebAudio) return
  if (typeof AudioContext === 'undefined') return
  let state: AudioContextState
  try {
    state = getSharedCallPlaybackContext().state
  } catch {
    return
  }
  if (state !== 'suspended') return
  void resumeSharedCallPlaybackContext().then(() => {
    if (import.meta.env.DEV) {
      streamAudioLog.debug('AudioContext resumed by heartbeat', { peerId: props.peerId })
    }
  })
}

/**
 * Audio-stall watchdog (remote audio, conservative).
 *
 * Triggers `audioStall` ONLY when ALL of the following hold continuously
 * for {@link AUDIO_STALL_THRESHOLD_MS}:
 *   - `props.audioEnabled === true` (server says the peer is sending)
 *   - `props.listenMuted === false`  (this listener is not muting them)
 *   - the current peerId is known
 *   - `<audio>.srcObject` exists with a live audio track
 *   - `track.muted === true`         (the browser reports no RTP arriving)
 *
 * The check piggy-backs on the existing 5s heartbeat — no new timers, no
 * per-second loops. The threshold is sampled in coarse steps (≥ 30s after
 * the first sample to register the anomaly), which is acceptable for a
 * recovery action whose user-visible cost is "30-35s of audio loss before
 * the soft resync attempt fires."
 *
 * State invalidates immediately on:
 *   - track id change                  (different track, sample fresh)
 *   - `listenMuted` true               (we expect silence)
 *   - `audioEnabled` false             (server expects silence)
 *   - track unmute                     (anomaly cleared organically)
 *   - srcObject removed / no track     (no signal source)
 *   - component unmount
 */
const AUDIO_STALL_THRESHOLD_MS = 30_000
const AUDIO_STALL_FIRE_COOLDOWN_MS = 60_000
let audioStallSampleStartAt = 0
let audioStallSampleTrackId: string | null = null
let audioStallCurrentlyDetected = false
let audioStallLastFiredAt = 0

function shouldRunAudioStallWatchdog(): boolean {
  if (!props.audioEnabled) return false
  if (props.listenMuted) return false
  const peerId = typeof props.peerId === 'string' ? props.peerId.trim() : ''
  if (peerId.length === 0) return false
  const a = el.value
  if (!a || !a.srcObject) return false
  return true
}

function resetAudioStallWatchdog(): void {
  if (audioStallSampleStartAt !== 0) {
    audioStallSampleStartAt = 0
  }
  if (audioStallSampleTrackId !== null) {
    audioStallSampleTrackId = null
  }
  if (audioStallCurrentlyDetected) {
    audioStallCurrentlyDetected = false
  }
}

function tickAudioStallWatchdog(): void {
  if (!shouldRunAudioStallWatchdog()) {
    resetAudioStallWatchdog()
    return
  }
  const a = el.value
  if (!a || !a.srcObject) {
    resetAudioStallWatchdog()
    return
  }
  const track = (a.srcObject as MediaStream).getAudioTracks()[0] ?? null
  if (!track || track.readyState !== 'live') {
    resetAudioStallWatchdog()
    return
  }
  const trackId = track.id
  if (trackId !== audioStallSampleTrackId) {
    audioStallSampleTrackId = trackId
    audioStallSampleStartAt = 0
    audioStallCurrentlyDetected = false
  }
  if (!track.muted) {
    if (audioStallSampleStartAt !== 0) {
      audioStallSampleStartAt = 0
    }
    if (audioStallCurrentlyDetected) {
      audioStallCurrentlyDetected = false
    }
    return
  }
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  if (audioStallSampleStartAt === 0) {
    audioStallSampleStartAt = now
    return
  }
  if (audioStallCurrentlyDetected) {
    return
  }
  if (now - audioStallSampleStartAt < AUDIO_STALL_THRESHOLD_MS) {
    return
  }
  if (now - audioStallLastFiredAt < AUDIO_STALL_FIRE_COOLDOWN_MS) {
    return
  }
  audioStallCurrentlyDetected = true
  audioStallLastFiredAt = now
  const peerId = typeof props.peerId === 'string' ? props.peerId.trim() : ''
  if (peerId.length === 0) return
  if (import.meta.env.DEV) {
    streamAudioLog.warn('audio stall detected (track muted while server expects audio)', {
      peerId,
      durationMs: Math.round(now - audioStallSampleStartAt),
      trackId,
    })
  }
  emit('audioStall', { peerId })
}

function tickAudioMaintenance(): void {
  tickAudioCtxHeartbeat()
  tickAudioStallWatchdog()
}

onMounted(() => {
  audioCtxHeartbeat = setInterval(tickAudioMaintenance, AUDIO_CTX_HEARTBEAT_MS)
})

// Reset stall sample state on the same edge transitions the gate cares about
// — this catches the cases where the prop change happens between heartbeat
// ticks (e.g., user toggles listen-mute fast) so the next tick samples fresh
// instead of inheriting a stale "started" timestamp.
watch(
  () => [props.audioEnabled, props.listenMuted ?? false, props.peerId ?? null] as const,
  () => {
    if (!shouldRunAudioStallWatchdog()) {
      resetAudioStallWatchdog()
    }
  },
  { flush: 'post' },
)
watch(
  () => props.stream,
  () => {
    resetAudioStallWatchdog()
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

watch(
  () => [callAudioOutputDeviceId?.value ?? '', el.value] as const,
  () => {
    void applyCallOutputSinkToElement()
  },
  { flush: 'post' },
)

/**
 * Dev-only registration with the `?mediaDebug=1` registry. The reader is a
 * pure synchronous snapshot from element + track + WebAudio refs. No effect
 * unless the URL flag is set.
 */
let detachAudioDebugReader: (() => void) | null = null
onMounted(() => {
  if (!isMediaDebugEnabled()) return
  const peerId = typeof props.peerId === 'string' && props.peerId.length > 0 ? props.peerId : null
  if (peerId == null) return
  detachAudioDebugReader = registerAudioDebugReader(peerId, (): MediaDebugAudioSnapshot => {
    const a = el.value
    const track = a?.srcObject ? (a.srcObject as MediaStream).getAudioTracks()[0] ?? null : null
    let ctxState: MediaDebugAudioSnapshot['audioCtxState'] = 'unknown'
    if (typeof AudioContext !== 'undefined') {
      try {
        ctxState = getSharedCallPlaybackContext().state
      } catch {
        ctxState = 'unknown'
      }
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const audioMutedDurationMs =
      audioStallSampleStartAt > 0 ? Math.round(now - audioStallSampleStartAt) : 0
    return {
      el: a,
      paused: a?.paused ?? true,
      muted: a?.muted ?? true,
      volume: a?.volume ?? 0,
      readyState: a?.readyState ?? 0,
      hasSrcObject: !!a?.srcObject,
      trackId: track?.id ?? null,
      trackMuted: track ? track.muted : null,
      trackEnabled: track ? track.enabled : null,
      trackReadyState: track ? track.readyState : null,
      usingWebAudio,
      audioCtxState: ctxState,
      gainValue: gainNode ? gainNode.gain.value : null,
      audioEnabled: !!props.audioEnabled,
      audioMutedDurationMs,
      audioStalled: audioStallCurrentlyDetected,
    }
  })
})

onUnmounted(() => {
  bindGeneration++
  offAudioUnlock()
  clearPlayUnlock()
  teardownWebAudio()
  silenceElement(true)
  if (audioCtxHeartbeat != null) {
    clearInterval(audioCtxHeartbeat)
    audioCtxHeartbeat = null
  }
  resetAudioStallWatchdog()
  detachAudioDebugReader?.()
  detachAudioDebugReader = null
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
