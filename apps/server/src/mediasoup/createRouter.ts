import { getSupportedRtpCapabilities } from 'mediasoup'
import type { Router, RouterRtpCodecCapability, Worker } from 'mediasoup/node/lib/types'

/**
 * Use mediasoup's full codec entries (incl. rtcpFeedback like transport-cc / nack).
 * Minimal { mimeType, clockRate }-only codecs often break canConsume for Opus while VP8 still passes.
 */
function pickMediaCodecs(): RouterRtpCodecCapability[] {
  const supported = getSupportedRtpCapabilities()
  const codecs = supported.codecs ?? []
  const opus = codecs.find(
    (c) => c.kind === 'audio' && c.mimeType === 'audio/opus' && c.channels === 2,
  )
  const vp8 = codecs.find((c) => c.kind === 'video' && c.mimeType === 'video/VP8')
  if (!opus || !vp8) {
    throw new Error('mediasoup getSupportedRtpCapabilities() missing audio/opus or video/VP8')
  }
  return [opus, vp8]
}

export async function createRouter(worker: Worker): Promise<Router> {
  return worker.createRouter({ mediaCodecs: pickMediaCodecs() })
}
