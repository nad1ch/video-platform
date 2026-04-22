import {
  getAudioAnalysisAudioContext,
  isAudioPlaybackUnlocked,
  registerAudioUnlockHook,
} from 'call-core'
import { onBeforeUnmount, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { createLogger } from '@/utils/logger'

const localTileSpeakLog = createLogger('local-tile-speaking')

const FFT_SIZE = 512
/** Above → treat as "speaking" (local mic; match call-core order of magnitude, slightly lower for quiet USB mics). */
const RMS_ON = 0.02
/** Hysteresis off — avoid flicker when level hovers at threshold. */
const RMS_OFF = 0.01
/** Match `ParticipantTile` active-speaker debounce so local/remote feel identical. */
const SPEAKING_SHOW_DELAY_MS = 200
const SPEAKING_HIDE_DELAY_MS = 200

const POLL_MS = 64
/** DEV: log RMS / ctx about once per second at 64ms poll. */
const DEV_LOG_EVERY = 16

function rmsTimeDomain(analyser: AnalyserNode): number {
  const buf = new Uint8Array(analyser.fftSize)
  analyser.getByteTimeDomainData(buf)
  let sum = 0
  for (let i = 0; i < buf.length; i += 1) {
    const v = (buf[i]! - 128) / 128
    sum += v * v
  }
  return Math.min(1, Math.sqrt(sum / buf.length))
}

/**
 * Local preview tile: `useActiveSpeaker` in call-core excludes the local track (USB composite
 * mic/cam conflict). One lightweight `AnalyserNode` + interval polling — no extra RAF vs call-core.
 */
export function useLocalTileSpeakingVisual(
  getStream: () => MediaStream | null | undefined,
  getIsLocal: () => boolean,
  getAudioEnabled: () => boolean,
) {
  const visual = ref(false)
  let showTimer: ReturnType<typeof setTimeout> | undefined
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  const ctx = getAudioAnalysisAudioContext()
  let source: MediaStreamAudioSourceNode | null = null
  let analyser: AnalyserNode | null = null
  const poll = shallowRef<ReturnType<typeof setInterval> | null>(null)
  let rawAbove = false
  let devLogTick = 0

  const offAudioUnlock = registerAudioUnlockHook(() => {
    void ctx.resume().catch(() => {})
  })

  function clearTimers(): void {
    if (showTimer !== undefined) {
      clearTimeout(showTimer)
      showTimer = undefined
    }
    if (hideTimer !== undefined) {
      clearTimeout(hideTimer)
      hideTimer = undefined
    }
  }

  function disconnectGraph(): void {
    if (poll.value != null) {
      clearInterval(poll.value)
      poll.value = null
    }
    source?.disconnect()
    source = null
    analyser?.disconnect()
    analyser = null
    rawAbove = false
    clearTimers()
    visual.value = false
  }

  function scheduleVisual(shouldShow: boolean): void {
    clearTimers()
    if (shouldShow) {
      showTimer = setTimeout(() => {
        visual.value = true
        showTimer = undefined
      }, SPEAKING_SHOW_DELAY_MS)
    } else {
      hideTimer = setTimeout(() => {
        visual.value = false
        hideTimer = undefined
      }, SPEAKING_HIDE_DELAY_MS)
    }
  }

  function connectFromStream(s: MediaStream | null | undefined): void {
    disconnectGraph()
    if (!getIsLocal() || !getAudioEnabled() || !s) {
      return
    }
    const track = s.getAudioTracks()[0]
    if (!track || track.readyState !== 'live' || !track.enabled) {
      return
    }
    try {
      const audioOnly = new MediaStream([track])
      const src = ctx.createMediaStreamSource(audioOnly)
      const a = ctx.createAnalyser()
      a.fftSize = FFT_SIZE
      src.connect(a)
      source = src
      analyser = a
      rawAbove = false
      devLogTick = 0
      poll.value = setInterval(() => {
        if (!analyser) {
          return
        }
        if (ctx.state !== 'closed' && ctx.state !== 'running') {
          void ctx.resume().catch(() => {})
        }
        const r = rmsTimeDomain(analyser)
        if (import.meta.env.DEV) {
          devLogTick += 1
          if (devLogTick % DEV_LOG_EVERY === 0) {
            localTileSpeakLog.debug('pipeline: local RMS / AudioContext', {
              ctxState: ctx.state,
              rms: r,
              rmsOn: RMS_ON,
              rmsOff: RMS_OFF,
              rawAbove,
              visual: visual.value,
              unlocked: isAudioPlaybackUnlocked(),
            })
          }
        }
        if (rawAbove) {
          if (r < RMS_OFF) {
            rawAbove = false
            scheduleVisual(false)
          }
        } else if (r >= RMS_ON) {
          rawAbove = true
          scheduleVisual(true)
        }
      }, POLL_MS)
      void ctx.resume().catch(() => {})
    } catch {
      /* ignore: rare tap failure on exotic devices */
    }
  }

  onMounted(() => {
    if (isAudioPlaybackUnlocked()) {
      void ctx.resume().catch(() => {})
    }
  })

  watch(
    () => [getIsLocal(), getAudioEnabled(), getStream()?.id, getStream()?.getAudioTracks()[0]?.id] as const,
    () => {
      if (!getIsLocal()) {
        disconnectGraph()
        return
      }
      connectFromStream(getStream() ?? null)
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    disconnectGraph()
  })

  onUnmounted(() => {
    offAudioUnlock()
  })

  return visual
}
