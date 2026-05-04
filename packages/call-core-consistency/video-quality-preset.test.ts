import { describe, expect, it } from 'vitest'
import {
  ACTIVE_CAMERA_SMALL_ROOM_MAX,
  CALL_VIDEO_HEIGHT,
  CALL_VIDEO_MAX_FRAMERATE,
  CALL_VIDEO_MIN_FRAMERATE,
  CALL_VIDEO_MOBILE_HEIGHT,
  CALL_VIDEO_MOBILE_MAX_FRAMERATE,
  CALL_VIDEO_MOBILE_WIDTH,
  CALL_VIDEO_TARGET_BITRATE_BPS,
  CALL_VIDEO_TARGET_BITRATE_BPS_SMALL_ROOM,
  CALL_VIDEO_WIDTH,
  countActiveCameraPublishersAtWire,
  getCallVideoConstraints,
  getCallVideoConstraintsForRuntime,
  getSingleLayerEncodingsForPreset,
  getSimulcastEncodingsForPreset,
  isVideoQualityPreset,
  resolveOutgoingVideoPublishTier,
  type VideoPublishTier,
} from '../call-core/src/media/videoQualityPreset'

describe('fixed call video quality', () => {
  it('uses one 480p layer at 20 fps and 600 kbps for the large-room compatibility API', () => {
    const e = getSimulcastEncodingsForPreset('auto_large_room')
    expect(e).toHaveLength(1)
    expect(e[0]).toMatchObject({
      scaleResolutionDownBy: 1,
      maxBitrate: CALL_VIDEO_TARGET_BITRATE_BPS,
      maxFramerate: CALL_VIDEO_MAX_FRAMERATE,
    })
    expect(e[0]?.rid).toBeUndefined()
  })

  it('uses one 480p layer at 20 fps with the small-room bitrate ceiling for auto_small_room', () => {
    const e = getSingleLayerEncodingsForPreset('auto_small_room')
    expect(e).toHaveLength(1)
    expect(e[0]).toMatchObject({
      scaleResolutionDownBy: 1,
      maxBitrate: CALL_VIDEO_TARGET_BITRATE_BPS_SMALL_ROOM,
      maxFramerate: CALL_VIDEO_MAX_FRAMERATE,
    })
    expect(e[0]?.rid).toBeUndefined()
    // Small-room bitrate must always be a (small) increase over the
    // large-room baseline; never below it. Resolution / FPS unchanged.
    expect(CALL_VIDEO_TARGET_BITRATE_BPS_SMALL_ROOM).toBeGreaterThan(CALL_VIDEO_TARGET_BITRATE_BPS)
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

describe('getCallVideoConstraintsForRuntime (mobile)', () => {
  it('returns the desktop preset when isMobile is false', () => {
    expect(getCallVideoConstraintsForRuntime('auto_large_room', false)).toEqual({
      width: { exact: CALL_VIDEO_WIDTH },
      height: { exact: CALL_VIDEO_HEIGHT },
      frameRate: { max: CALL_VIDEO_MAX_FRAMERATE },
    })
  })

  it('returns the lighter mobile preset using ideal/max (never exact) when isMobile is true', () => {
    const constraints = getCallVideoConstraintsForRuntime('auto_large_room', true)
    expect(constraints).toEqual({
      width: { ideal: CALL_VIDEO_MOBILE_WIDTH, max: CALL_VIDEO_WIDTH },
      height: { ideal: CALL_VIDEO_MOBILE_HEIGHT, max: CALL_VIDEO_HEIGHT },
      frameRate: { ideal: CALL_VIDEO_MOBILE_MAX_FRAMERATE, max: CALL_VIDEO_MAX_FRAMERATE },
    })
    expect(CALL_VIDEO_MOBILE_WIDTH).toBeLessThanOrEqual(CALL_VIDEO_WIDTH)
    expect(CALL_VIDEO_MOBILE_HEIGHT).toBeLessThanOrEqual(CALL_VIDEO_HEIGHT)
    expect(CALL_VIDEO_MOBILE_MAX_FRAMERATE).toBeLessThanOrEqual(CALL_VIDEO_MAX_FRAMERATE)
    expect(CALL_VIDEO_MOBILE_MAX_FRAMERATE).toBeGreaterThanOrEqual(CALL_VIDEO_MIN_FRAMERATE)
  })

  it('does not mutate a shared preset object across calls', () => {
    const a = getCallVideoConstraintsForRuntime('auto_large_room', true)
    const b = getCallVideoConstraintsForRuntime('auto_large_room', true)
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
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
  it('ignores manual preset and picks large-room when above the small-room threshold', () => {
    expect(
      resolveOutgoingVideoPublishTier({
        manualPreset: 'economy',
        manualExplicit: true,
        allowManualQuality: true,
        activeCameraPublishersAtWire: 99,
      }),
    ).toBe('auto_large_room')
  })

  it('picks small-room tier when manual is not explicit and there is a 1:1', () => {
    expect(
      resolveOutgoingVideoPublishTier({
        manualPreset: 'hd',
        manualExplicit: false,
        allowManualQuality: true,
        activeCameraPublishersAtWire: 1,
      }),
    ).toBe('auto_small_room')
  })

  it('picks small-room tier when manual is not allowed and there is a 1:1', () => {
    expect(
      resolveOutgoingVideoPublishTier({
        manualPreset: 'hd',
        manualExplicit: true,
        allowManualQuality: false,
        activeCameraPublishersAtWire: 1,
      }),
    ).toBe('auto_small_room')
  })

  it('picks small-room tier at exactly ACTIVE_CAMERA_SMALL_ROOM_MAX publishers', () => {
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

  it('switches to large-room tier above the small-room threshold', () => {
    expect(
      resolveOutgoingVideoPublishTier({
        manualPreset: 'balanced',
        manualExplicit: false,
        allowManualQuality: false,
        activeCameraPublishersAtWire: 5,
      }),
    ).toBe('auto_large_room')
  })

  it('falls back to large-room tier when wire snapshot has zero active video publishers', () => {
    // 0 means "nobody is publishing video yet" — there is no small-room budget
    // benefit to claim, and the safer default is the conservative tier.
    expect(
      resolveOutgoingVideoPublishTier({
        manualPreset: 'balanced',
        manualExplicit: false,
        allowManualQuality: false,
        activeCameraPublishersAtWire: 0,
      }),
    ).toBe('auto_large_room')
  })

  it('keeps large-room tier when manual balanced is explicit and the room is large', () => {
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
