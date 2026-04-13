import type { RtpEncodingParameters } from 'mediasoup-client/types'

/**
 * VP8 simulcast (3 spatial layers). RIDs must be unique; order = low → high resolution.
 * Bitrates are hints for bandwidth estimation (transport-cc).
 */
export const VP8_SIMULCAST_ENCODINGS: RtpEncodingParameters[] = [
  { rid: 'r0', maxBitrate: 120_000, scaleResolutionDownBy: 4 },
  { rid: 'r1', maxBitrate: 400_000, scaleResolutionDownBy: 2 },
  { rid: 'r2', maxBitrate: 2_000_000, scaleResolutionDownBy: 1 },
]

/** Same breakpoints as `sizeTier` in the call grid (participants = tiles). */
export function gridSizeTierFromParticipantCount(participantCount: number): 'sm' | 'md' | 'lg' {
  if (participantCount <= 4) {
    return 'lg'
  }
  if (participantCount <= 9) {
    return 'md'
  }
  return 'sm'
}

/** Maps UI grid tier → mediasoup simulcast spatialLayer index (0 = lowest). */
export function spatialLayerForGridSizeTier(tier: 'sm' | 'md' | 'lg'): number {
  if (tier === 'sm') {
    return 0
  }
  if (tier === 'md') {
    return 1
  }
  return 2
}
