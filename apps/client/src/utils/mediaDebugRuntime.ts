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

/**
 * Producer-resync counters maintained by `CallPage.triggerMediaStallRecovery`.
 *
 * Every fire / skip increments the corresponding counter and stamps the kind +
 * timestamp; the panel and `__MEDIA_DEBUG__.resyncStats()` surface them so
 * post-incident analysis can correlate flicker / blackout reports with the
 * exact resync ladder activity. No timers, no work — just write paths called
 * from the existing handler.
 */
export type MediaDebugResyncStats = {
  softResyncCount: number
  lastSoftResyncAt: number
  lastSoftResyncKind: 'audio' | 'video' | null
  hardResyncCount: number
  lastHardResyncAt: number
  lastHardResyncKind: 'audio' | 'video' | null
  /**
   * Hard escalations the policy WOULD have fired but skipped because the tab
   * is in OBS / `?mode=view`. Counts up every time the OBS-view guard
   * intercepts an escalation. Useful to confirm the guard actually fired
   * during a stream and to size the tail of "operator should refresh OBS
   * source" prompts on the next stream.
   */
  hardResyncSkippedCount: number
  lastHardResyncSkippedAt: number
  lastHardResyncSkippedKind: 'audio' | 'video' | null
}

const resyncStats: MediaDebugResyncStats = {
  softResyncCount: 0,
  lastSoftResyncAt: 0,
  lastSoftResyncKind: null,
  hardResyncCount: 0,
  lastHardResyncAt: 0,
  lastHardResyncKind: null,
  hardResyncSkippedCount: 0,
  lastHardResyncSkippedAt: 0,
  lastHardResyncSkippedKind: null,
}

export function recordMediaDebugSoftResync(kind: 'audio' | 'video'): void {
  resyncStats.softResyncCount += 1
  resyncStats.lastSoftResyncAt = Date.now()
  resyncStats.lastSoftResyncKind = kind
}

export function recordMediaDebugHardResync(kind: 'audio' | 'video'): void {
  resyncStats.hardResyncCount += 1
  resyncStats.lastHardResyncAt = Date.now()
  resyncStats.lastHardResyncKind = kind
}

export function recordMediaDebugHardResyncSkipped(kind: 'audio' | 'video'): void {
  resyncStats.hardResyncSkippedCount += 1
  resyncStats.lastHardResyncSkippedAt = Date.now()
  resyncStats.lastHardResyncSkippedKind = kind
}

export function readMediaDebugResyncStats(): MediaDebugResyncStats {
  return { ...resyncStats }
}

/**
 * requestAnimationFrame pacing probe. OBS Browser Source can throttle rAF
 * down to ~1 Hz when the source is occluded; the timer-drift probe above
 * catches setInterval throttling but rAF behaves differently in some
 * Chromium versions. This probe answers: "is the page's render loop
 * actually running at full speed right now?"
 *
 * The loop is a single rAF chain (one callback per frame on a healthy
 * host = ~60 cb/s). Each callback updates a 1-s rolling FPS estimate and
 * counts frames whose delta exceeds {@link RAF_LONG_FRAME_DELTA_MS}.
 * Stopped via the returned disposer; the chain self-terminates when
 * `running` is false.
 */
export type MediaDebugRafStats = {
  running: boolean
  /** Rolling 1-s estimate of frames per second. 0 before the first window completes. */
  approxFps: number
  /** Largest inter-frame delta seen since the probe started (ms). */
  maxFrameDeltaMs: number
  /** Frames seen with delta > {@link MEDIA_DEBUG_RAF_LONG_FRAME_DELTA_MS}. */
  longFrameCount: number
  /** Wall-clock ms of the most recent rAF callback. */
  lastFrameAt: number
  /** Total rAF callbacks since start (sanity). */
  totalFrameCount: number
}

