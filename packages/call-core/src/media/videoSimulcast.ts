import type { RtpEncodingParameters } from 'mediasoup-client/types'

/**
 * VP8 simulcast encodings — **not used by default** (single-layer video is more stable for now).
 * Re-enable in `useSendTransport.publishLocalMedia` when you want simulcast back.
 */
export const VP8_SIMULCAST_ENCODINGS: RtpEncodingParameters[] = [
  { rid: 'r0', maxBitrate: 280_000, scaleResolutionDownBy: 4 },
  { rid: 'r1', maxBitrate: 800_000, scaleResolutionDownBy: 2 },
  { rid: 'r2', maxBitrate: 3_500_000, scaleResolutionDownBy: 1 },
]

/** Maps UI grid tier → mediasoup simulcast spatialLayer (for future server-side layer pick). */
export function spatialLayerForGridSizeTier(tier: 'sm' | 'md' | 'lg'): number {
  if (tier === 'sm') {
    return 0
  }
  if (tier === 'md') {
    return 1
  }
  return 2
}
