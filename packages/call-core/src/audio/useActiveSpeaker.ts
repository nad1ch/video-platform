import { type ComputedRef, type Ref, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import { getAudioAnalysisAudioContext } from './audioAnalysisContext'
import {
  isAudioPlaybackUnlocked,
  playAllPageAudioThrottled,
  registerAudioUnlockHook,
} from './audioPlaybackUnlock'

const RESUME_POLL_MS = 2000

const SPEAK_ON = 0.05

const SPEAK_OFF = 0.02

/**
 * Audio analysis tick interval. Reactive `audioLevelsByPeerId` is consumed by per-tile
 * UI (ducking, mic-level glow). Driving Vue updates at 60 Hz fans into the call grid
 * (whole `CallPage` rerender per frame). The server `AudioLevelObserver` is the
 * authoritative active-speaker signal; this client analyser only smooths UI, so a
 * lower poll rate is sufficient and dramatically lowers CPU + GC pressure on mobile.
 */
const ANALYSIS_TICK_MS = 100

/**
 * Quantize raw RMS [0..1] before publishing to Vue so small, sub-perceptual flutter
 * (decoder noise floor) does not invalidate `audioLevelsByPeerId` and re-render
 * every tile. 16 buckets keep the speaking-glow visual at full fidelity.
 */
const LEVEL_QUANTIZATION_STEPS = 16

export type ActiveSpeakerTile = {
  peerId: string
  stream: MediaStream | null
  audioEnabled: boolean
  



  excludeFromLevelAnalysis?: boolean
}

type PeerNode = {
  trackId: string
  source: MediaStreamAudioSourceNode
  analyser: AnalyserNode
  /**
   * Pre-allocated time-domain buffer sized to `analyser.fftSize`, reused every tick
   * to avoid per-frame allocations. Backed by a fresh `ArrayBuffer` (not a generic
   * `ArrayBufferLike`) so it satisfies the WebAudio `Uint8Array<ArrayBuffer>`
   * `getByteTimeDomainData` parameter contract under TypeScript strict-typed lib.
   */
  buf: Uint8Array<ArrayBuffer>
  disconnect: () => void
}

const FFT_SIZE = 512

function rmsTimeDomain(analyser: AnalyserNode, buf: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(buf)
  let sum = 0
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i]! - 128) / 128
    sum += v * v
  }
  return Math.min(1, Math.sqrt(sum / buf.length))
}

function quantizeLevel(level: number): number {
  return Math.round(level * LEVEL_QUANTIZATION_STEPS) / LEVEL_QUANTIZATION_STEPS
}

