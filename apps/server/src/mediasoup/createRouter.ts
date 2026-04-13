import type { Router, RouterRtpCodecCapability, Worker } from 'mediasoup/node/lib/types'

const mediaCodecs: RouterRtpCodecCapability[] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
  },
]

export async function createRouter(worker: Worker): Promise<Router> {
  return worker.createRouter({ mediaCodecs })
}
