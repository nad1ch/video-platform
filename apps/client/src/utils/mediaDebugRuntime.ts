/**
 * Tiny in-memory registry of per-tile media element snapshots used by the
 * dev `?mediaDebug=1` panel and the `window.__MEDIA_DEBUG__` console helpers.
 *
 * Always safe to populate: the registry is just a `Map`. The diagnostics panel
 * is gated by `?mediaDebug=1` AND `import.meta.env.DEV` in the consumer, so
 * production users never see anything. The console helpers are also gated.
 *
 * No mediasoup state lives here. No Vue reactivity (deliberately) — we want
 * the registry to be lock-free and not pin component refs across teardown.
 */

export type MediaDebugAudioSnapshot = {
  el: HTMLAudioElement | null
  paused: boolean
  muted: boolean
  volume: number
  readyState: number
  hasSrcObject: boolean
  trackId: string | null
  trackMuted: boolean | null
  trackEnabled: boolean | null
  trackReadyState: 'live' | 'ended' | null
  usingWebAudio: boolean
  audioCtxState: AudioContextState | 'unknown'
  gainValue: number | null
  /**
   * "Server says this peer should be sending audio right now" — derived from
   * call-core's `tile.audioEnabled` (live track + no `peer-audio-muted` from
   * server). When true AND `trackMuted === true`, the audio stall watchdog
   * is actively measuring duration toward a 30s emit threshold.
   */
  audioEnabled: boolean
  /**
   * How long (ms) the watchdog has continuously observed the
   * `audioEnabled && trackMuted && !listenMuted` anomaly. 0 when not in
   * anomaly. Resets on track id change, listenMuted = true, or track unmute.
   */
  audioMutedDurationMs: number
  /** True when the watchdog has emitted `audioStall` for the current anomaly cycle. */
  audioStalled: boolean
}

export type MediaDebugVideoSnapshot = {
  el: HTMLVideoElement | null
  currentTime: number
  readyState: number
  videoWidth: number
  videoHeight: number
  paused: boolean
  trackId: string | null
  trackMuted: boolean | null
  trackEnabled: boolean | null
  trackReadyState: 'live' | 'ended' | null
  /** Last `currentTime` recorded by the stall watchdog; -1 if never sampled. */
  lastSampleCurrentTime: number
  lastSampleAt: number
  /** Detected stall (advanced > 6s without forward progress). */
  stalled: boolean
  /** Local-only: tile's playback was intentionally suppressed. */
  playbackSuppressed: boolean
}

type AudioReader = () => MediaDebugAudioSnapshot
type VideoReader = () => MediaDebugVideoSnapshot

const audioReaders = new Map<string, AudioReader>()
const videoReaders = new Map<string, VideoReader>()

let mediaDebugQueryFlag: boolean | null = null

function readMediaDebugQueryFlag(): boolean {
  if (mediaDebugQueryFlag !== null) {
    return mediaDebugQueryFlag
  }
  if (typeof window === 'undefined') {
    mediaDebugQueryFlag = false
    return false
  }
  try {
    const q = new URLSearchParams(window.location.search).get('mediaDebug')
    mediaDebugQueryFlag = q === '1' || q === 'true'
  } catch {
    mediaDebugQueryFlag = false
  }
  return mediaDebugQueryFlag
}

export function isMediaDebugEnabled(): boolean {
  return readMediaDebugQueryFlag()
}

export function registerAudioDebugReader(peerId: string, reader: AudioReader): () => void {
  audioReaders.set(peerId, reader)
  return () => {
    if (audioReaders.get(peerId) === reader) {
      audioReaders.delete(peerId)
    }
  }
}

export function registerVideoDebugReader(peerId: string, reader: VideoReader): () => void {
  videoReaders.set(peerId, reader)
  return () => {
    if (videoReaders.get(peerId) === reader) {
      videoReaders.delete(peerId)
    }
  }
}

export function dumpAudioDebug(): Record<string, MediaDebugAudioSnapshot> {
  const out: Record<string, MediaDebugAudioSnapshot> = {}
  for (const [peerId, reader] of audioReaders) {
    try {
      out[peerId] = reader()
    } catch {
      /* drop unreadable entries */
    }
  }
  return out
}

export function dumpVideoDebug(): Record<string, MediaDebugVideoSnapshot> {
  const out: Record<string, MediaDebugVideoSnapshot> = {}
  for (const [peerId, reader] of videoReaders) {
    try {
      out[peerId] = reader()
    } catch {
      /* drop unreadable entries */
    }
  }
  return out
}

export function dumpAllDebug(): {
  audio: Record<string, MediaDebugAudioSnapshot>
  video: Record<string, MediaDebugVideoSnapshot>
} {
  return { audio: dumpAudioDebug(), video: dumpVideoDebug() }
}

/**
 * Timer drift probe for OBS browser source / hidden tab throttling detection.
 *
 * OBS Browser Source (CEF) and Chromium hidden tabs can throttle setInterval /
 * requestAnimationFrame to as low as 1 Hz when the surface is offscreen. Our
 * recovery watchdogs (StreamVideo currentTime stall, StreamAudio AudioContext
 * heartbeat, the Mafia overlay timer) all rely on regular timer cadence; if
 * the host's OBS browser source is throttled, these watchdogs miss events and
 * the user sees stale media without any in-app signal.
 *
 * The probe is a single ~2 s interval that records `Date.now()` deltas. When
 * the actual delta exceeds the expected by a wide margin, the wall clock
 * clearly advanced more than the timer fired — i.e., we were throttled. The
 * probe always runs while the call route is mounted (cost is one timer per
 * page); the WARN log is rate-limited so production tabs only see it when a
 * real drift event happens.
 */
