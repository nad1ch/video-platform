import type { Device } from 'mediasoup-client'
import type {
  Consumer,
  ConnectionState,
  DtlsParameters,
  RtpParameters,
  Transport,
  TransportOptions,
} from 'mediasoup-client/types'
import { computed, onUnmounted, ref, shallowRef } from 'vue'
import type { SendTransportRoomApi } from './useSendTransport'
import { waitForSignalingMessage } from './signalingWait'

export type RemoteProducerInfo = {
  producerId: string
  peerId: string
  kind: 'audio' | 'video'
}

const TIMEOUT_MS = 45_000

function isTransportCreatedRecv(
  data: unknown,
): data is { type: 'transport-created'; payload: { direction: 'recv'; transportOptions: TransportOptions } } {
  if (!data || typeof data !== 'object') {
    return false
  }
  const msg = data as { type?: string; payload?: unknown }
  if (msg.type !== 'transport-created' || !msg.payload || typeof msg.payload !== 'object') {
    return false
  }
  const p = msg.payload as { direction?: string; transportOptions?: unknown }
  return (
    p.direction === 'recv' &&
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

function isProducerSync(
  data: unknown,
): data is { type: 'producer-sync'; payload: { producers: RemoteProducerInfo[] } } {
  if (!data || typeof data !== 'object') {
    return false
  }
  const msg = data as { type?: string; payload?: unknown }
  if (msg.type !== 'producer-sync' || !msg.payload || typeof msg.payload !== 'object') {
    return false
  }
  const p = msg.payload as { producers?: unknown }
  return Array.isArray(p.producers)
}

function isNewProducer(data: unknown): data is { type: 'new-producer'; payload: RemoteProducerInfo } {
  if (!data || typeof data !== 'object') {
    return false
  }
  const msg = data as { type?: string; payload?: unknown }
  if (msg.type !== 'new-producer' || !msg.payload || typeof msg.payload !== 'object') {
    return false
  }
  const p = msg.payload as { producerId?: string; peerId?: string; kind?: string }
  return (
    typeof p.producerId === 'string' &&
    typeof p.peerId === 'string' &&
    (p.kind === 'audio' || p.kind === 'video')
  )
}

function isConsumedForProducer(
  data: unknown,
  producerId: string,
): data is {
  type: 'consumed'
  payload: { id: string; producerId: string; kind: 'audio' | 'video'; rtpParameters: RtpParameters }
} {
  if (!data || typeof data !== 'object') {
    return false
  }
  const msg = data as { type?: string; payload?: unknown }
  if (msg.type !== 'consumed' || !msg.payload || typeof msg.payload !== 'object') {
    return false
  }
  const p = msg.payload as {
    id?: string
    producerId?: string
    kind?: string
    rtpParameters?: unknown
  }
  return (
    typeof p.id === 'string' &&
    p.producerId === producerId &&
    (p.kind === 'audio' || p.kind === 'video') &&
    p.rtpParameters !== undefined &&
    typeof p.rtpParameters === 'object'
  )
}

export type RemotePeerStream = { peerId: string; stream: MediaStream }

export function useRemoteMedia() {
  const recvTransport = shallowRef<Transport | null>(null)
  /** Stable MediaStream per remote peer (mutate with addTrack / removeTrack only). */
  const streamsByPeerId = new Map<string, MediaStream>()
  const remotePeerStreams = ref<RemotePeerStream[]>([])
  /** Bumps when remote MediaStream is mutated (addTrack); remote tiles use this to call play() again. */
  const remotePlayRev = ref(0)
  const consumedProducerIds = new Set<string>()
  const consumersByProducerId = new Map<string, Consumer>()
  let unsubscribeNewProducer: (() => void) | null = null

  const remoteStreams = computed(() => remotePeerStreams.value.map((e) => e.stream))

  function getOrCreateStream(peerId: string): MediaStream {
    let stream = streamsByPeerId.get(peerId)
    if (!stream) {
      stream = new MediaStream()
      streamsByPeerId.set(peerId, stream)
    }
    return stream
  }

  function syncRemotePeerStreamsRef(): void {
    remotePeerStreams.value = Array.from(streamsByPeerId.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, stream]) => ({ peerId: id, stream }))
    remotePlayRev.value += 1
  }

  function wireRemoteTrack(stream: MediaStream, peerId: string, track: MediaStreamTrack): void {
    track.onended = () => {
      stream.removeTrack(track)
      syncRemotePeerStreamsRef()
      if (import.meta.env.DEV) {
        console.log('[track] ended', track.id, { peerId })
      }
    }
    if (import.meta.env.DEV) {
      track.onmute = () => {
        console.log('[track] muted', track.id)
      }
      track.onunmute = () => {
        console.log('[track] unmuted', track.id)
      }
    }
  }

  function upsertRemoteTrack(peerId: string, track: MediaStreamTrack): void {
    const stream = getOrCreateStream(peerId)

    for (const t of [...stream.getTracks()]) {
      if (t.kind === track.kind) {
        stream.removeTrack(t)
        t.stop()
      }
    }

    stream.addTrack(track)
    wireRemoteTrack(stream, peerId, track)

    if (import.meta.env.DEV) {
      console.log('[remote] stream updated', {
        peerId,
        tracks: stream.getTracks().map((t) => ({
          kind: t.kind,
          id: t.id,
          readyState: t.readyState,
        })),
      })
    }

    syncRemotePeerStreamsRef()
  }

  async function ensureRecvTransport(device: Device, room: SendTransportRoomApi): Promise<Transport> {
    if (recvTransport.value && !recvTransport.value.closed) {
      return recvTransport.value
    }

    room.sendJson({ type: 'create-transport', payload: { direction: 'recv' } })

    const created = await waitForSignalingMessage(
      room.addMessageListener,
      (d) => isTransportCreatedRecv(d),
      TIMEOUT_MS,
    )

    const transport = device.createRecvTransport(created.payload.transportOptions)

    transport.on('connectionstatechange', (state: ConnectionState) => {
      console.log('[recvTransport] connectionState:', state, { id: transport.id })
      if (state === 'failed') {
        console.error('[ICE] recv transport FAILED', { id: transport.id })
      }
    })

    transport.on('connect', ({ dtlsParameters }: { dtlsParameters: DtlsParameters }, success, fail) => {
      try {
        room.sendJson({
          type: 'connect-transport',
          payload: { transportId: transport.id, dtlsParameters },
        })
      } catch (err) {
        fail(err instanceof Error ? err : new Error(String(err)))
        return
      }

      void waitForSignalingMessage(
        room.addMessageListener,
        (d) => isTransportConnectedMessage(d, transport.id),
        TIMEOUT_MS,
      )
        .then(() => {
          success()
          return waitForSignalingMessage(
            room.addMessageListener,
            (d) => isProducerSync(d),
            10_000,
          ).catch(() => null)
        })
        .then((sync) => {
          if (sync?.payload.producers.length) {
            for (const item of sync.payload.producers) {
              void consumeProducer(device, room, item.producerId, item.peerId)
            }
          }
        })
        .catch((err) => fail(err instanceof Error ? err : new Error(String(err))))
    })

    recvTransport.value = transport
    return transport
  }

  async function consumeProducer(
    device: Device,
    room: SendTransportRoomApi,
    producerId: string,
    peerId: string,
  ): Promise<void> {
    if (consumedProducerIds.has(producerId)) {
      return
    }
    if (!device.loaded) {
      throw new Error('Device not loaded')
    }

    const transport = await ensureRecvTransport(device, room)
    if (consumedProducerIds.has(producerId)) {
      return
    }
    consumedProducerIds.add(producerId)

    try {
      room.sendJson({
        type: 'consume',
        payload: {
          transportId: transport.id,
          producerId,
          rtpCapabilities: device.rtpCapabilities,
        },
      })

      const msg = await waitForSignalingMessage(
        room.addMessageListener,
        (d) => isConsumedForProducer(d, producerId),
        TIMEOUT_MS,
      )

      const consumer = await transport.consume({
        id: msg.payload.id,
        producerId: msg.payload.producerId,
        kind: msg.payload.kind,
        rtpParameters: msg.payload.rtpParameters,
      })

      if (import.meta.env.DEV) {
        console.log('[consumer]', {
          kind: consumer.kind,
          paused: consumer.paused,
          trackMuted: consumer.track.muted,
          trackReadyState: consumer.track.readyState,
        })
      }

      await consumer.resume()

      if (import.meta.env.DEV) {
        console.log('[consumer] after resume', {
          paused: consumer.paused,
          trackMuted: consumer.track.muted,
        })
      }

      consumersByProducerId.set(producerId, consumer)
      upsertRemoteTrack(peerId, consumer.track)
    } catch (err) {
      consumedProducerIds.delete(producerId)
      throw err
    }
  }

  function startNewProducerListener(device: Device, room: SendTransportRoomApi): void {
    unsubscribeNewProducer?.()
    unsubscribeNewProducer = room.addMessageListener((data) => {
      if (!isNewProducer(data)) {
        return
      }
      void consumeProducer(device, room, data.payload.producerId, data.payload.peerId).catch((e) => {
        console.error('consume after new-producer failed', e)
      })
    })
  }

  async function syncExistingProducers(
    device: Device,
    room: SendTransportRoomApi,
    list: RemoteProducerInfo[],
  ): Promise<void> {
    for (const item of list) {
      await consumeProducer(device, room, item.producerId, item.peerId)
    }
  }

  async function setupReceivePath(
    device: Device,
    room: SendTransportRoomApi,
    existing: RemoteProducerInfo[],
  ): Promise<void> {
    await ensureRecvTransport(device, room)
    startNewProducerListener(device, room)
    await syncExistingProducers(device, room, existing)
  }

  function stopRemoteMedia(): void {
    unsubscribeNewProducer?.()
    unsubscribeNewProducer = null
    for (const consumer of consumersByProducerId.values()) {
      if (!consumer.closed) {
        consumer.close()
      }
    }
    consumersByProducerId.clear()
    for (const stream of streamsByPeerId.values()) {
      for (const track of stream.getTracks()) {
        track.stop()
      }
    }
    streamsByPeerId.clear()
    remotePeerStreams.value = []
    consumedProducerIds.clear()
    const t = recvTransport.value
    if (t && !t.closed) {
      t.close()
    }
    recvTransport.value = null
  }

  onUnmounted(() => {
    stopRemoteMedia()
  })

  return {
    recvTransport,
    remotePeerStreams,
    remotePlayRev,
    remoteStreams,
    ensureRecvTransport,
    consumeProducer,
    startNewProducerListener,
    syncExistingProducers,
    setupReceivePath,
    stopRemoteMedia,
  }
}
