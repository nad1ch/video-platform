import { type ComputedRef, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import {
  isAudioPlaybackUnlocked,
  playAllPageAudio,
  registerAudioUnlockHook,
} from './audioPlaybackUnlock'

const RESUME_POLL_MS = 2000

export type ActiveSpeakerTile = {
  peerId: string
  stream: MediaStream | null
  audioEnabled: boolean
}

type PeerNode = {
  trackId: string
  source: MediaStreamAudioSourceNode
  analyser: AnalyserNode
  disconnect: () => void
}

const FFT_SIZE = 512
/** Normalized RMS above this counts as "speaking" (tune for mic / room). */
const SPEAK_THRESHOLD = 0.04

function rmsTimeDomain(analyser: AnalyserNode): number {
  const buf = new Uint8Array(analyser.fftSize)
  analyser.getByteTimeDomainData(buf)
  let sum = 0
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i]! - 128) / 128
    sum += v * v
  }
  return Math.sqrt(sum / buf.length)
}

export function useActiveSpeaker(
  tiles: ComputedRef<ActiveSpeakerTile[]>,
  inCall: ComputedRef<boolean>,
) {
  const activeSpeakerPeerId = shallowRef<string | null>(null)
  const ctx = new AudioContext()
  const nodes = new Map<string, PeerNode>()
  let raf = 0
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
    playAllPageAudio()
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
      return
    }

    const alive = new Set<string>()
    for (const t of tiles.value) {
      if (!t.audioEnabled || !t.stream) {
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
        const source = ctx.createMediaStreamSource(t.stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = FFT_SIZE
        source.connect(analyser)
        const disconnect = (): void => {
          source.disconnect()
          analyser.disconnect()
        }
        nodes.set(t.peerId, { trackId: track.id, source, analyser, disconnect })
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

  function tick(): void {
    if (!inCall.value || nodes.size === 0) {
      raf = 0
      return
    }

    if (ctx.state === 'running') {
      let bestId: string | null = null
      let bestLevel = 0
      for (const [peerId, { analyser }] of nodes) {
        const level = rmsTimeDomain(analyser)
        if (level > bestLevel) {
          bestLevel = level
          bestId = peerId
        }
      }
      activeSpeakerPeerId.value =
        bestId !== null && bestLevel >= SPEAK_THRESHOLD ? bestId : null
    }

    raf = requestAnimationFrame(tick)
  }

  function startRaf(): void {
    if (raf !== 0) {
      return
    }
    raf = requestAnimationFrame(tick)
  }

  function stopRaf(): void {
    if (raf !== 0) {
      cancelAnimationFrame(raf)
      raf = 0
    }
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
            `${t.peerId}:${t.stream?.id ?? ''}:${t.audioEnabled}:${t.stream?.getAudioTracks()[0]?.id ?? ''}:${t.stream?.getAudioTracks()[0]?.readyState ?? ''}`,
        ),
    ],
    () => {
      syncGraph()
      stopRaf()
      if (inCall.value && nodes.size > 0) {
        startRaf()
      }
    },
    { immediate: true },
  )

  onUnmounted(() => {
    stopRaf()
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
    void ctx.close()
  })

  return { activeSpeakerPeerId }
}
