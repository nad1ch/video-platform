import { describe, expect, it } from 'vitest'
import {
  advancePlaybackRenderFpsPressureByPeer,
  aggregateInboundVideoStatsByPeerId,
  applyFpsRenderPressure,
  evaluateInboundFpsRenderPressure,
  FPS_RENDER_PRESSURE_BAD_STREAK_DOWN,
  FPS_RENDER_PRESSURE_GOOD_STREAK_UP,
} from '../src/media/videoFpsPressure'

describe('evaluateInboundFpsRenderPressure', () => {
  it('returns unknown when stats missing or warmup', () => {
    expect(evaluateInboundFpsRenderPressure(undefined)).toBe('unknown')
    expect(evaluateInboundFpsRenderPressure({ framesDecoded: 10, framesDropped: 0 })).toBe('unknown')
  })

  it('classifies by drop ratio', () => {
    expect(
      evaluateInboundFpsRenderPressure({ framesDecoded: 100, framesDropped: 5 }),
    ).toBe('good')
    expect(
      evaluateInboundFpsRenderPressure({ framesDecoded: 100, framesDropped: 15 }),
    ).toBe('degraded')
    expect(
      evaluateInboundFpsRenderPressure({ framesDecoded: 60, framesDropped: 30 }),
    ).toBe('bad')
  })
})

describe('applyFpsRenderPressure', () => {
  it('scales base fps and floors at 12', () => {
    expect(applyFpsRenderPressure(15, 'good')).toBe(15)
    expect(applyFpsRenderPressure(15, 'degraded')).toBe(12)
    expect(applyFpsRenderPressure(15, 'bad')).toBe(12)
    expect(applyFpsRenderPressure(8, 'bad')).toBe(12)
  })
})

describe('aggregateInboundVideoStatsByPeerId', () => {
  it('sums counters per peer and tracks min fps', () => {
    const m = aggregateInboundVideoStatsByPeerId([
      { peerId: 'a', framesDecoded: 40, framesDropped: 10, framesPerSecond: 20 },
      { peerId: 'a', framesDecoded: 10, framesDropped: 0, framesPerSecond: 22 },
    ])
    expect(m.get('a')).toEqual({
      framesDecoded: 50,
      framesDropped: 10,
      framesPerSecond: 20,
    })
  })
})

describe('advancePlaybackRenderFpsPressureByPeer', () => {
  it('steps stable tier with hysteresis', () => {
    const hysteresis = new Map()
    const peerIds = ['p1'] as const
    const badRow = { peerId: 'p1', framesDecoded: 100, framesDropped: 40 }

    let map = advancePlaybackRenderFpsPressureByPeer({
      videoPeerIds: peerIds,
      inboundRows: [badRow],
      hysteresisByPeer: hysteresis,
    })
    expect(map.get('p1')).toBe('good')

    for (let i = 1; i < FPS_RENDER_PRESSURE_BAD_STREAK_DOWN; i++) {
      map = advancePlaybackRenderFpsPressureByPeer({
        videoPeerIds: peerIds,
        inboundRows: [badRow],
        hysteresisByPeer: hysteresis,
      })
    }
    expect(map.get('p1')).toBe('degraded')

    for (let i = 0; i < FPS_RENDER_PRESSURE_BAD_STREAK_DOWN; i++) {
      map = advancePlaybackRenderFpsPressureByPeer({
        videoPeerIds: peerIds,
        inboundRows: [badRow],
        hysteresisByPeer: hysteresis,
      })
    }
    expect(map.get('p1')).toBe('bad')

    const goodRow = { peerId: 'p1', framesDecoded: 200, framesDropped: 2 }
    for (let i = 0; i < FPS_RENDER_PRESSURE_GOOD_STREAK_UP; i++) {
      map = advancePlaybackRenderFpsPressureByPeer({
        videoPeerIds: peerIds,
        inboundRows: [goodRow],
        hysteresisByPeer: hysteresis,
      })
    }
    expect(map.get('p1')).toBe('degraded')

    for (let i = 0; i < FPS_RENDER_PRESSURE_GOOD_STREAK_UP; i++) {
      map = advancePlaybackRenderFpsPressureByPeer({
        videoPeerIds: peerIds,
        inboundRows: [goodRow],
        hysteresisByPeer: hysteresis,
      })
    }
    expect(map.get('p1')).toBe('good')
  })
})
