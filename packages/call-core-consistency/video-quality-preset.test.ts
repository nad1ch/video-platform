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
  getDesktopSimulcastEncodingsForLargeRoom,
  getOutgoingVideoEncodings,
  getSingleLayerEncodingsForPreset,
  getSimulcastEncodingsForPreset,
  isVideoQualityPreset,
  resolveOutgoingVideoPublishTier,
  shouldUsePublisherSimulcast,
  SIMULCAST_LAYER_HIGH_MAX_BITRATE_BPS,
  SIMULCAST_LAYER_HIGH_SCALE_DOWN_BY,
  SIMULCAST_LAYER_LOW_MAX_BITRATE_BPS,
  SIMULCAST_LAYER_LOW_SCALE_DOWN_BY,
  SIMULCAST_LAYER_MEDIUM_MAX_BITRATE_BPS,
  SIMULCAST_LAYER_MEDIUM_SCALE_DOWN_BY,
  type VideoPublishTier,
} from '../call-core/src/media/videoQualityPreset'
import { SIMULCAST_ACTIVE_CAMERA_THRESHOLD } from '../call-core/src/media/adaptiveSimulcastFeatureFlags'

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

describe('getDesktopSimulcastEncodingsForLargeRoom', () => {
  it('emits 3 layers in q,h,f rid order at 20 fps', () => {
    const layers = getDesktopSimulcastEncodingsForLargeRoom()
    expect(layers).toHaveLength(3)
    expect(layers[0].rid).toBe('q')
    expect(layers[1].rid).toBe('h')
    expect(layers[2].rid).toBe('f')
    for (const l of layers) {
      expect(l.maxFramerate).toBe(CALL_VIDEO_MAX_FRAMERATE)
    }
  })

  it('matches the documented scaleResolutionDownBy mapping', () => {
    const [low, medium, high] = getDesktopSimulcastEncodingsForLargeRoom()
    expect(low.scaleResolutionDownBy).toBe(SIMULCAST_LAYER_LOW_SCALE_DOWN_BY)
    expect(medium.scaleResolutionDownBy).toBe(SIMULCAST_LAYER_MEDIUM_SCALE_DOWN_BY)
    expect(high.scaleResolutionDownBy).toBe(SIMULCAST_LAYER_HIGH_SCALE_DOWN_BY)
    // High = no downscale (854×480), medium ~640×360 (854/1.3334), low ~427×240 (854/2).
    // Using a strict equality on scaleResolutionDownBy guards against accidental
    // changes that would fall back to libwebrtc defaults (typically 4/2/1).
    expect(low.scaleResolutionDownBy).toBe(2)
    expect(medium.scaleResolutionDownBy).toBeCloseTo(1.3334, 4)
    expect(high.scaleResolutionDownBy).toBe(1)
  })

  it('keeps the high rung at the historical single-encoding bitrate so strong receivers see no regression', () => {
    const [, , high] = getDesktopSimulcastEncodingsForLargeRoom()
    expect(high.maxBitrate).toBe(SIMULCAST_LAYER_HIGH_MAX_BITRATE_BPS)
    expect(high.maxBitrate).toBe(CALL_VIDEO_TARGET_BITRATE_BPS)
  })

  it('keeps low/medium bitrates inside ranges that produce visually acceptable VP8 at 20 fps', () => {
    const [low, medium] = getDesktopSimulcastEncodingsForLargeRoom()
    // Low rung (~240p / 20 fps): keep above 250 kbps so VP8 has bits for moving content.
    expect(low.maxBitrate).toBe(SIMULCAST_LAYER_LOW_MAX_BITRATE_BPS)
    expect(low.maxBitrate).toBeGreaterThanOrEqual(250_000)
    expect(low.maxBitrate).toBeLessThanOrEqual(400_000)
    // Medium (~360p / 20 fps): close to the legacy single-encoding feel.
    expect(medium.maxBitrate).toBe(SIMULCAST_LAYER_MEDIUM_MAX_BITRATE_BPS)
    expect(medium.maxBitrate).toBeGreaterThanOrEqual(450_000)
    expect(medium.maxBitrate).toBeLessThanOrEqual(800_000)
  })

  it('returns a fresh array each call (no shared mutation)', () => {
    const a = getDesktopSimulcastEncodingsForLargeRoom()
    const b = getDesktopSimulcastEncodingsForLargeRoom()
    expect(a).not.toBe(b)
  })
})

