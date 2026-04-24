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

  it('respects custom layerSlots (mobile-style 1 high, 3 medium)', () => {
    const act = 'active-1'
    const b = 'p-b'
    const c = 'p-c'
    const d = 'p-d'
    const e = 'p-e'
    const m = assignAdaptivePreferredLayersByPeerId({
      videoPeerIds: [e, d, c, b, act],
      activeSpeakerPeerId: act,
      pinnedPeerId: null,
      peerVisibility: new Map([
        [act, true],
        [b, true],
        [c, true],
        [d, true],
        [e, true],
      ]),
      layerSlots: { maxHighStreams: 1, maxMediumStreams: 3 },
    })
    expect(m.get(act)).toEqual({ spatialLayer: 2, temporalLayer: 2 })
    expect(m.get(b)).toEqual({ spatialLayer: 1, temporalLayer: 1 })
    expect(m.get(c)).toEqual({ spatialLayer: 1, temporalLayer: 1 })
    expect(m.get(d)).toEqual({ spatialLayer: 1, temporalLayer: 1 })
    expect(m.get(e)).toEqual({ spatialLayer: 0, temporalLayer: 0 })
  })

  it('orders ui VAD speaker before SFU id when both differ (single high slot)', () => {
    const ui = 'vad-ahead'
    const sfu = 'sfu-late'
    const other = 'z-other'
    const m = assignAdaptivePreferredLayersByPeerId({
      videoPeerIds: [other, sfu, ui],
      activeSpeakerPeerId: sfu,
      uiActiveSpeakerPeerId: ui,
      pinnedPeerId: null,
      peerVisibility: new Map([
        [ui, true],
        [sfu, true],
        [other, true],
      ]),
      layerSlots: { maxHighStreams: 1, maxMediumStreams: 1 },
    })
    expect(m.get(ui)).toEqual({ spatialLayer: 2, temporalLayer: 2 })
    expect(m.get(sfu)).toEqual({ spatialLayer: 1, temporalLayer: 1 })
    expect(m.get(other)).toEqual({ spatialLayer: 0, temporalLayer: 0 })
  })

  it('keeps recent speaker ahead of regular visible peers', () => {
    const recent = 'recent-speaker'
    const visible = 'visible-peer'
    const m = assignAdaptivePreferredLayersByPeerId({
      videoPeerIds: [visible, recent],
      activeSpeakerPeerId: null,
      uiActiveSpeakerPeerId: null,
      recentSpeakerPeerIds: [recent],
      pinnedPeerId: null,
      peerVisibility: new Map([
        [visible, true],
        [recent, true],
      ]),
      layerSlots: { maxHighStreams: 1, maxMediumStreams: 1 },
    })
    expect(m.get(recent)).toEqual({ spatialLayer: 2, temporalLayer: 2 })
    expect(m.get(visible)).toEqual({ spatialLayer: 1, temporalLayer: 1 })
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
