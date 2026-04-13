import type { Device } from 'mediasoup-client'
import type {
  ConnectionState,
  DtlsParameters,
  Transport,
  TransportOptions,
} from 'mediasoup-client/types'
import { onUnmounted, shallowRef } from 'vue'
import { waitForSignalingMessage } from '../signaling/signalingWait'

function isTransportCreatedMessage(
  data: unknown,
  direction: 'send' | 'recv',
): data is {
  type: 'transport-created'
  payload: { direction: 'send' | 'recv'; transportOptions: TransportOptions }
} {
  if (!data || typeof data !== 'object') {
    return false
  }
  const msg = data as { type?: string; payload?: unknown }
  if (msg.type !== 'transport-created' || !msg.payload || typeof msg.payload !== 'object') {
    return false
  }
  const p = msg.payload as { direction?: string; transportOptions?: unknown }
  return (
    p.direction === direction &&
    !!p.transportOptions &&
    typeof p.transportOptions === 'object' &&
    typeof (p.transportOptions as TransportOptions).id === 'string'
  )
}

function isTransportConnectedMessage(
  data: unknown,
  transportId: string,
): data is { type: 'transport-connected'; payload: { transportId: string } } {
  if (!data || typeof data !== 'object') {
    return false
  }
  const msg = data as { type?: string; payload?: unknown }
  if (msg.type !== 'transport-connected' || !msg.payload || typeof msg.payload !== 'object') {
    return false
  }
  const p = msg.payload as { transportId?: string }
  return p.transportId === transportId
}

function isProducedMessage(
  data: unknown,
  requestId: string,
): data is { type: 'produced'; payload: { id: string; requestId: string } } {
  if (!data || typeof data !== 'object') {
    return false
  }
  const msg = data as { type?: string; payload?: unknown }
  if (msg.type !== 'produced' || !msg.payload || typeof msg.payload !== 'object') {
    return false
  }
  const p = msg.payload as { id?: string; requestId?: string }
  return typeof p.id === 'string' && p.requestId === requestId
}

export type PendingProducerNotice = {
  producerId: string
  peerId: string
  kind: 'audio' | 'video'
}

export type SendTransportRoomApi = {
  sendJson: (obj: object) => void
  addMessageListener: (handler: (data: unknown) => void) => () => void
  /**
   * Flushes producers that were announced via `new-producer` before the recv listener
   * was registered (join → loadDevice race). Call once when wiring remote media.
   */
  drainPendingNewProducers?: () => PendingProducerNotice[]
}

const CONNECT_TIMEOUT_MS = 45_000

export function useSendTransport() {
  const sendTransport = shallowRef<Transport | null>(null)

  async function createSendTransport(
    mediaDevice: Device,
    room: SendTransportRoomApi,
  ): Promise<Transport> {
    if (!mediaDevice.loaded) {
      throw new Error('Device must be loaded before creating send transport')
    }

    if (sendTransport.value && !sendTransport.value.closed) {
      sendTransport.value.close()
      sendTransport.value = null
    }

    room.sendJson({ type: 'create-transport', payload: { direction: 'send' } })

    const created = await waitForSignalingMessage(
      room.addMessageListener,
      (d): d is { type: 'transport-created'; payload: { direction: 'send'; transportOptions: TransportOptions } } =>
        isTransportCreatedMessage(d, 'send'),
      CONNECT_TIMEOUT_MS,
    )

    const options = created.payload.transportOptions
    const transport = mediaDevice.createSendTransport(options)

    transport.on('connectionstatechange', (state: ConnectionState) => {
      console.log('[sendTransport] connectionState:', state, { id: transport.id })
      if (state === 'failed') {
        console.error('[ICE] send transport FAILED', { id: transport.id })
      }
    })

    transport.on('connect', ({ dtlsParameters }: { dtlsParameters: DtlsParameters }, success, fail) => {
      try {
        room.sendJson({
          type: 'connect-transport',
          payload: {
            transportId: transport.id,
            dtlsParameters,
          },
        })
      } catch (err) {
        fail(err instanceof Error ? err : new Error(String(err)))
        return
      }

      void waitForSignalingMessage(
        room.addMessageListener,
        (d) => isTransportConnectedMessage(d, transport.id),
        CONNECT_TIMEOUT_MS,
      )
        .then(() => success())
        .catch((err) => fail(err instanceof Error ? err : new Error(String(err))))
    })

    transport.on('produce', ({ kind, rtpParameters }, resolve, reject) => {
      const requestId = crypto.randomUUID()
      try {
        room.sendJson({
          type: 'produce',
          payload: {
            transportId: transport.id,
            kind,
            rtpParameters,
            requestId,
          },
        })
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
        return
      }

      void waitForSignalingMessage(
        room.addMessageListener,
        (d) => isProducedMessage(d, requestId),
        CONNECT_TIMEOUT_MS,
      )
        .then((msg) => resolve({ id: msg.payload.id }))
        .catch((err) => reject(err instanceof Error ? err : new Error(String(err))))
    })

    transport.on('producedata', (_params, _resolve, reject) => {
      reject(new Error('data producer signaling not implemented yet'))
    })

    sendTransport.value = transport
    return transport
  }

  async function publishLocalMedia(stream: MediaStream): Promise<void> {
    const transport = sendTransport.value
    if (!transport || transport.closed) {
      throw new Error('Send transport required')
    }
    for (const track of stream.getTracks()) {
      if (track.kind !== 'audio' && track.kind !== 'video') {
        continue
      }
      await transport.produce({ track })
    }
  }

  function closeSendTransport(): void {
    const t = sendTransport.value
    if (t && !t.closed) {
      t.close()
    }
    sendTransport.value = null
  }

  onUnmounted(() => {
    closeSendTransport()
  })

  return {
    sendTransport,
    createSendTransport,
    publishLocalMedia,
    closeSendTransport,
  }
}