export function useActiveSpeaker(
  tiles: ComputedRef<ActiveSpeakerTile[]>,
  
  inCall: Ref<boolean>,
) {
  const activeSpeakerPeerId = shallowRef<string | null>(null)
  const dominantSpeakerPeerId = shallowRef<string | null>(null)
  const audioLevelsByPeerId = shallowRef<Record<string, number>>({})
  const ctx = getAudioAnalysisAudioContext()
  const nodes = new Map<string, PeerNode>()
  let tickTimer: ReturnType<typeof setInterval> | null = null
  let resumePollId: ReturnType<typeof setInterval> | null = null

  function tryResumeAudioContext(): void {
    if (ctx.state === 'closed' || ctx.state === 'running') {
      return
    }
    void ctx.resume().catch(() => {})
  }

  ctx.onstatechange = () => {
    if (import.meta.env.DEV) {
      console.log('[audioContext] state:', ctx.state)
    }
    tryResumeAudioContext()
  }

  function onVisibilityChange(): void {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') {
      return
    }
    tryResumeAudioContext()
    playAllPageAudioThrottled()
  }

  function teardownPeer(peerId: string): void {
    const n = nodes.get(peerId)
    if (n) {
      n.disconnect()
      nodes.delete(peerId)
    }
  }

  function syncGraph(): void {
    if (!inCall.value) {
      for (const id of [...nodes.keys()]) {
        teardownPeer(id)
      }
      activeSpeakerPeerId.value = null
      dominantSpeakerPeerId.value = null
      audioLevelsByPeerId.value = {}
      return
    }

    const alive = new Set<string>()
    for (const t of tiles.value) {
      if (t.excludeFromLevelAnalysis || !t.audioEnabled || !t.stream) {
        continue
      }
      const track = t.stream.getAudioTracks()[0]
      if (!track || track.readyState !== 'live' || !track.enabled) {
        continue
      }
      alive.add(t.peerId)
      const existing = nodes.get(t.peerId)
      if (existing && existing.trackId === track.id) {
        continue
      }
      if (existing) {
        teardownPeer(t.peerId)
      }
      try {
        
        
        const audioOnlyStream = new MediaStream([track])
        const source = ctx.createMediaStreamSource(audioOnlyStream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = FFT_SIZE
        source.connect(analyser)
        const disconnect = (): void => {
          source.disconnect()
          analyser.disconnect()
        }
        nodes.set(t.peerId, {
          trackId: track.id,
          source,
          analyser,
          buf: new Uint8Array(new ArrayBuffer(analyser.fftSize)),
          disconnect,
        })
      } catch {
        /* ignore */
      }
    }

    for (const id of [...nodes.keys()]) {
      if (!alive.has(id)) {
        teardownPeer(id)
      }
    }
  }

  /**
   * Quantized levels last published into the reactive `audioLevelsByPeerId`. We compare
   * against this map (not the raw float levels) so reactive identity only changes when
   * a peer crosses a quantization bucket, eliminating the per-frame Vue re-render storm
   * across `CallPage` / `ParticipantTile`.
   */
  const lastQuantizedLevels = new Map<string, number>()

  function tick(): void {
    if (!inCall.value || nodes.size === 0) {
      return
    }

    if (ctx.state !== 'running') {
      return
    }

    const levels = new Map<string, number>()
    let bestId: string | null = null
    let bestLevel = 0
    let quantizedChanged = false

    for (const [peerId, node] of nodes) {
      const lvl = rmsTimeDomain(node.analyser, node.buf)
      levels.set(peerId, lvl)
      if (lvl > bestLevel) {
        bestLevel = lvl
        bestId = peerId
      }
      const q = quantizeLevel(lvl)
      if (lastQuantizedLevels.get(peerId) !== q) {
        lastQuantizedLevels.set(peerId, q)
        quantizedChanged = true
      }
    }

    
    
    
    for (const peerId of [...lastQuantizedLevels.keys()]) {
      if (!levels.has(peerId)) {
        lastQuantizedLevels.delete(peerId)
        quantizedChanged = true
      }
    }

    if (quantizedChanged) {
      const next: Record<string, number> = {}
      for (const [peerId, q] of lastQuantizedLevels) {
        next[peerId] = q
      }
      audioLevelsByPeerId.value = next
    }

    
    
    const dom = bestId !== null && bestLevel >= SPEAK_ON ? bestId : null
    if (dominantSpeakerPeerId.value !== dom) {
      dominantSpeakerPeerId.value = dom
    }

    const cur = activeSpeakerPeerId.value
    const curLevel = cur !== null ? (levels.get(cur) ?? 0) : 0
    let nextActive: string | null
    if (cur !== null && curLevel >= SPEAK_OFF) {
      nextActive = cur
      if (
        bestId !== null &&
        bestId !== cur &&
        bestLevel >= SPEAK_ON &&
        bestLevel > curLevel
      ) {
        nextActive = bestId
      }
    } else {
      nextActive = bestId !== null && bestLevel >= SPEAK_ON ? bestId : null
    }
    if (activeSpeakerPeerId.value !== nextActive) {
      activeSpeakerPeerId.value = nextActive
    }
  }

  function startTickLoop(): void {
    if (tickTimer !== null) {
      return
    }
    tickTimer = setInterval(tick, ANALYSIS_TICK_MS)
  }

  function stopTickLoop(): void {
    if (tickTimer !== null) {
      clearInterval(tickTimer)
      tickTimer = null
    }
    lastQuantizedLevels.clear()
  }

  const offUnlock = registerAudioUnlockHook(() => {
    void ctx.resume()
  })

  onMounted(() => {
    if (isAudioPlaybackUnlocked()) {
      void ctx.resume()
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }
  })

  watch(
    inCall,
    (ic) => {
      if (resumePollId !== null) {
        clearInterval(resumePollId)
        resumePollId = null
      }
      if (ic) {
        resumePollId = setInterval(() => {
          tryResumeAudioContext()
        }, RESUME_POLL_MS)
      }
    },
    { immediate: true },
  )

  watch(
    [
      inCall,
      () =>
        tiles.value.map(
          (t) =>
            `${t.peerId}:${t.excludeFromLevelAnalysis ? 'x' : ''}:${t.stream?.id ?? ''}:${t.audioEnabled}:${t.stream?.getAudioTracks()[0]?.id ?? ''}:${t.stream?.getAudioTracks()[0]?.readyState ?? ''}`,
        ),
    ],
    () => {
      syncGraph()
      stopTickLoop()
      if (inCall.value && nodes.size > 0) {
        startTickLoop()
      }
    },
    { immediate: true },
  )

  onUnmounted(() => {
    stopTickLoop()
    if (resumePollId !== null) {
      clearInterval(resumePollId)
      resumePollId = null
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    ctx.onstatechange = null
    offUnlock()
    for (const id of [...nodes.keys()]) {
      teardownPeer(id)
    }
    dominantSpeakerPeerId.value = null
    audioLevelsByPeerId.value = {}
  })

  return { activeSpeakerPeerId, dominantSpeakerPeerId, audioLevelsByPeerId }
}