describe('shouldUsePublisherSimulcast', () => {
  it('disables when feature flag is off', () => {
    expect(
      shouldUsePublisherSimulcast({
        enabled: false,
        activeCameraPublishersAtWire: 12,
        isMobile: false,
        isScreenSharingAtWire: false,
      }),
    ).toBe(false)
  })

  it('disables in small rooms (≤ threshold)', () => {
    for (let n = 0; n <= SIMULCAST_ACTIVE_CAMERA_THRESHOLD; n += 1) {
      expect(
        shouldUsePublisherSimulcast({
          enabled: true,
          activeCameraPublishersAtWire: n,
          isMobile: false,
          isScreenSharingAtWire: false,
        }),
      ).toBe(false)
    }
  })

  it('enables for desktop publisher above threshold', () => {
    expect(
      shouldUsePublisherSimulcast({
        enabled: true,
        activeCameraPublishersAtWire: SIMULCAST_ACTIVE_CAMERA_THRESHOLD + 1,
        isMobile: false,
        isScreenSharingAtWire: false,
      }),
    ).toBe(true)
    expect(
      shouldUsePublisherSimulcast({
        enabled: true,
        activeCameraPublishersAtWire: 12,
        isMobile: false,
        isScreenSharingAtWire: false,
      }),
    ).toBe(true)
  })

  it('disables for mobile publishers in any room size', () => {
    expect(
      shouldUsePublisherSimulcast({
        enabled: true,
        activeCameraPublishersAtWire: 12,
        isMobile: true,
        isScreenSharingAtWire: false,
      }),
    ).toBe(false)
  })

  it('disables when publisher is screen-sharing at wire (preserves screen-share quality)', () => {
    expect(
      shouldUsePublisherSimulcast({
        enabled: true,
        activeCameraPublishersAtWire: 12,
        isMobile: false,
        isScreenSharingAtWire: true,
      }),
    ).toBe(false)
  })

  it('threshold is strictly greater-than (boundary lives in small-room path)', () => {
    expect(
      shouldUsePublisherSimulcast({
        enabled: true,
        activeCameraPublishersAtWire: SIMULCAST_ACTIVE_CAMERA_THRESHOLD,
        isMobile: false,
        isScreenSharingAtWire: false,
      }),
    ).toBe(false)
    expect(
      shouldUsePublisherSimulcast({
        enabled: true,
        activeCameraPublishersAtWire: SIMULCAST_ACTIVE_CAMERA_THRESHOLD + 1,
        isMobile: false,
        isScreenSharingAtWire: false,
      }),
    ).toBe(true)
  })
})

describe('getOutgoingVideoEncodings', () => {
  it('returns single encoding when simulcast is off (any tier)', () => {
    const tiers: VideoPublishTier[] = ['auto_large_room', 'auto_small_room', 'economy', 'balanced', 'hd']
    for (const t of tiers) {
      const enc = getOutgoingVideoEncodings(t, false)
      expect(enc).toHaveLength(1)
      expect(enc[0].rid).toBeUndefined()
    }
  })

  it('returns 3-layer simulcast when simulcast is on (large-room only path)', () => {
    const enc = getOutgoingVideoEncodings('auto_large_room', true)
    expect(enc).toHaveLength(3)
    expect(enc.map((e) => e.rid)).toEqual(['q', 'h', 'f'])
  })

  it('uses the same simulcast set regardless of tier value when simulcast is on', () => {
    // Phase 1 enables simulcast only in large rooms, but the encodings shape
    // is uniform — the tier currently does not affect simulcast bitrate caps.
    const a = getOutgoingVideoEncodings('auto_large_room', true)
    const b = getOutgoingVideoEncodings('balanced', true)
    expect(a.map((e) => ({ rid: e.rid, b: e.maxBitrate, s: e.scaleResolutionDownBy }))).toEqual(
      b.map((e) => ({ rid: e.rid, b: e.maxBitrate, s: e.scaleResolutionDownBy })),
    )
  })
})
