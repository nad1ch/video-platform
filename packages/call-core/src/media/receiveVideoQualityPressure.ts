/**
 * Local-only receive-side video stats. Fixed-quality calls do not downgrade preferred layers.
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
 * Fixed-quality calls do not apply receive pressure to layers.
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
  void pressure
  void input
  return new Map(base)
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

/**
 * Phase 1 hysteresis timing.
 *
 *   - Poll every `RECEIVE_PRESSURE_POLL_MS` (2.2 s).
 *
 *   - Downgrade fires after `pressureBadStreakToShift` consecutive bad polls.
 *     The streak count is per-receiver-device-profile in
 *     {@link ReceiveDeviceProfile.pressureBadStreakToShift}:
 *       strong      → 4 polls ≈ 8.8 s
 *       default     → 3 polls ≈ 6.6 s
 *       constrained → 2 polls ≈ 4.4 s   (faster relief on weak desktop)
 *       mobile      → 2 polls ≈ 4.4 s   (faster relief on phone)
 *     This sits inside the user-spec range of "around 6–9 s sustained bad"
 *     for desktop classes; weak/mobile classes intentionally drop faster
 *     because the cost of holding a too-high baseline is higher there.
 *
 *   - Upgrade fires after `RECEIVE_PRESSURE_GOOD_STREAK_UP` consecutive good
 *     polls AND `RECEIVE_PRESSURE_UPGRADE_COOLDOWN_MS` since the last
 *     downgrade. With the values below, minimum upgrade time is
 *     `7 × 2.2 s ≈ 15.4 s` (the streak is the binding constraint when it
 *     is larger than the cooldown). This lands inside the user-spec range
 *     of "around 15–30 s stable/good" and is intentionally slower than
 *     downgrade so the receiver does not flap on a 5–10 s pressure dip
 *     followed by recovery.
 */
export const RECEIVE_PRESSURE_POLL_MS = 2_200
export const RECEIVE_PRESSURE_BAD_STREAK_DOWN = 3
export const RECEIVE_PRESSURE_GOOD_STREAK_UP = 7
export const RECEIVE_PRESSURE_UPGRADE_COOLDOWN_MS = 4_500
