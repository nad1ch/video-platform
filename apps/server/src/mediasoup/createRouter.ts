import { getSupportedRtpCapabilities } from 'mediasoup'
import type { Router, RouterRtpCodecCapability, Worker } from 'mediasoup/types'
import { buildMediaCodecsFromSupported } from './mediaCodecs'

function pickMediaCodecs(): RouterRtpCodecCapability[] {
  const supported = getSupportedRtpCapabilities()
  return buildMediaCodecsFromSupported(supported.codecs ?? [])
}

export async function createRouter(worker: Worker): Promise<Router> {
  return worker.createRouter({ mediaCodecs: pickMediaCodecs() })
}
