import type { Router, WebRtcTransport } from 'mediasoup/node/lib/types'
import type { TransportListenInfo } from 'mediasoup/node/lib/TransportTypes'

let warnedAnnouncedMissing = false

/**
 * ICE candidates must advertise an address the browser can reach. Bind stays on 0.0.0.0.
 * Set MEDIASOUP_ANNOUNCED_ADDRESS to host LAN IP for other devices; Docker needs the host IP, not the container's.
 */
function resolveAnnouncedAddress(): string | undefined {
  const fromEnv = process.env.MEDIASOUP_ANNOUNCED_ADDRESS?.trim()
  if (fromEnv) {
    return fromEnv
  }
  if (process.env.NODE_ENV !== 'production') {
    if (!warnedAnnouncedMissing) {
      warnedAnnouncedMissing = true
      console.warn(
        '[mediasoup] MEDIASOUP_ANNOUNCED_ADDRESS unset → using 127.0.0.1 (OK for two tabs on this PC). ' +
          'For another machine on LAN, set MEDIASOUP_ANNOUNCED_ADDRESS to this host\'s LAN IP.',
      )
    }
    return '127.0.0.1'
  }
  if (!warnedAnnouncedMissing) {
    warnedAnnouncedMissing = true
    console.warn(
      '[mediasoup] MEDIASOUP_ANNOUNCED_ADDRESS unset — remote peers may get black video / no RTP. Set it to the public/LAN IP browsers use to reach this server.',
    )
  }
  return undefined
}

function buildListenInfos(): TransportListenInfo[] {
  const announced = resolveAnnouncedAddress()
  const announcedOpts =
    announced !== undefined && announced !== '' ? { announcedAddress: announced } : {}

  const udp: TransportListenInfo = {
    protocol: 'udp',
    ip: '0.0.0.0',
    ...announcedOpts,
  }

  const tcp: TransportListenInfo = {
    protocol: 'tcp',
    ip: '0.0.0.0',
    ...announcedOpts,
  }

  return [udp, tcp]
}

export async function createWebRtcTransport(
  router: Router,
  direction: 'send' | 'recv',
): Promise<WebRtcTransport> {
  return router.createWebRtcTransport({
    listenInfos: buildListenInfos(),
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    appData: { direction },
  })
}
