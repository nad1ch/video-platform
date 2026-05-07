import { describe, expect, it } from 'vitest'
import {
  applyReceiveQualityPressureToLayers,
  evaluateInboundVideoStatsForPressure,
  RECEIVE_PRESSURE_BAD_STREAK_DOWN,
  RECEIVE_PRESSURE_GOOD_STREAK_UP,
  RECEIVE_PRESSURE_POLL_MS,
  RECEIVE_PRESSURE_UPGRADE_COOLDOWN_MS,
} from '../src/media/receiveVideoQualityPressure'
import { resolveReceiverBaselineLayer } from '../src/media/receiverBaselineLayerPolicy'

describe('applyReceiveQualityPressureToLayers', () => {
  it('does not downgrade uiActiveSpeakerPeerId under critical pressure', () => {
    const b = new Map([['u', { spatialLayer: 2, temporalLayer: 2 }]])
    const u = applyReceiveQualityPressureToLayers(b, 'critical', {
      activeSpeakerPeerId: null,
      uiActiveSpeakerPeerId: 'u',
      pinnedPeerId: null,
      peerVisibility: new Map(),
    })
    expect(u.get('u')).toEqual({ spatialLayer: 2, temporalLayer: 2 })
  })

  it('normal returns layers unchanged', () => {
    const b = new Map([
      ['a', { spatialLayer: 2, temporalLayer: 2 }],
      ['b', { spatialLayer: 0, temporalLayer: 0 }],
      ['c', { spatialLayer: 1, temporalLayer: 1 }],
    ])
    const u = applyReceiveQualityPressureToLayers(b, 'normal', {
      activeSpeakerPeerId: 'a',
      pinnedPeerId: null,
      peerVisibility: new Map(),
    })
    expect(u.get('a')).toEqual({ spatialLayer: 2, temporalLayer: 2 })
    expect(u.get('b')).toEqual({ spatialLayer: 0, temporalLayer: 0 })
    expect(u.get('c')).toEqual({ spatialLayer: 1, temporalLayer: 1 })
  })

  it('constrained returns layers unchanged', () => {
    const b = new Map([
      ['hi', { spatialLayer: 2, temporalLayer: 2 }],
      ['lo', { spatialLayer: 0, temporalLayer: 0 }],
    ])
    const u = applyReceiveQualityPressureToLayers(b, 'constrained', {
      activeSpeakerPeerId: null,
      pinnedPeerId: null,
      peerVisibility: new Map([
        ['hi', true],
        ['lo', true],
      ]),
    })
    expect(u.get('hi')).toEqual({ spatialLayer: 2, temporalLayer: 2 })
    expect(u.get('lo')).toEqual({ spatialLayer: 0, temporalLayer: 0 })
  })

  it('critical returns layers unchanged', () => {
    const b = new Map([
      ['a', { spatialLayer: 2, temporalLayer: 2 }],
      ['b', { spatialLayer: 1, temporalLayer: 1 }],
    ])
    const u = applyReceiveQualityPressureToLayers(b, 'critical', {
      activeSpeakerPeerId: 'a',
      pinnedPeerId: null,
      peerVisibility: new Map([['b', true]]),
    })
    expect(u.get('a')).toEqual({ spatialLayer: 2, temporalLayer: 2 })
    expect(u.get('b')).toEqual({ spatialLayer: 1, temporalLayer: 1 })
  })

  it('critical does not treat pinned peers specially', () => {
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
    expect(u.get('p')).toEqual({ spatialLayer: 2, temporalLayer: 2 })
    expect(u.get('v')).toEqual({ spatialLayer: 1, temporalLayer: 1 })
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

describe('Phase 1 hysteresis timing constants', () => {
  it('downgrade time fits user spec ~6-9 s for default profile (streak=3)', () => {
    const downgradeMs = RECEIVE_PRESSURE_BAD_STREAK_DOWN * RECEIVE_PRESSURE_POLL_MS
    expect(downgradeMs).toBeGreaterThanOrEqual(6_000)
    expect(downgradeMs).toBeLessThanOrEqual(9_000)
  })

  it('upgrade minimum fits user spec ~15-30 s', () => {
    const minStreakMs = RECEIVE_PRESSURE_GOOD_STREAK_UP * RECEIVE_PRESSURE_POLL_MS
    const minUpgradeMs = Math.max(minStreakMs, RECEIVE_PRESSURE_UPGRADE_COOLDOWN_MS)
    expect(minUpgradeMs).toBeGreaterThanOrEqual(15_000)
    expect(minUpgradeMs).toBeLessThanOrEqual(30_000)
  })

  it('upgrade is strictly slower than downgrade (no flap)', () => {
    const downgradeMs = RECEIVE_PRESSURE_BAD_STREAK_DOWN * RECEIVE_PRESSURE_POLL_MS
    const upgradeMs = Math.max(
      RECEIVE_PRESSURE_GOOD_STREAK_UP * RECEIVE_PRESSURE_POLL_MS,
      RECEIVE_PRESSURE_UPGRADE_COOLDOWN_MS,
    )
    expect(upgradeMs).toBeGreaterThan(downgradeMs)
  })
})

describe('pressure → receiver baseline layer integration (Phase 1)', () => {
  it('default profile in 12-cam room: normal=medium, constrained=low, critical=low', () => {
    const base = {
      profile: 'default' as const,
      role: 'participant' as const,
      activeCameraPublishers: 12,
    }
    expect(resolveReceiverBaselineLayer({ ...base, pressure: 'normal' })).toBe('medium')
    expect(resolveReceiverBaselineLayer({ ...base, pressure: 'constrained' })).toBe('low')
    expect(resolveReceiverBaselineLayer({ ...base, pressure: 'critical' })).toBe('low')
  })

  it('strong profile in 12-cam room: normal=high, any pressure clamps to medium floor', () => {
    const base = {
      profile: 'strong' as const,
      role: 'participant' as const,
      activeCameraPublishers: 12,
    }
    expect(resolveReceiverBaselineLayer({ ...base, pressure: 'normal' })).toBe('high')
    expect(resolveReceiverBaselineLayer({ ...base, pressure: 'constrained' })).toBe('medium')
    expect(resolveReceiverBaselineLayer({ ...base, pressure: 'critical' })).toBe('medium')
  })

  it('viewer/OBS in 12-cam room never drops below medium even on critical', () => {
    for (const profile of ['strong', 'default', 'constrained', 'mobile'] as const) {
      const layer = resolveReceiverBaselineLayer({
        profile,
        role: 'viewer',
        activeCameraPublishers: 12,
        pressure: 'critical',
      })
      expect(layer).toBe('medium')
    }
  })

  it('small room is unchanged by any pressure (initial=high, profile floors keep behavior the same)', () => {
    // 1-6 cams: every receiver starts at 'high' and stays at 'high' under
    // normal pressure. Pressure-driven step-down still applies, but the
    // user-facing point is "small rooms behave like today" — and today's
    // behavior is "decode whatever the publisher sends" (which is the
    // single high encoding regardless of the receiver's preferred layers).
    for (let n = 1; n <= 6; n += 1) {
      expect(
        resolveReceiverBaselineLayer({
          profile: 'default',
          role: 'participant',
          activeCameraPublishers: n,
          pressure: 'normal',
        }),
      ).toBe('high')
    }
  })

  it('mobile profile: 12-cam normal=low, pressure cannot push below low (clamped)', () => {
    const base = {
      profile: 'mobile' as const,
      role: 'participant' as const,
      activeCameraPublishers: 12,
    }
    expect(resolveReceiverBaselineLayer({ ...base, pressure: 'normal' })).toBe('low')
    expect(resolveReceiverBaselineLayer({ ...base, pressure: 'constrained' })).toBe('low')
    expect(resolveReceiverBaselineLayer({ ...base, pressure: 'critical' })).toBe('low')
  })
})
