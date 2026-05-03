import type { RouterRtpCodecCapability } from 'mediasoup/types'

/**
 * Pure codec-list builder. Lives in its own file so unit tests can import it without
 * requiring the native `mediasoup` runtime module (we only depend on its TS types).
 *
 * Router-level video codecs we accept, in **declaration order** = SFU preference order.
 *
 * Why include all three:
 *   - **VP8** stays first to keep desktop Chrome / Edge / Android Chrome on VP8 (stable
 *     today; existing producers and consumers all negotiate VP8 by default).
 *   - **H.264** is required for **iOS Safari / iPhone**: VP8 has no hardware decoder on
 *     Apple silicon, so a VP8-only router forces software decode and burns battery.
 *     H.264 baseline (`profile-level-id=42e01f`, `packetization-mode=1`) is the lowest
 *     common denominator that every modern browser can both encode and decode in
 *     hardware (Safari ≥ 13, Chrome on every platform, Firefox on Android, Edge).
 *     `level-asymmetry-allowed=1` lets sender and receiver advertise different H.264
 *     levels, which is required for mediasoup to forward between asymmetric peers.
 *   - **VP9** is opt-in. mediasoup accepts it as SVC; we stay on profile 0 (8-bit, 4:2:0)
 *     which all current browsers support. Listed last so the SFU only picks it when no
 *     peer can negotiate VP8 or H.264 (very rare).
 *
 * We intentionally do **not** force a codec via `transport.produce({ codec })`. The
 * browser picks based on its own RTP capabilities intersected with the router's, which
 * gives the optimal native choice (VP8 on desktop Chrome, H.264 on iOS Safari).
 */
export function buildMediaCodecsFromSupported(
  supportedCodecs: readonly RouterRtpCodecCapability[],
): RouterRtpCodecCapability[] {
  const opus = supportedCodecs.find(
    (c) => c.kind === 'audio' && c.mimeType === 'audio/opus' && c.channels === 2,
  )
  const vp8 = supportedCodecs.find((c) => c.kind === 'video' && c.mimeType === 'video/VP8')
  if (!opus || !vp8) {
    throw new Error('mediasoup getSupportedRtpCapabilities() missing audio/opus or video/VP8')
  }

  const out: RouterRtpCodecCapability[] = [opus, vp8]

  const h264 = supportedCodecs.find((c) => c.kind === 'video' && c.mimeType === 'video/H264')
  if (h264) {
    out.push({
      ...h264,
      parameters: {
        ...(h264.parameters ?? {}),
        'profile-level-id': '42e01f',
        'packetization-mode': 1,
        'level-asymmetry-allowed': 1,
      },
    })
  }

  const vp9 = supportedCodecs.find((c) => c.kind === 'video' && c.mimeType === 'video/VP9')
  if (vp9) {
    out.push({
      ...vp9,
      parameters: {
        ...(vp9.parameters ?? {}),
        'profile-id': 0,
      },
    })
  }

  return out
}
