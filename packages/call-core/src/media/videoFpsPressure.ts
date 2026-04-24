/**
 * Phase 3.5: inbound-rtp drop heuristics → render FPS multiplier (local-only, no protocol).
 */

import type { VideoInboundStatsRow } from './receiveVideoQualityPressure'

export type FpsRenderPressure = 'good' | 'degraded' | 'bad'

export type InboundVideoStatsRowInput = {
  peerId: string
  framesDecoded?: number
  framesDropped?: number
  framesPerSecond?: number
}

export const FPS_RENDER_PRESSURE_BAD_STREAK_DOWN = 3
export const FPS_RENDER_PRESSURE_GOOD_STREAK_UP = 4

export function aggregateInboundVideoStatsByPeerId(
  rows: ReadonlyArray<InboundVideoStatsRowInput>,
): Map<string, VideoInboundStatsRow> {
  type Acc = {
    framesDecoded: number
    framesDropped: number
    minFps: number
    fpsSamples: number
  }
  const acc = new Map<string, Acc>()
  for (const r of rows) {
    const id = typeof r.peerId === 'string' ? r.peerId.trim() : ''
    if (!id || id === '?') {
      continue
    }
    let a = acc.get(id)
    if (!a) {
      a = { framesDecoded: 0, framesDropped: 0, minFps: Number.POSITIVE_INFINITY, fpsSamples: 0 }
      acc.set(id, a)
    }
    if (typeof r.framesDecoded === 'number') {
      a.framesDecoded += r.framesDecoded
    }
    if (typeof r.framesDropped === 'number') {
      a.framesDropped += r.framesDropped
    }
    if (typeof r.framesPerSecond === 'number' && r.framesPerSecond > 0) {
      a.fpsSamples += 1
      a.minFps = Math.min(a.minFps, r.framesPerSecond)
    }
  }
  const out = new Map<string, VideoInboundStatsRow>()
  for (const [id, a] of acc) {
    out.set(id, {
      framesDecoded: a.framesDecoded,
      framesDropped: a.framesDropped,
      framesPerSecond:
        a.fpsSamples > 0 && Number.isFinite(a.minFps) ? a.minFps : undefined,
    })
  }
  return out
}

/**
 * Instantaneous pressure from aggregated inbound-rtp counters for one peer.
 * `unknown` = warmup / missing stats — keep hysteresis state unchanged.
 */
export function evaluateInboundFpsRenderPressure(
  stats: VideoInboundStatsRow | undefined,
): FpsRenderPressure | 'unknown' {
  if (!stats) {
    return 'unknown'
  }
  const dec = stats.framesDecoded ?? 0
  const drop = stats.framesDropped ?? 0
  const total = dec + drop
  if (total < 30) {
    return 'unknown'
  }
  const dropRatio = total > 0 ? drop / total : 0
  if (dropRatio > 0.25) {
    return 'bad'
  }
  if (dropRatio > 0.1) {
    return 'degraded'
  }
  return 'good'
}

/** Floor for throttled remote tiles; never ask playback pacing below 12fps. */
export const FPS_RENDER_PRESSURE_MIN_FPS = 12

export function applyFpsRenderPressure(baseFps: number, pressure: FpsRenderPressure): number {
  const b = Math.max(1, baseFps)
  switch (pressure) {
    case 'bad':
      return Math.max(FPS_RENDER_PRESSURE_MIN_FPS, Math.round(b * 0.8))
    case 'degraded':
      return Math.max(FPS_RENDER_PRESSURE_MIN_FPS, Math.round(b * 0.8))
    default:
      return Math.max(FPS_RENDER_PRESSURE_MIN_FPS, Math.round(b))
  }
}

export type FpsRenderPressureHysteresis = { bad: number; good: number; stable: FpsRenderPressure }

/**
 * Advances per-peer stable {@link FpsRenderPressure} using the same poll cadence as inbound stats.
 * Mutates `hysteresisByPeer` (bad/good streaks + stable tier).
 */
export function advancePlaybackRenderFpsPressureByPeer(input: {
  videoPeerIds: readonly string[]
  inboundRows: ReadonlyArray<InboundVideoStatsRowInput>
  hysteresisByPeer: Map<string, FpsRenderPressureHysteresis>
}): Map<string, FpsRenderPressure> {
  const byPeer = aggregateInboundVideoStatsByPeerId(input.inboundRows)
  const next = new Map<string, FpsRenderPressure>()

  for (const peerId of input.videoPeerIds) {
    const stats = byPeer.get(peerId)
    const instant = evaluateInboundFpsRenderPressure(stats)

    let h = input.hysteresisByPeer.get(peerId)
    if (!h) {
      h = { bad: 0, good: 0, stable: 'good' }
      input.hysteresisByPeer.set(peerId, h)
    }

    if (instant === 'unknown') {
      next.set(peerId, h.stable)
      continue
    }

    if (instant === 'good') {
      h.bad = 0
      h.good += 1
      if (h.stable !== 'good' && h.good >= FPS_RENDER_PRESSURE_GOOD_STREAK_UP) {
        if (h.stable === 'bad') {
          h.stable = 'degraded'
        } else if (h.stable === 'degraded') {
          h.stable = 'good'
        }
        h.good = 0
      }
    } else {
      h.good = 0
      h.bad += 1
      if (h.stable === 'bad') {
        h.bad = 0
      } else if (h.bad >= FPS_RENDER_PRESSURE_BAD_STREAK_DOWN) {
        if (h.stable === 'good') {
          h.stable = 'degraded'
        } else if (h.stable === 'degraded') {
          h.stable = 'bad'
        }
        h.bad = 0
      }
    }

    next.set(peerId, h.stable)
  }

  for (const pid of [...input.hysteresisByPeer.keys()]) {
    if (!input.videoPeerIds.includes(pid)) {
      input.hysteresisByPeer.delete(pid)
    }
  }

  return next
}
