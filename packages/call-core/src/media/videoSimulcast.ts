import type { RtpEncodingParameters } from 'mediasoup-client/types'
import { getSimulcastEncodingsForPreset, getSingleLayerEncodingsForPreset } from './videoQualityPreset'

/**
 * Simulcast is disabled for fixed-quality calls. The constant remains for compatibility only.
 */
export const VIDEO_SIMULCAST_MIN_PEERS_IN_ROOM = Number.POSITIVE_INFINITY

export function shouldUseVideoSimulcastForRoom(peerCount: number): boolean {
  void peerCount
  return false
}

/** Implicit multi-user auto tier (back-compat export for callers that need a static reference). */
export const VP8_SINGLE_LAYER_ENCODING: RtpEncodingParameters[] = getSingleLayerEncodingsForPreset('auto_large_room')

/** Back-compat export; simulcast is disabled and this contains one fixed 480p layer. */
export const VP8_SIMULCAST_ENCODINGS: RtpEncodingParameters[] = getSimulcastEncodingsForPreset('auto_large_room')

/** Back-compat helper; fixed-quality receive path does not request spatial layers. */
export function spatialLayerForGridSizeTier(tier: 'sm' | 'md' | 'lg'): number {
  if (tier === 'sm') {
    return 0
  }
  if (tier === 'md') {
    return 1
  }
  return 2
}
