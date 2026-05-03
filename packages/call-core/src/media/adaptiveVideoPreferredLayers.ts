/**
 * Fixed receive layer selection. Simulcast is disabled, so every remote peer maps to the same single layer.
 */

import {
  RECEIVE_DEVICE_DEFAULT_MAX_HIGH,
  RECEIVE_DEVICE_DEFAULT_MAX_MEDIUM,
} from './receiveDeviceProfile'


export const MAX_HIGH_STREAMS = RECEIVE_DEVICE_DEFAULT_MAX_HIGH

export const MAX_MEDIUM_STREAMS = RECEIVE_DEVICE_DEFAULT_MAX_MEDIUM

export type AdaptiveVideoLayerSlotLimits = {
  maxHighStreams: number
  maxMediumStreams: number
}

export type SimulcastPreferredLayers = { spatialLayer: 0 | 1 | 2; temporalLayer: 0 | 1 | 2 }

export function assignAdaptivePreferredLayersByPeerId(input: {
  /** Every remote `peerId` that currently has at least one video producer. */
  videoPeerIds: string[]
  /** SFU / signaling dominant speaker (may lag local VAD). */
  activeSpeakerPeerId: string | null
  
  uiActiveSpeakerPeerId?: string | null
  /** Ignored while fixed-quality single-layer video is enforced. */
  recentSpeakerPeerIds?: readonly string[]
  pinnedPeerId: string | null
  
  peerVisibility: ReadonlyMap<string, boolean>
  /** Ignored while fixed-quality single-layer video is enforced. */
  layerSlots?: Partial<AdaptiveVideoLayerSlotLimits>
}): Map<string, SimulcastPreferredLayers> {
  const out = new Map<string, SimulcastPreferredLayers>()
  for (const id of [...new Set(input.videoPeerIds)].sort((a, b) => a.localeCompare(b))) {
    out.set(id, { spatialLayer: 0, temporalLayer: 0 })
  }

  return out
}
