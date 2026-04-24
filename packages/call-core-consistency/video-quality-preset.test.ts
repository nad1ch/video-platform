import { describe, expect, it } from 'vitest'
import {
  ACTIVE_CAMERA_SMALL_ROOM_MAX,
  countActiveCameraPublishersAtWire,
  getSimulcastEncodingsForPreset,
  isVideoQualityPreset,
  resolveOutgoingVideoPublishTier,
} from '../call-core/src/media/videoQualityPreset'

describe('getSimulcastEncodingsForPreset (auto_large_room)', () => {
  it('uses Mafia large-room ladder: ×4/×2/×1, 150k / 600k / 1.2M, 12/20/24 fps', () => {
    const e = getSimulcastEncodingsForPreset('auto_large_room')
    expect(e).toHaveLength(3)
    expect(e[0]).toMatchObject({
      scaleResolutionDownBy: 4,
      maxBitrate: 150_000,
      maxFramerate: 12,
      rid: 'r0',
    })
    expect(e[1]).toMatchObject({
      scaleResolutionDownBy: 2,
      maxBitrate: 600_000,
      maxFramerate: 20,
      rid: 'r1',
    })
    expect(e[2]).toMatchObject({
      scaleResolutionDownBy: 1,
      maxBitrate: 1_200_000,
      maxFramerate: 24,
      rid: 'r2',
    })
  })
})

describe('isVideoQualityPreset', () => {
  it('accepts known presets only', () => {
    expect(isVideoQualityPreset('economy')).toBe(true)
    expect(isVideoQualityPreset('balanced')).toBe(true)
    expect(isVideoQualityPreset('hd')).toBe(true)
    expect(isVideoQualityPreset('auto_small_room')).toBe(false)
    expect(isVideoQualityPreset('')).toBe(false)
  })
})

describe('countActiveCameraPublishersAtWire', () => {
  it('counts distinct peers with video producers', () => {
    const list = [
      { peerId: 'a', kind: 'video' },
      { peerId: 'a', kind: 'audio' },
      { peerId: 'b', kind: 'video' },
    ]
    expect(countActiveCameraPublishersAtWire(list, 'c', false)).toBe(2)
  })

  it('includes self when selfWillPublishVideo', () => {
    const list = [{ peerId: 'a', kind: 'video' }]
    expect(countActiveCameraPublishersAtWire(list, 'b', true)).toBe(2)
  })

  it('does not double-count self already in set', () => {
    const list = [{ peerId: 'me', kind: 'video' }]
    expect(countActiveCameraPublishersAtWire(list, 'me', true)).toBe(1)
  })

  it('counts zero when only audio producers', () => {
    const list = [
      { peerId: 'a', kind: 'audio' },
      { peerId: 'b', kind: 'audio' },
    ]
    expect(countActiveCameraPublishersAtWire(list, 'c', false)).toBe(0)
  })
})

describe('resolveOutgoingVideoPublishTier', () => {
  it('uses manual preset when allowed and explicit', () => {
    expect(
      resolveOutgoingVideoPublishTier({
        manualPreset: 'economy',
        manualExplicit: true,
        allowManualQuality: true,
        activeCameraPublishersAtWire: 99,
      }),
    ).toBe('economy')
  })

  it('ignores manual when not explicit', () => {
    expect(
      resolveOutgoingVideoPublishTier({
        manualPreset: 'hd',
        manualExplicit: false,
        allowManualQuality: true,
        activeCameraPublishersAtWire: 1,
      }),
    ).toBe('auto_small_room')
  })

  it('ignores manual when manual not allowed', () => {
    expect(
      resolveOutgoingVideoPublishTier({
        manualPreset: 'hd',
        manualExplicit: true,
        allowManualQuality: false,
        activeCameraPublishersAtWire: 1,
      }),
    ).toBe('auto_small_room')
  })

  it('uses small room when active cameras at wire <= ACTIVE_CAMERA_SMALL_ROOM_MAX', () => {
    expect(ACTIVE_CAMERA_SMALL_ROOM_MAX).toBe(4)
    expect(
      resolveOutgoingVideoPublishTier({
        manualPreset: 'balanced',
        manualExplicit: false,
        allowManualQuality: false,
        activeCameraPublishersAtWire: 4,
      }),
    ).toBe('auto_small_room')
  })

  it('uses large room when above threshold', () => {
    expect(
      resolveOutgoingVideoPublishTier({
        manualPreset: 'balanced',
        manualExplicit: false,
        allowManualQuality: false,
        activeCameraPublishersAtWire: 5,
      }),
    ).toBe('auto_large_room')
  })

  it('uses small room when wire snapshot has zero active video publishers', () => {
    expect(
      resolveOutgoingVideoPublishTier({
        manualPreset: 'balanced',
        manualExplicit: false,
        allowManualQuality: false,
        activeCameraPublishersAtWire: 0,
      }),
    ).toBe('auto_small_room')
  })

  it('manual balanced wins over wire snapshot when explicit and allowed', () => {
    expect(
      resolveOutgoingVideoPublishTier({
        manualPreset: 'balanced',
        manualExplicit: true,
        allowManualQuality: true,
        activeCameraPublishersAtWire: 50,
      }),
    ).toBe('balanced')
  })
})