export type MediaDebugTimerDrift = {
  /** Whether the probe is currently running. */
  running: boolean
  /** Wall-clock ms at the previous tick. 0 before the first sample. */
  lastTickAt: number
  /** Wall-clock delta from the previous tick (ms). 0 before the second sample. */
  lastDeltaMs: number
  /** Largest delta recorded since the probe started. */
  maxDeltaMs: number
  /** Number of ticks where `lastDeltaMs > THROTTLED_DELTA_MS` since start. */
  throttledTickCount: number
  /** Wall-clock ms when the most recent throttled tick was observed. */
  lastThrottledAt: number
}

const TIMER_DRIFT_INTERVAL_MS = 2000
const TIMER_DRIFT_THROTTLED_DELTA_MS = 8000
const TIMER_DRIFT_WARN_THROTTLE_MS = 60_000

const timerDrift: MediaDebugTimerDrift = {
  running: false,
  lastTickAt: 0,
  lastDeltaMs: 0,
  maxDeltaMs: 0,
  throttledTickCount: 0,
  lastThrottledAt: 0,
}
let timerDriftInterval: ReturnType<typeof setInterval> | null = null
let timerDriftLastWarnAt = 0

function tickTimerDrift(): void {
  const now = Date.now()
  if (timerDrift.lastTickAt === 0) {
    timerDrift.lastTickAt = now
    return
  }
  const delta = now - timerDrift.lastTickAt
  timerDrift.lastTickAt = now
  timerDrift.lastDeltaMs = delta
  if (delta > timerDrift.maxDeltaMs) {
    timerDrift.maxDeltaMs = delta
  }
  if (delta > TIMER_DRIFT_THROTTLED_DELTA_MS) {
    timerDrift.throttledTickCount += 1
    timerDrift.lastThrottledAt = now
    if (now - timerDriftLastWarnAt > TIMER_DRIFT_WARN_THROTTLE_MS) {
      timerDriftLastWarnAt = now
      console.warn('[media-debug] timer drift detected (likely OBS/hidden-tab throttling)', {
        deltaMs: delta,
        expectedMs: TIMER_DRIFT_INTERVAL_MS,
        throttledTickCount: timerDrift.throttledTickCount,
      })
    }
  }
}

/**
 * Install the timer-drift probe. Idempotent. Always-on while the call route
 * is mounted; cost is one setInterval at {@link TIMER_DRIFT_INTERVAL_MS}.
 * Diagnostic-only: no media side effects, no recovery actions taken.
 */
export function startMediaDebugTimerDriftProbe(): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }
  if (timerDriftInterval !== null) {
    return stopMediaDebugTimerDriftProbe
  }
  timerDrift.running = true
  timerDrift.lastTickAt = 0
  timerDrift.lastDeltaMs = 0
  timerDrift.maxDeltaMs = 0
  timerDrift.throttledTickCount = 0
  timerDrift.lastThrottledAt = 0
  timerDriftLastWarnAt = 0
  timerDriftInterval = setInterval(tickTimerDrift, TIMER_DRIFT_INTERVAL_MS)
  return stopMediaDebugTimerDriftProbe
}

export function stopMediaDebugTimerDriftProbe(): void {
  if (timerDriftInterval === null) {
    return
  }
  clearInterval(timerDriftInterval)
  timerDriftInterval = null
  timerDrift.running = false
}

export function readMediaDebugTimerDrift(): MediaDebugTimerDrift {
  return { ...timerDrift }
}

export const MEDIA_DEBUG_TIMER_DRIFT_INTERVAL_MS = TIMER_DRIFT_INTERVAL_MS
export const MEDIA_DEBUG_TIMER_DRIFT_THROTTLED_DELTA_MS = TIMER_DRIFT_THROTTLED_DELTA_MS

type MediaDebugGlobal = {
  dumpAudio: () => Record<string, MediaDebugAudioSnapshot>
  dumpVideo: () => Record<string, MediaDebugVideoSnapshot>
  dumpAll: () => ReturnType<typeof dumpAllDebug>
  timerDrift: () => MediaDebugTimerDrift
  forceSoftResync?: () => void
}

let globalInstalled = false

/**
 * Install `window.__MEDIA_DEBUG__`. Idempotent. Only callable when
 * `?mediaDebug=1` is set; otherwise no global is installed. CallPage wires
 * `forceSoftResync` from the call orchestrator at install time so the debug
 * helpers never need to import call-core themselves.
 */
export function installMediaDebugGlobal(opts: { forceSoftResync?: () => void }): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }
  if (!isMediaDebugEnabled()) {
    return () => {}
  }
  const api: MediaDebugGlobal = {
    dumpAudio: dumpAudioDebug,
    dumpVideo: dumpVideoDebug,
    dumpAll: dumpAllDebug,
    timerDrift: readMediaDebugTimerDrift,
    forceSoftResync: opts.forceSoftResync,
  }
  ;(window as unknown as { __MEDIA_DEBUG__?: MediaDebugGlobal }).__MEDIA_DEBUG__ = api
  globalInstalled = true
  return () => {
    if (!globalInstalled) return
    delete (window as unknown as { __MEDIA_DEBUG__?: MediaDebugGlobal }).__MEDIA_DEBUG__
    globalInstalled = false
  }
}
