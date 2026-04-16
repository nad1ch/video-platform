import type { Device } from 'mediasoup-client'
import type {
  ConnectionState,
  DtlsParameters,
  Producer,
  Transport,
  TransportOptions,
} from 'mediasoup-client/types'
import { onUnmounted, shallowRef } from 'vue'
import {
  getSimulcastEncodingsForPreset,
  getSingleLayerEncodingsForPreset,
  type VideoPublishTier,
} from '../media/videoQualityPreset'
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
  videoSource?: 'camera' | 'screen'
}

export type PublishLocalMediaOptions = {
  /**
   * Large-room mode: VP8 simulcast + receiver spatial-layer signaling.
   * Omit or `false` for single-layer (default; best for small calls).
   */
  videoSimulcast?: boolean
  /** Capture/encode ladder; defaults to `balanced` for API callers that omit it. */
  videoPublishTier?: VideoPublishTier
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

function outboundVideoGoogleStartBitrateKbps(tier: VideoPublishTier): number {
  switch (tier) {
    case 'economy':
      return 400
    case 'hd':
      return 1200
    case 'auto_large_room':
      return 750
    case 'auto_small_room':
      return 900
    case 'balanced':
    default:
      return 900
  }
}

/** Mild Opus cap — stable voice, not aggressive throttling. */
const OUTBOUND_AUDIO_OPUS_MAX_AVG_BITRATE_BPS = 96_000

export function useSendTransport() {
  const sendTransport = shallowRef<Transport | null>(null)
  /** First outbound camera producer (used for screen-share `replaceTrack`). */
  const outboundVideoProducer = shallowRef<Producer | null>(null)
  /** First outbound mic producer (`replaceTrack` when user switches input device). */
  const outboundAudioProducer = shallowRef<Producer | null>(null)

  /** Serialize outbound video `replaceTrack` (screen ↔ camera spam, device swap + screen). */
  let outboundVideoReplaceChain: Promise<unknown> = Promise.resolve()

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
            ...(kind === 'video' ? { videoSource: 'camera' as const } : {}),
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

  async function publishLocalMedia(stream: MediaStream, options?: PublishLocalMediaOptions): Promise<void> {
    const transport = sendTransport.value
    if (!transport || transport.closed) {
      throw new Error('Send transport required')
    }
    for (const track of stream.getTracks()) {
      if (track.kind !== 'audio' && track.kind !== 'video') {
        continue
      }
      if (track.kind === 'video') {
        const useSimulcast = options?.videoSimulcast === true
        const tier = options?.videoPublishTier ?? 'balanced'
        const encodings = useSimulcast
          ? getSimulcastEncodingsForPreset(tier)
          : getSingleLayerEncodingsForPreset(tier)
        if (import.meta.env.DEV) {
          console.log('[produce] video outbound', {
            trackId: track.id,
            simulcast: useSimulcast,
            tier,
            encodings: encodings.map((e) => ({
              maxBitrate: e.maxBitrate,
              scaleResolutionDownBy: e.scaleResolutionDownBy,
              rid: e.rid,
              maxFramerate: e.maxFramerate,
            })),
          })
        }
        const producer = await transport.produce({
          track,
          encodings,
          codecOptions: {
            videoGoogleStartBitrate: outboundVideoGoogleStartBitrateKbps(tier),
          },
        })
        if (import.meta.env.DEV) {
          console.log('[produce] PRODUCER CREATED', producer.id, producer.kind)
        }
        outboundVideoProducer.value = producer
      } else {
        const audioProducer = await transport.produce({
          track,
          codecOptions: {
            opusDtx: true,
            opusFec: true,
            opusMaxAverageBitrate: OUTBOUND_AUDIO_OPUS_MAX_AVG_BITRATE_BPS,
          },
        })
        outboundAudioProducer.value = audioProducer
      }
    }
  }

  async function replaceOutboundVideoTrack(track: MediaStreamTrack): Promise<string> {
    const job = outboundVideoReplaceChain.then(async (): Promise<string> => {
      const p = outboundVideoProducer.value
      if (!p || p.closed) {
        throw new Error('Outbound video producer is not ready')
      }
      if (import.meta.env.DEV) {
        console.log('[produce] replaceOutboundVideoTrack', { producerId: p.id, trackId: track.id })
      }
      await p.replaceTrack({ track })
      if (import.meta.env.DEV) {
        console.log('[produce] replaceTrack applied', p.id)
      }
      return p.id
    })
    outboundVideoReplaceChain = job.catch(() => {
      /* never stall the queue */
    })
    return job
  }

  async function replaceOutboundAudioTrack(track: MediaStreamTrack): Promise<void> {
    const p = outboundAudioProducer.value
    if (!p || p.closed) {
      throw new Error('Outbound audio producer is not ready')
    }
    await p.replaceTrack({ track })
  }

  function closeSendTransport(): void {
    outboundVideoReplaceChain = Promise.resolve()
    outboundVideoProducer.value = null
    outboundAudioProducer.value = null
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
    replaceOutboundVideoTrack,
    replaceOutboundAudioTrack,
    closeSendTransport,
  }
}
