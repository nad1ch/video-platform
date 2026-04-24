/**
 * Deterministic simulcast layer selection per remote video peer (adaptive video quality policy).
 * One spatial + one temporal target per peer; does not depend on call-core state beyond inputs.
 *
 * - Order: UI (Web Audio) speaker -> SFU active speaker -> recent speaker -> pinned -> on-screen (visible) -> off-screen,
 *   each bucket sorted by `peerId`.
 * - Slots: first N "high" peers -> spatial 2, temporal 2; next M "medium" -> 1+1; rest -> 0+0.
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

function sanitizeSlotLimits(limits?: Partial<AdaptiveVideoLayerSlotLimits>): {
  maxHighStreams: number
  maxMediumStreams: number
} {
  const rawHigh = limits?.maxHighStreams ?? RECEIVE_DEVICE_DEFAULT_MAX_HIGH
  const rawMed = limits?.maxMediumStreams ?? RECEIVE_DEVICE_DEFAULT_MAX_MEDIUM
  const maxHighStreams =
    Number.isFinite(rawHigh) && rawHigh >= 0 ? Math.min(32, Math.floor(rawHigh)) : RECEIVE_DEVICE_DEFAULT_MAX_HIGH
  const maxMediumStreams =
    Number.isFinite(rawMed) && rawMed >= 0 ? Math.min(32, Math.floor(rawMed)) : RECEIVE_DEVICE_DEFAULT_MAX_MEDIUM
  return { maxHighStreams, maxMediumStreams }
}

export function assignAdaptivePreferredLayersByPeerId(input: {
  /** Every remote `peerId` that currently has at least one video producer. */
  videoPeerIds: string[]
  /** SFU / signaling dominant speaker (may lag local VAD). */
  activeSpeakerPeerId: string | null
  /** Local Web Audio dominant talker; listed first so layers track perceived speaker before SFU catches up. */
  uiActiveSpeakerPeerId?: string | null
  /** Recently active speakers keep priority briefly to avoid abrupt high -> low jumps. */
  recentSpeakerPeerIds?: readonly string[]
  pinnedPeerId: string | null
  /** `false` = explicitly off-viewport; missing key = treat as visible (on-screen) for Mafia/IO. */
  peerVisibility: ReadonlyMap<string, boolean>
  /** Inbound simulcast rung budgets (defaults come from the receive device profile). */
  layerSlots?: Partial<AdaptiveVideoLayerSlotLimits>
}): Map<string, SimulcastPreferredLayers> {
  const { videoPeerIds, activeSpeakerPeerId, pinnedPeerId, peerVisibility } = input
  const uiSpk = input.uiActiveSpeakerPeerId ?? null
  const recentSpeakers = input.recentSpeakerPeerIds ?? []
  const { maxHighStreams, maxMediumStreams } = sanitizeSlotLimits(input.layerSlots)
  const set = new Set(videoPeerIds)
  const ordered: string[] = []
  const pushIf = (id: string | null) => {
    if (id && set.has(id) && !ordered.includes(id)) {
      ordered.push(id)
    }
  }

  pushIf(uiSpk)
  pushIf(activeSpeakerPeerId)
  for (const id of recentSpeakers) {
    pushIf(id)
  }
  pushIf(pinnedPeerId)

  const visible = [...set]
    .filter((id) => !ordered.includes(id) && peerVisibility.get(id) !== false)
    .sort((a, b) => a.localeCompare(b))
  ordered.push(...visible)

  const off = [...set]
    .filter((id) => !ordered.includes(id))
    .sort((a, b) => a.localeCompare(b))
  ordered.push(...off)

  const out = new Map<string, SimulcastPreferredLayers>()
  const highCap = maxHighStreams
  const medCap = maxMediumStreams

  for (let i = 0; i < ordered.length; i += 1) {
    const id = ordered[i]!
    let spatialLayer: 0 | 1 | 2
    let temporalLayer: 0 | 1 | 2
    if (i < highCap) {
      spatialLayer = 2
      temporalLayer = 2
    } else if (i < highCap + medCap) {
      spatialLayer = 1
      temporalLayer = 1
    } else {
      spatialLayer = 0
      temporalLayer = 0
    }
    out.set(id, { spatialLayer, temporalLayer })
  }

  return out
}
