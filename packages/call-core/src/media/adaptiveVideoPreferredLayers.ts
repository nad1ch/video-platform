/**
 * Fixed receive layer selection. Simulcast is disabled, so every remote peer maps to the same single layer.
 */

import {
  RECEIVE_DEVICE_DEFAULT_MAX_HIGH,
  RECEIVE_DEVICE_DEFAULT_MAX_MEDIUM,
} from './receiveDeviceProfile'

/** @deprecated Use {@link RECEIVE_DEVICE_DEFAULT_MAX_HIGH} or profile limits. */
export const MAX_HIGH_STREAMS = RECEIVE_DEVICE_DEFAULT_MAX_HIGH
/** @deprecated Use {@link RECEIVE_DEVICE_DEFAULT_MAX_MEDIUM} or profile limits. */
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
  /** Local Web Audio dominant talker; listed first so layers track perceived speaker before SFU catches up. */
  uiActiveSpeakerPeerId?: string | null
  /** Ignored while fixed-quality single-layer video is enforced. */
  recentSpeakerPeerIds?: readonly string[]
  pinnedPeerId: string | null
  /** `false` = explicitly off-viewport; missing key = treat as visible (on-screen) for Mafia/IO. */
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