const RAF_LONG_FRAME_DELTA_MS = 100
const RAF_FPS_WINDOW_MS = 1000
const rafStats: MediaDebugRafStats = {
  running: false,
  approxFps: 0,
  maxFrameDeltaMs: 0,
  longFrameCount: 0,
  lastFrameAt: 0,
  totalFrameCount: 0,
}
let rafProbeRunning = false
let rafWindowFrameCount = 0
let rafWindowStartedAt = 0
/**
 * Handle of the currently-pending `requestAnimationFrame` callback. Tracked
 * so {@link stopMediaDebugRafProbe} can `cancelAnimationFrame` an in-flight
 * tick — without this, a route unmount + remount inside one frame
 * (~16 ms, e.g. very fast Vue route swap) could leave a stale tick queued
 * that survives the unmount, sees `rafProbeRunning = true` again after the
 * fresh start, and schedules a second concurrent chain. The handle-based
 * cancel makes start/stop deterministic across re-entry.
 */
let rafProbeHandle: number | null = null

function tickRafProbe(now: number): void {
  rafProbeHandle = null
  if (!rafProbeRunning) return
  rafStats.totalFrameCount += 1
  if (rafStats.lastFrameAt > 0) {
    const delta = now - rafStats.lastFrameAt
    if (delta > rafStats.maxFrameDeltaMs) {
      rafStats.maxFrameDeltaMs = delta
    }
    if (delta > RAF_LONG_FRAME_DELTA_MS) {
      rafStats.longFrameCount += 1
    }
  }
  rafStats.lastFrameAt = now
  if (rafWindowStartedAt === 0) {
    rafWindowStartedAt = now
    rafWindowFrameCount = 0
  } else if (now - rafWindowStartedAt >= RAF_FPS_WINDOW_MS) {
    rafStats.approxFps = Math.round(
      (rafWindowFrameCount * 1000) / Math.max(1, now - rafWindowStartedAt),
    )
    rafWindowStartedAt = now
    rafWindowFrameCount = 0
  } else {
    rafWindowFrameCount += 1
  }
  if (typeof requestAnimationFrame === 'function') {
    rafProbeHandle = requestAnimationFrame(tickRafProbe)
  }
}

export function startMediaDebugRafProbe(): () => void {
  if (typeof window === 'undefined' || typeof requestAnimationFrame !== 'function') {
    return () => {}
  }
  if (rafProbeRunning) {
    return stopMediaDebugRafProbe
  }
  rafProbeRunning = true
  rafStats.running = true
  rafStats.approxFps = 0
  rafStats.maxFrameDeltaMs = 0
  rafStats.longFrameCount = 0
  rafStats.lastFrameAt = 0
  rafStats.totalFrameCount = 0
  rafWindowFrameCount = 0
  rafWindowStartedAt = 0
  rafProbeHandle = requestAnimationFrame(tickRafProbe)
  return stopMediaDebugRafProbe
}

export function stopMediaDebugRafProbe(): void {
  rafProbeRunning = false
  rafStats.running = false
  if (rafProbeHandle !== null && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(rafProbeHandle)
    rafProbeHandle = null
  }
}

export function readMediaDebugRafStats(): MediaDebugRafStats {
  return { ...rafStats }
}

export const MEDIA_DEBUG_RAF_LONG_FRAME_DELTA_MS = RAF_LONG_FRAME_DELTA_MS

/**
 * WebSocket lifecycle counters. Maintained by a Vue watcher in CallPage that
 * observes the existing `wsStatus` ref from `useCallOrchestrator` — no
 * call-core change required. Useful to detect OBS Browser Source WS
 * instability that would otherwise be invisible: the streamer's host page
 * may stay connected while the OBS source flaps.
 */
export type MediaDebugWsStats = {
  /** Most recent observed `wsStatus` ref value (string). */
  currentStatus: string | null
  /** Wall-clock ms when `currentStatus` was last updated. */
  lastTransitionAt: number
  /** Number of times the status went TO `'open'`. Includes initial connect. */
  openCount: number
  /** Number of times the status went TO `'closed'`. */
  closeCount: number
  /** Number of times the status went TO `'error'`. */
  errorCount: number
  /**
   * Number of `closed → open` (or `error → open`) transitions. Excludes the
   * initial connect (`null → open` or `'idle' → 'connecting' → 'open'`).
   */
  reconnectCount: number
}

