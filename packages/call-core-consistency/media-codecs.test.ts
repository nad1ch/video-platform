import { describe, expect, it } from 'vitest'
import type { RouterRtpCodecCapability } from 'mediasoup/types'
import { buildMediaCodecsFromSupported } from '../../apps/server/src/mediasoup/mediaCodecs'

/**
 * Mirror of the shape `getSupportedRtpCapabilities()` returns from the mediasoup
 * runtime, trimmed down to the entries the picker cares about. The real list also
 * includes RED/RTX/ULPFEC etc. which the picker ignores.
 */
const SUPPORTED: RouterRtpCodecCapability[] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48_000,
    channels: 2,
    rtcpFeedback: [{ type: 'transport-cc' }],
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90_000,
    parameters: {},
    rtcpFeedback: [
      { type: 'nack' },
      { type: 'nack', parameter: 'pli' },
      { type: 'ccm', parameter: 'fir' },
      { type: 'goog-remb' },
      { type: 'transport-cc' },
    ],
  },
  {
    kind: 'video',
    mimeType: 'video/H264',
    clockRate: 90_000,
    parameters: {
      'level-asymmetry-allowed': 1,
      'packetization-mode': 1,
      'profile-level-id': '4d0032',
    },
    rtcpFeedback: [
      { type: 'nack' },
      { type: 'nack', parameter: 'pli' },
      { type: 'ccm', parameter: 'fir' },
      { type: 'goog-remb' },
      { type: 'transport-cc' },
    ],
  },
  {
    kind: 'video',
    mimeType: 'video/VP9',
    clockRate: 90_000,
    parameters: { 'profile-id': 2 },
    rtcpFeedback: [
      { type: 'nack' },
      { type: 'nack', parameter: 'pli' },
      { type: 'ccm', parameter: 'fir' },
      { type: 'goog-remb' },
      { type: 'transport-cc' },
    ],
  },
]

describe('buildMediaCodecsFromSupported', () => {
  it('returns Opus first, VP8 second (back-compat default), then H.264, then VP9', () => {
    const out = buildMediaCodecsFromSupported(SUPPORTED)
    expect(out.map((c) => c.mimeType)).toEqual([
      'audio/opus',
      'video/VP8',
      'video/H264',
      'video/VP9',
    ])
  })

  it('uses H.264 constrained-baseline (42e01f) with packetization-mode 1 and level-asymmetry-allowed', () => {
    const out = buildMediaCodecsFromSupported(SUPPORTED)
    const h264 = out.find((c) => c.mimeType === 'video/H264')
    expect(h264).toBeDefined()
    expect(h264?.parameters).toMatchObject({
      'profile-level-id': '42e01f',
      'packetization-mode': 1,
      'level-asymmetry-allowed': 1,
    })
  })

  it('forces VP9 profile 0 even when the supported entry advertised a different profile', () => {
    const out = buildMediaCodecsFromSupported(SUPPORTED)
    const vp9 = out.find((c) => c.mimeType === 'video/VP9')
    expect(vp9).toBeDefined()
    expect(vp9?.parameters).toMatchObject({ 'profile-id': 0 })
  })

  it('preserves rtcpFeedback (transport-cc / nack / pli / fir) so PLI keyframes still work', () => {
    const out = buildMediaCodecsFromSupported(SUPPORTED)
    const vp8 = out.find((c) => c.mimeType === 'video/VP8')
    const h264 = out.find((c) => c.mimeType === 'video/H264')
    expect(vp8?.rtcpFeedback).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'nack' }),
        expect.objectContaining({ type: 'nack', parameter: 'pli' }),
        expect.objectContaining({ type: 'transport-cc' }),
      ]),
    )
    expect(h264?.rtcpFeedback).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'nack', parameter: 'pli' }),
        expect.objectContaining({ type: 'transport-cc' }),
      ]),
    )
  })

  it('throws if Opus or VP8 are missing — VP8 is the only mandatory video codec', () => {
    const noVp8 = SUPPORTED.filter((c) => c.mimeType !== 'video/VP8')
    expect(() => buildMediaCodecsFromSupported(noVp8)).toThrow(/missing audio\/opus or video\/VP8/)

    const noOpus = SUPPORTED.filter((c) => c.mimeType !== 'audio/opus')
    expect(() => buildMediaCodecsFromSupported(noOpus)).toThrow(/missing audio\/opus or video\/VP8/)
  })

  it('omits H.264/VP9 when the runtime does not advertise them (degrades to VP8-only)', () => {
    const minimal = SUPPORTED.filter(
      (c) => c.mimeType === 'audio/opus' || c.mimeType === 'video/VP8',
    )
    const out = buildMediaCodecsFromSupported(minimal)
    expect(out.map((c) => c.mimeType)).toEqual(['audio/opus', 'video/VP8'])
  })
})
