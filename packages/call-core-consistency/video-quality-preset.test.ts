import { describe, expect, it } from 'vitest'
import {
  ACTIVE_CAMERA_SMALL_ROOM_MAX,
  CALL_VIDEO_HEIGHT,
  CALL_VIDEO_MAX_FRAMERATE,
  CALL_VIDEO_MIN_FRAMERATE,
  CALL_VIDEO_TARGET_BITRATE_BPS,
  CALL_VIDEO_WIDTH,
  countActiveCameraPublishersAtWire,
  getCallVideoConstraints,
  getSingleLayerEncodingsForPreset,
  getSimulcastEncodingsForPreset,
  isVideoQualityPreset,
  resolveOutgoingVideoPublishTier,
  type VideoPublishTier,
} from '../call-core/src/media/videoQualityPreset'

describe('fixed call video quality', () => {
  it('uses one 480p layer at 20 fps and 600 kbps for the simulcast compatibility API', () => {
    const e = getSimulcastEncodingsForPreset('auto_large_room')
    expect(e).toHaveLength(1)
    expect(e[0]).toMatchObject({
      scaleResolutionDownBy: 1,
      maxBitrate: CALL_VIDEO_TARGET_BITRATE_BPS,
      maxFramerate: CALL_VIDEO_MAX_FRAMERATE,
    })
    expect(e[0]?.rid).toBeUndefined()
  })

  it('uses exact 854x480 capture with max 20 fps for every tier', () => {
    const tiers: VideoPublishTier[] = ['auto_large_room', 'auto_small_room', 'economy', 'balanced', 'hd']
    for (const tier of tiers) {
      expect(getCallVideoConstraints(tier)).toEqual({
        width: { exact: CALL_VIDEO_WIDTH },
        height: { exact: CALL_VIDEO_HEIGHT },
        frameRate: { max: CALL_VIDEO_MAX_FRAMERATE },
      })
    }
  })

  it('keeps all outbound fps caps inside the call fps range', () => {
    const tiers: VideoPublishTier[] = ['auto_large_room', 'auto_small_room', 'economy', 'balanced', 'hd']
    for (const tier of tiers) {
      for (const enc of getSimulcastEncodingsForPreset(tier)) {
        expect(enc.maxFramerate).toBeGreaterThanOrEqual(CALL_VIDEO_MIN_FRAMERATE)
        expect(enc.maxFramerate).toBeLessThanOrEqual(CALL_VIDEO_MAX_FRAMERATE)
      }
      for (const enc of getSingleLayerEncodingsForPreset(tier)) {
        expect(enc.maxFramerate).toBeGreaterThanOrEqual(CALL_VIDEO_MIN_FRAMERATE)
        expect(enc.maxFramerate).toBeLessThanOrEqual(CALL_VIDEO_MAX_FRAMERATE)
      }
    }
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
  it('ignores manual preset so every participant uses the fixed tier', () => {
    expect(
      resolveOutgoingVideoPublishTier({
        manualPreset: 'economy',
        manualExplicit: true,
        allowManualQuality: true,
        activeCameraPublishersAtWire: 99,
      }),
    ).toBe('auto_large_room')
  })

  it('keeps fixed tier when manual is not explicit', () => {
    expect(
      resolveOutgoingVideoPublishTier({
        manualPreset: 'hd',
        manualExplicit: false,
        allowManualQuality: true,
        activeCameraPublishersAtWire: 1,
      }),
    ).toBe('auto_large_room')
  })

  it('keeps fixed tier when manual is not allowed', () => {
    expect(
      resolveOutgoingVideoPublishTier({
        manualPreset: 'hd',
        manualExplicit: true,
        allowManualQuality: false,
        activeCameraPublishersAtWire: 1,
      }),
    ).toBe('auto_large_room')
  })

  it('keeps fixed tier when active cameras at wire <= ACTIVE_CAMERA_SMALL_ROOM_MAX', () => {
    expect(ACTIVE_CAMERA_SMALL_ROOM_MAX).toBe(4)
    expect(
      resolveOutgoingVideoPublishTier({
        manualPreset: 'balanced',
        manualExplicit: false,
        allowManualQuality: false,
        activeCameraPublishersAtWire: 4,
      }),
    ).toBe('auto_large_room')
  })

  it('keeps fixed tier when above the old threshold', () => {
    expect(
      resolveOutgoingVideoPublishTier({
        manualPreset: 'balanced',
        manualExplicit: false,
        allowManualQuality: false,
        activeCameraPublishersAtWire: 5,
      }),
    ).toBe('auto_large_room')
  })

  it('keeps fixed tier when wire snapshot has zero active video publishers', () => {
    expect(
      resolveOutgoingVideoPublishTier({
        manualPreset: 'balanced',
        manualExplicit: false,
        allowManualQuality: false,
        activeCameraPublishersAtWire: 0,
      }),
    ).toBe('auto_large_room')
  })

  it('keeps fixed tier when manual balanced is explicit and allowed', () => {
    expect(
      resolveOutgoingVideoPublishTier({
        manualPreset: 'balanced',
        manualExplicit: true,
        allowManualQuality: true,
        activeCameraPublishersAtWire: 50,
      }),
    ).toBe('auto_large_room')
  })
})
