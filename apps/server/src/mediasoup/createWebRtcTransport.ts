import type { Router, WebRtcTransport } from 'mediasoup/node/lib/types'
import type { TransportListenInfo } from 'mediasoup/node/lib/TransportTypes'

function buildListenInfos(): TransportListenInfo[] {
  const announced = process.env.MEDIASOUP_ANNOUNCED_ADDRESS
  const announcedOpts = announced ? { announcedAddress: announced } : {}

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