const wsStats: MediaDebugWsStats = {
  currentStatus: null,
  lastTransitionAt: 0,
  openCount: 0,
  closeCount: 0,
  errorCount: 0,
  reconnectCount: 0,
}

export function recordMediaDebugWsTransition(prev: string | null, next: string): void {
  wsStats.currentStatus = next
  wsStats.lastTransitionAt = Date.now()
  if (next === 'open') {
    wsStats.openCount += 1
    if (prev === 'closed' || prev === 'error') {
      wsStats.reconnectCount += 1
    }
  } else if (next === 'closed') {
    wsStats.closeCount += 1
  } else if (next === 'error') {
    wsStats.errorCount += 1
  }
}

export function readMediaDebugWsStats(): MediaDebugWsStats {
  return { ...wsStats }
}

/**
 * Counts of incoming signaling messages by type. Updated by a single
 * `subscribeSignalingMessage(...)` registered in CallPage that does NOT
 * apply state — it only counts. The selected types are the ones whose
 * volume tells us about teardown / rebuild storms during a stream:
 *   - `producer-sync`: server resync. The `producerSyncClientRefreshCount`
 *     sub-counter tracks the dangerous `client-refresh` reason that
 *     triggers `teardownAllRemoteConsumers` and the public-stream
 *     "all cameras → fallback icons" flicker.
 *   - `new-producer` / `producer-closed`: per-track rebuild churn.
 *   - `room-state`: heavy join/replay.
 *   - `peer-joined` / `peer-left`: roster churn.
 *   - `mafia:player-life-state` and other Mafia state messages are NOT
 *     counted to keep the diff narrow; if needed later, extend the recorder.
 *
 * Anything not in the explicit allowlist increments only `otherCount`.
 */
export type MediaDebugSignalingStats = {
  producerSyncCount: number
  producerSyncClientRefreshCount: number
  newProducerCount: number
  producerClosedCount: number
  roomStateCount: number
  peerJoinedCount: number
  peerLeftCount: number
  mafiaSnapshotApplyCount: number
  otherCount: number
  lastTrackedAt: number
  lastTrackedType: string | null
}

const signalingStats: MediaDebugSignalingStats = {
  producerSyncCount: 0,
  producerSyncClientRefreshCount: 0,
  newProducerCount: 0,
  producerClosedCount: 0,
  roomStateCount: 0,
  peerJoinedCount: 0,
  peerLeftCount: 0,
  mafiaSnapshotApplyCount: 0,
  otherCount: 0,
  lastTrackedAt: 0,
  lastTrackedType: null,
}

export function recordMediaDebugSignalingIncoming(type: string, extra?: { syncReason?: string }): void {
  signalingStats.lastTrackedAt = Date.now()
  signalingStats.lastTrackedType = type
  switch (type) {
    case 'producer-sync':
      signalingStats.producerSyncCount += 1
      if (extra?.syncReason === 'client-refresh') {
        signalingStats.producerSyncClientRefreshCount += 1
      }
      return
    case 'new-producer':
      signalingStats.newProducerCount += 1
      return
    case 'producer-closed':
      signalingStats.producerClosedCount += 1
      return
    case 'room-state':
      signalingStats.roomStateCount += 1
      return
    case 'peer-joined':
      signalingStats.peerJoinedCount += 1
      return
    case 'peer-left':
      signalingStats.peerLeftCount += 1
      return
    default:
      // Mafia snapshot block messages — surface a single counter for
      // "OBS request-snapshot reply applied" without enumerating every
      // mafia:* type.
      if (
        type === 'mafia:player-life-state' ||
        type === 'mafia:players-update' ||
        type === 'mafia:reshuffle' ||
        type === 'mafia:audio-mix-update' ||
        type === 'mafia:host-updated' ||
        type === 'mafia:force-mute-all'
      ) {
        signalingStats.mafiaSnapshotApplyCount += 1
        return
      }
      signalingStats.otherCount += 1
      return
  }
}

