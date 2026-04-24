/**
 * Deterministic simulcast layer selection per remote video peer (adaptive video quality policy).
 * One spatial + one temporal target per peer; does not depend on call-core state beyond inputs.
 *
 * - Order: active speaker → pinned → on-screen (visible) → off-screen, each bucket sorted by `peerId`.
 * - Slots: first {@link MAX_HIGH_STREAMS} peers → spatial 2, temporal 2; next {@link MAX_MEDIUM_STREAMS} → 1+1; rest → 0+0.
 */

export const MAX_HIGH_STREAMS = 2
export const MAX_MEDIUM_STREAMS = 5

export type SimulcastPreferredLayers = { spatialLayer: 0 | 1 | 2; temporalLayer: 0 | 1 | 2 }

export function assignAdaptivePreferredLayersByPeerId(input: {
  /** Every remote `peerId` that currently has at least one video producer. */
  videoPeerIds: string[]
  activeSpeakerPeerId: string | null
  pinnedPeerId: string | null
  /** `false` = explicitly off-viewport; missing key = treat as visible (on-screen) for Mafia/IO. */
  peerVisibility: ReadonlyMap<string, boolean>
}): Map<string, SimulcastPreferredLayers> {
  const { videoPeerIds, activeSpeakerPeerId, pinnedPeerId, peerVisibility } = input
  const set = new Set(videoPeerIds)
  const ordered: string[] = []
  const pushIf = (id: string | null) => {
    if (id && set.has(id) && !ordered.includes(id)) {
      ordered.push(id)
    }
  }

  pushIf(activeSpeakerPeerId)
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

  for (let i = 0; i < ordered.length; i += 1) {
    const id = ordered[i]!
    let spatialLayer: 0 | 1 | 2
    let temporalLayer: 0 | 1 | 2
    if (i < MAX_HIGH_STREAMS) {
      spatialLayer = 2
      temporalLayer = 2
    } else if (i < MAX_HIGH_STREAMS + MAX_MEDIUM_STREAMS) {
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
