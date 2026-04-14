/**
 * Parse RTCPeerConnection stats (mediasoup Transport.getStats()) for BWE-style heuristics.
 * Field availability varies by browser; missing values are handled conservatively.
 *
 * Optional tuning (Vite app that bundles this package):
 * - VITE_BWE_POOR_BPS — below = poor (default 1_000_000)
 * - VITE_BWE_MEDIUM_BPS — below = at most medium if bitrate-based (default 2_000_000)
 * - VITE_BWE_MEDIUM_SOFT_BPS — with moderate loss, cap medium under this (default 2_500_000)
 * - VITE_BWE_RTT_MEDIUM_MS — RTT above → medium (default 450)
 * - VITE_BWE_POLL_MS — getStats interval ms (default 1500, clamp 500–10000)
 */

function readViteEnv(key: string): string | undefined {
  try {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
    const v = env?.[key]
    return typeof v === 'string' && v.length > 0 ? v : undefined
  } catch {
    return undefined
  }
}

function envPositiveNumber(key: string, fallback: number): number {
  const raw = readViteEnv(key)
  if (!raw) {
    return fallback
  }
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Resolved once at module load (Vite inlines at build time). */
export const BWE_THRESHOLDS = {
  poorBps: envPositiveNumber('VITE_BWE_POOR_BPS', 1_000_000),
  mediumBps: envPositiveNumber('VITE_BWE_MEDIUM_BPS', 2_000_000),
  mediumSoftBps: envPositiveNumber('VITE_BWE_MEDIUM_SOFT_BPS', 2_500_000),
  rttMediumMs: envPositiveNumber('VITE_BWE_RTT_MEDIUM_MS', 450),
} as const

export type ParsedTransportStats = {
  availableIncomingBitrate?: number
  availableOutgoingBitrate?: number
  currentRoundTripTimeMs?: number
  videoPacketsLost: number
  videoPacketsReceived: number
}

export type BweMetrics = {
  /** Conservative estimate: min(in, out) when both exist. */
  estimatedBitrate?: number
  rttMs?: number
  videoPacketsLost: number
  videoPacketsReceived: number
}

export function parseTransportStats(report: RTCStatsReport): ParsedTransportStats {
  let availableIncomingBitrate: number | undefined
  let availableOutgoingBitrate: number | undefined
  let currentRoundTripTimeMs: number | undefined
  let videoPacketsLost = 0
  let videoPacketsReceived = 0

  report.forEach((s) => {
    if (s.type === 'candidate-pair') {
      const cp = s as {
        selected?: boolean
        availableIncomingBitrate?: number
        availableOutgoingBitrate?: number
        currentRoundTripTime?: number
      }
      if (cp.selected) {
        if (typeof cp.availableIncomingBitrate === 'number') {
          availableIncomingBitrate = cp.availableIncomingBitrate
        }
        if (typeof cp.availableOutgoingBitrate === 'number') {
          availableOutgoingBitrate = cp.availableOutgoingBitrate
        }
        if (typeof cp.currentRoundTripTime === 'number') {
          currentRoundTripTimeMs = cp.currentRoundTripTime * 1000
        }
      }
    }
    if (s.type === 'inbound-rtp') {
      const ir = s as { kind?: string; packetsLost?: number; packetsReceived?: number }
      if (ir.kind === 'video') {
        videoPacketsLost += ir.packetsLost ?? 0
        videoPacketsReceived += ir.packetsReceived ?? 0
      }
    }
  })

  return {
    availableIncomingBitrate,
    availableOutgoingBitrate,
    currentRoundTripTimeMs,
    videoPacketsLost,
    videoPacketsReceived,
  }
}

export function mergeRecvSendBwe(recv: ParsedTransportStats, send?: ParsedTransportStats): BweMetrics {
  let estimatedBitrate: number | undefined
  const inc = recv.availableIncomingBitrate
  const out = send?.availableOutgoingBitrate
  if (inc !== undefined && out !== undefined) {
    estimatedBitrate = Math.min(inc, out)
  } else {
    estimatedBitrate = inc ?? out
  }

  return {
    estimatedBitrate,
    rttMs: recv.currentRoundTripTimeMs ?? send?.currentRoundTripTimeMs,
    videoPacketsLost: recv.videoPacketsLost,
    videoPacketsReceived: recv.videoPacketsReceived,
  }
}

export type NetworkQualityClass = 'good' | 'medium' | 'poor'

/** Classify link quality; thresholds from `BWE_THRESHOLDS` (Vite env). */
export function classifyBweMetrics(
  m: BweMetrics,
  thresholds: typeof BWE_THRESHOLDS = BWE_THRESHOLDS,
): NetworkQualityClass {
  const total = m.videoPacketsReceived + m.videoPacketsLost
  const lossRatio = total > 80 ? m.videoPacketsLost / total : 0
  const highLoss = lossRatio > 0.06 || (m.videoPacketsReceived > 100 && m.videoPacketsLost > 45)
  const mediumLoss = lossRatio > 0.025

  if (m.estimatedBitrate !== undefined) {
    if (m.estimatedBitrate < thresholds.poorBps) {
      return 'poor'
    }
    if (m.estimatedBitrate < thresholds.mediumBps || highLoss) {
      return 'medium'
    }
    if (mediumLoss && m.estimatedBitrate < thresholds.mediumSoftBps) {
      return 'medium'
    }
  } else {
    if (highLoss) {
      return 'poor'
    }
    if (mediumLoss) {
      return 'medium'
    }
  }

  if (m.rttMs !== undefined && m.rttMs > thresholds.rttMediumMs) {
    return 'medium'
  }

  return 'good'
}
