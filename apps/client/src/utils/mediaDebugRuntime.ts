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

type MediaDebugGlobal = {
  dumpAudio: () => Record<string, MediaDebugAudioSnapshot>
  dumpVideo: () => Record<string, MediaDebugVideoSnapshot>
  dumpAll: () => ReturnType<typeof dumpAllDebug>
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