export function readMediaDebugSignalingStats(): MediaDebugSignalingStats {
  return { ...signalingStats }
}

/**
 * Static environment information set once at CallPage mount. Surfaces in
 * the panel so a screenshot on incident report is self-describing — what
 * was the host, was it view mode, how many cores, was the page hidden.
 */
export type MediaDebugEnvInfo = {
  isMafiaView: boolean
  /**
   * `/app/game-template` view mode — neutral counterpart of `isMafiaView`.
   * Writers (Game Template) set this directly; production Mafia continues
   * to set `isMafiaView`. Both feed `isViewMode`.
   */
  isGameRoomView: boolean
  isEatFirstView: boolean
  isViewMode: boolean
  hardwareConcurrency: number | null
  deviceMemoryGb: number | null
  userAgentLabel: string | null
  installedAt: number
}

const envInfo: MediaDebugEnvInfo = {
  isMafiaView: false,
  isGameRoomView: false,
  isEatFirstView: false,
  isViewMode: false,
  hardwareConcurrency: null,
  deviceMemoryGb: null,
  userAgentLabel: null,
  installedAt: 0,
}

export function setMediaDebugEnvInfo(
  input: Partial<Pick<MediaDebugEnvInfo, 'isMafiaView' | 'isGameRoomView' | 'isEatFirstView'>>,
): void {
  if (typeof input.isMafiaView === 'boolean') envInfo.isMafiaView = input.isMafiaView
  if (typeof input.isGameRoomView === 'boolean') envInfo.isGameRoomView = input.isGameRoomView
  if (typeof input.isEatFirstView === 'boolean') envInfo.isEatFirstView = input.isEatFirstView
  envInfo.isViewMode = envInfo.isMafiaView || envInfo.isGameRoomView || envInfo.isEatFirstView
  if (envInfo.installedAt === 0 && typeof window !== 'undefined') {
    envInfo.installedAt = Date.now()
    const nav = (typeof navigator !== 'undefined' ? navigator : null) as
      | (Navigator & { deviceMemory?: number })
      | null
    envInfo.hardwareConcurrency = nav?.hardwareConcurrency ?? null
    envInfo.deviceMemoryGb = typeof nav?.deviceMemory === 'number' ? nav.deviceMemory : null
    const ua = nav?.userAgent ?? ''
    envInfo.userAgentLabel = ua ? ua.slice(0, 200) : null
  }
}

export function readMediaDebugEnvInfo(): MediaDebugEnvInfo & { documentVisibilityState: string | null } {
  const documentVisibilityState =
    typeof document !== 'undefined' && typeof document.visibilityState === 'string'
      ? document.visibilityState
      : null
  return { ...envInfo, documentVisibilityState }
}

type MediaDebugGlobal = {
  dumpAudio: () => Record<string, MediaDebugAudioSnapshot>
  dumpVideo: () => Record<string, MediaDebugVideoSnapshot>
  dumpAll: () => ReturnType<typeof dumpAllDebug>
  timerDrift: () => MediaDebugTimerDrift
  resyncStats: () => MediaDebugResyncStats
  rafStats: () => MediaDebugRafStats
  wsStats: () => MediaDebugWsStats
  signalingStats: () => MediaDebugSignalingStats
  envInfo: () => ReturnType<typeof readMediaDebugEnvInfo>
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
    resyncStats: readMediaDebugResyncStats,
    rafStats: readMediaDebugRafStats,
    wsStats: readMediaDebugWsStats,
    signalingStats: readMediaDebugSignalingStats,
    envInfo: readMediaDebugEnvInfo,
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
