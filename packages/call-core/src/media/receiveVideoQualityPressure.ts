/**
 * Local-only receive-side video pressure: downgrades *preferred* simulcast layers (never audio / never pause).
 */

import type { SimulcastPreferredLayers } from './adaptiveVideoPreferredLayers'

export type ReceiveQualityPressure = 'normal' | 'constrained' | 'critical'

export type VideoInboundStatsRow = {
  framesDecoded?: number
  framesDropped?: number
  framesPerSecond?: number
  packetsLost?: number
  jitter?: number
}

export type PeerRecvLayerCategory = 'active' | 'pinned' | 'visible' | 'off'

function clampDown(
  a: SimulcastPreferredLayers,
  cap: SimulcastPreferredLayers,
): SimulcastPreferredLayers {
  return {
    spatialLayer: (Math.min(a.spatialLayer, cap.spatialLayer) as 0 | 1 | 2),
    temporalLayer: (Math.min(a.temporalLayer, cap.temporalLayer) as 0 | 1 | 2),
  }
}

function constrainVisibleSoftly(): SimulcastPreferredLayers {
  return {
    spatialLayer: 1,
    temporalLayer: 0,
  }
}

/**
 * Per-user category for layer caps. `visible` = on-screen (default when key missing).
 */
export function peerRecvLayerCategory(
  peerId: string,
  input: {
    activeSpeakerPeerId: string | null
    uiActiveSpeakerPeerId?: string | null
    pinnedPeerId: string | null
    peerVisibility: ReadonlyMap<string, boolean>
  },
): PeerRecvLayerCategory {
  if (input.activeSpeakerPeerId === peerId || input.uiActiveSpeakerPeerId === peerId) {
    return 'active'
  }
  if (input.pinnedPeerId === peerId) {
    return 'pinned'
  }
  if (input.peerVisibility.get(peerId) === false) {
    return 'off'
  }
  return 'visible'
}

/**
 * Further reduces {@link base} when receive path is under pressure.
 * In `normal`, avoid LOW entirely so healthy clients do not get unnecessary low-quality tiles.
 */
export function applyReceiveQualityPressureToLayers(
  base: Map<string, SimulcastPreferredLayers>,
  pressure: ReceiveQualityPressure,
  input: {
    activeSpeakerPeerId: string | null
    uiActiveSpeakerPeerId?: string | null
    pinnedPeerId: string | null
    peerVisibility: ReadonlyMap<string, boolean>
  },
): Map<string, SimulcastPreferredLayers> {
  if (pressure === 'normal') {
    const out = new Map<string, SimulcastPreferredLayers>()
    for (const [peerId, layers] of base) {
      out.set(
        peerId,
        layers.spatialLayer === 0
          ? { spatialLayer: 1, temporalLayer: Math.max(1, layers.temporalLayer) as 1 | 2 }
          : layers,
      )
    }
    return out
  }

  const out = new Map<string, SimulcastPreferredLayers>()

  for (const [peerId, layers] of base) {
    const cat = peerRecvLayerCategory(peerId, input)
    if (pressure === 'constrained') {
      if (cat === 'active' || cat === 'pinned') {
        out.set(peerId, clampDown(layers, { spatialLayer: 2, temporalLayer: 1 }))
      } else if (cat === 'visible') {
        out.set(peerId, constrainVisibleSoftly())
      } else {
        out.set(peerId, clampDown(layers, { spatialLayer: 0, temporalLayer: 0 }))
      }
    } else {
      // critical: never drop **active** or **pinned** to spatial 0 (LOW); others fall back to R0.
      if (cat === 'active' || cat === 'pinned') {
        out.set(peerId, clampDown(layers, { spatialLayer: 1, temporalLayer: 1 }))
      } else {
        out.set(peerId, clampDown(layers, { spatialLayer: 0, temporalLayer: 0 }))
      }
    }
  }

  return out
}

const MIN_FRAMES_WARMUP = 24

export type InboundVideoStatsVerdict = 'bad' | 'good' | 'unknown'

/**
 * Heuristic, conservative: if stats are too thin, returns `unknown` (caller should not move hysteresis).
 */
export function evaluateInboundVideoStatsForPressure(
  rows: VideoInboundStatsRow[],
  previousPacketsLostSum: number | null,
): { verdict: InboundVideoStatsVerdict; packetsLostSum: number; debug?: Record<string, unknown> } {
  const videoRows = rows.filter(
    (r) =>
      (typeof r.framesDecoded === 'number' && r.framesDecoded > 0) ||
      (typeof r.framesPerSecond === 'number' && r.framesPerSecond > 0),
  )
  if (videoRows.length === 0) {
    return { verdict: 'unknown', packetsLostSum: 0 }
  }

  let totalDec = 0
  let totalDrop = 0
  let packetsLostSum = 0
  let minFps = Number.POSITIVE_INFINITY
  let fpsCount = 0
  for (const r of videoRows) {
    if (typeof r.framesDecoded === 'number') {
      totalDec += r.framesDecoded
    }
    if (typeof r.framesDropped === 'number') {
      totalDrop += r.framesDropped
    }
    if (typeof r.packetsLost === 'number' && r.packetsLost >= 0) {
      packetsLostSum += r.packetsLost
    }
    if (typeof r.framesPerSecond === 'number' && r.framesPerSecond > 0) {
      fpsCount += 1
      if (r.framesPerSecond < minFps) {
        minFps = r.framesPerSecond
      }
    }
  }

  if (totalDec < MIN_FRAMES_WARMUP) {
    return { verdict: 'unknown', packetsLostSum, debug: { reason: 'warmup', totalDec } }
  }

  const dropDenom = totalDec + totalDrop
  const dropRatio = dropDenom > 0 ? totalDrop / dropDenom : 0

  if (minFps < 7 && fpsCount > 0) {
    return { verdict: 'bad', packetsLostSum, debug: { minFps, dropRatio } }
  }
  if (dropRatio > 0.1) {
    return { verdict: 'bad', packetsLostSum, debug: { dropRatio } }
  }
  if (
    previousPacketsLostSum !== null &&
    packetsLostSum - previousPacketsLostSum > 8
  ) {
    return { verdict: 'bad', packetsLostSum, debug: { deltaLoss: packetsLostSum - previousPacketsLostSum } }
  }

  const lossDelta =
    previousPacketsLostSum === null ? 0 : Math.max(0, packetsLostSum - previousPacketsLostSum)

  if (dropRatio < 0.025 && lossDelta <= 3) {
    if (fpsCount === 0) {
      return { verdict: 'good', packetsLostSum, debug: { dropRatio } }
    }
    if (!Number.isNaN(minFps) && minFps > 9) {
      return { verdict: 'good', packetsLostSum, debug: { dropRatio, minFps } }
    }
  }

  return { verdict: 'unknown', packetsLostSum, debug: { dropRatio, lossDelta } }
}

export const RECEIVE_PRESSURE_POLL_MS = 2_200
export const RECEIVE_PRESSURE_BAD_STREAK_DOWN = 3
export const RECEIVE_PRESSURE_GOOD_STREAK_UP = 4
export const RECEIVE_PRESSURE_UPGRADE_COOLDOWN_MS = 4_500
