import type { RtpEncodingParameters } from 'mediasoup-client/types'
import { getSimulcastEncodingsForPreset, getSingleLayerEncodingsForPreset } from './videoQualityPreset'

/**
 * When the room already has at least this many peers (including you), new publishes use VP8
 * **simulcast** and receivers enable `set-consumer-preferred-layers`. Below the threshold,
 * **single-layer** video stays default (smooth 1:1 / small calls).
 */
export const VIDEO_SIMULCAST_MIN_PEERS_IN_ROOM = 6

export function shouldUseVideoSimulcastForRoom(peerCount: number): boolean {
  return peerCount >= VIDEO_SIMULCAST_MIN_PEERS_IN_ROOM
}

/** Balanced preset (back-compat export for callers that need a static reference). */
export const VP8_SINGLE_LAYER_ENCODING: RtpEncodingParameters[] = getSingleLayerEncodingsForPreset('balanced')

/** Balanced preset simulcast ladder. */
export const VP8_SIMULCAST_ENCODINGS: RtpEncodingParameters[] = getSimulcastEncodingsForPreset('balanced')

/** Maps UI grid tier → mediasoup simulcast spatialLayer (unused in-app; real policy is in `useRemoteMedia`). */
export function spatialLayerForGridSizeTier(tier: 'sm' | 'md' | 'lg'): number {
  if (tier === 'sm') {
    return 0
  }
  if (tier === 'md') {
    return 1
  }
  return 2
}
