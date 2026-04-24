import { describe, expect, it } from 'vitest'
import {
  applyReceiveQualityPressureToLayers,
  evaluateInboundVideoStatsForPressure,
} from '../src/media/receiveVideoQualityPressure'

describe('applyReceiveQualityPressureToLayers', () => {
  it('leaves base unchanged in normal', () => {
    const b = new Map([
      ['a', { spatialLayer: 2, temporalLayer: 2 }],
      ['b', { spatialLayer: 0, temporalLayer: 0 }],
    ])
    const u = applyReceiveQualityPressureToLayers(b, 'normal', {
      activeSpeakerPeerId: 'a',
      pinnedPeerId: null,
      peerVisibility: new Map(),
    })
    expect(u.get('a')).toEqual({ spatialLayer: 2, temporalLayer: 2 })
    expect(u.get('b')).toEqual({ spatialLayer: 0, temporalLayer: 0 })
  })

  it('critical: active to medium, others to low', () => {
    const b = new Map([
      ['a', { spatialLayer: 2, temporalLayer: 2 }],
      ['b', { spatialLayer: 1, temporalLayer: 1 }],
    ])
    const u = applyReceiveQualityPressureToLayers(b, 'critical', {
      activeSpeakerPeerId: 'a',
      pinnedPeerId: null,
      peerVisibility: new Map([['b', true]]),
    })
    expect(u.get('a')).toEqual({ spatialLayer: 1, temporalLayer: 1 })
    expect(u.get('b')).toEqual({ spatialLayer: 0, temporalLayer: 0 })
  })

  it('critical: pinned stays at least medium (not low)', () => {
    const b = new Map([
      ['p', { spatialLayer: 2, temporalLayer: 2 }],
      ['v', { spatialLayer: 1, temporalLayer: 1 }],
    ])
    const u = applyReceiveQualityPressureToLayers(b, 'critical', {
      activeSpeakerPeerId: 'other',
      pinnedPeerId: 'p',
      peerVisibility: new Map([
        ['p', true],
        ['v', true],
      ]),
    })
    expect(u.get('p')).toEqual({ spatialLayer: 1, temporalLayer: 1 })
    expect(u.get('v')).toEqual({ spatialLayer: 0, temporalLayer: 0 })
  })
})

describe('evaluateInboundVideoStatsForPressure', () => {
  it('returns unknown when not enough frames decoded (warmup)', () => {
    const r = evaluateInboundVideoStatsForPressure(
      [{ framesDecoded: 5, framesDropped: 0, packetsLost: 0 }],
      null,
    )
    expect(r.verdict).toBe('unknown')
  })

  it('returns bad on high drop ratio', () => {
    const r = evaluateInboundVideoStatsForPressure(
      [{ framesDecoded: 100, framesDropped: 20, framesPerSecond: 25, packetsLost: 0 }],
      null,
    )
    expect(r.verdict).toBe('bad')
  })

  it('returns good on healthy stats', () => {
    const r = evaluateInboundVideoStatsForPressure(
      [{ framesDecoded: 200, framesDropped: 1, framesPerSecond: 24, packetsLost: 0 }],
      null,
    )
    expect(r.verdict).toBe('good')
  })
})
