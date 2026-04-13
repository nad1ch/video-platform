import type { Device } from 'mediasoup-client'
import type { DtlsParameters, Transport, TransportOptions } from 'mediasoup-client/types'
import { onUnmounted, shallowRef } from 'vue'

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

export type SendTransportRoomApi = {
  sendJson: (obj: object) => void
  addMessageListener: (handler: (data: unknown) => void) => () => void
}

const CONNECT_TIMEOUT_MS = 30_000

function waitForMessage<T>(
  addMessageListener: SendTransportRoomApi['addMessageListener'],
  predicate: (data: unknown) => data is T,
  timeoutMs: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = window.setTimeout(() => {
      if (settled) {
        return
      }
      settled = true
      unsubscribe()
      reject(new Error('signaling wait timeout'))
    }, timeoutMs)

    const unsubscribe = addMessageListener((data) => {
      if (settled || !predicate(data)) {
        return
      }
      settled = true
      window.clearTimeout(timer)
      unsubscribe()
      resolve(data)
    })
  })
}

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

    const created = await waitForMessage(
      room.addMessageListener,
      (d): d is { type: 'transport-created'; payload: { direction: 'send'; transportOptions: TransportOptions } } =>
        isTransportCreatedMessage(d, 'send'),
      CONNECT_TIMEOUT_MS,
    )

    const options = created.payload.transportOptions
    const transport = mediaDevice.createSendTransport(options)

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

      void waitForMessage(
        room.addMessageListener,
        (d) => isTransportConnectedMessage(d, transport.id),
        CONNECT_TIMEOUT_MS,
      )
        .then(() => success())
        .catch((err) => fail(err instanceof Error ? err : new Error(String(err))))
    })

    transport.on('produce', (_params, _resolve, reject) => {
      reject(new Error('produce signaling not implemented yet'))
    })

    transport.on('producedata', (_params, _resolve, reject) => {
      reject(new Error('data producer signaling not implemented yet'))
    })

    sendTransport.value = transport
    return transport
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
    closeSendTransport,
  }
}
