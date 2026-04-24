import { describe, expect, it } from 'vitest'
import {
  assignAdaptivePreferredLayersByPeerId,
  MAX_HIGH_STREAMS,
  MAX_MEDIUM_STREAMS,
} from '../src/media/adaptiveVideoPreferredLayers'

describe('assignAdaptivePreferredLayersByPeerId', () => {
  it('gives 1–2 remotes all high slot (simulcast spatial 2, temporal 2)', () => {
    const a = 'p-a'
    const b = 'p-b'
    const m = assignAdaptivePreferredLayersByPeerId({
      videoPeerIds: [a, b],
      activeSpeakerPeerId: null,
      pinnedPeerId: null,
      peerVisibility: new Map(),
    })
    expect(m.get(a)).toEqual({ spatialLayer: 2, temporalLayer: 2 })
    expect(m.get(b)).toEqual({ spatialLayer: 2, temporalLayer: 2 })
  })

  it('orders active speaker first, then other visible, then slot ladder', () => {
    const low = 'z-last'
    const midA = 'm-a'
    const midB = 'm-b'
    const act = 'active-1'
    const ids = [low, midA, act, midB]
    const vis = new Map<string, boolean>([
      [act, true],
      [midA, true],
      [midB, true],
      [low, true],
    ])
    const m = assignAdaptivePreferredLayersByPeerId({
      videoPeerIds: ids,
      activeSpeakerPeerId: act,
      pinnedPeerId: null,
      peerVisibility: vis,
    })
    // Order: act, then m-a, m-b, low (all visible, sorted)
    expect(m.get(act)).toEqual({ spatialLayer: 2, temporalLayer: 2 })
    expect(m.get(midA)).toEqual({ spatialLayer: 2, temporalLayer: 2 })
    expect(m.get(midB)).toEqual({ spatialLayer: 1, temporalLayer: 1 })
    expect(m.get(low)).toEqual({ spatialLayer: 1, temporalLayer: 1 })
  })

  it('reserves first MAX_HIGH then MAX_MEDIUM', () => {
    const peers: string[] = []
    for (let i = 0; i < MAX_HIGH_STREAMS + MAX_MEDIUM_STREAMS + 2; i += 1) {
      peers.push(`peer-${i.toString().padStart(2, '0')}`)
    }
    const m = assignAdaptivePreferredLayersByPeerId({
      videoPeerIds: peers,
      activeSpeakerPeerId: null,
      pinnedPeerId: null,
      peerVisibility: new Map(),
    })
    for (let i = 0; i < MAX_HIGH_STREAMS; i += 1) {
      expect(m.get(peers[i])).toEqual({ spatialLayer: 2, temporalLayer: 2 })
    }
    for (let i = MAX_HIGH_STREAMS; i < MAX_HIGH_STREAMS + MAX_MEDIUM_STREAMS; i += 1) {
      expect(m.get(peers[i])).toEqual({ spatialLayer: 1, temporalLayer: 1 })
    }
    for (let i = MAX_HIGH_STREAMS + MAX_MEDIUM_STREAMS; i < peers.length; i += 1) {
      expect(m.get(peers[i])).toEqual({ spatialLayer: 0, temporalLayer: 0 })
    }
  })

  it('places pinned after active, visible before off-screen', () => {
    const active = 'a-s'
    const pinned = 'p-in'
    const vis1 = 'v1'
    const off = 'off'
    const m = assignAdaptivePreferredLayersByPeerId({
      videoPeerIds: [vis1, off, active, pinned],
      activeSpeakerPeerId: active,
      pinnedPeerId: pinned,
      peerVisibility: new Map([
        [vis1, true],
        [off, false],
        [active, true],
        [pinned, true],
      ]),
    })
    // Order: active, pinned, v1, off
    expect(m.get(active)).toEqual({ spatialLayer: 2, temporalLayer: 2 })
    expect(m.get(pinned)).toEqual({ spatialLayer: 2, temporalLayer: 2 })
    expect(m.get(vis1)).toEqual({ spatialLayer: 1, temporalLayer: 1 })
    expect(m.get(off)).toEqual({ spatialLayer: 1, temporalLayer: 1 })
  })
})
