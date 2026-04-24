import type { Device } from 'mediasoup-client'
import type {
  Consumer,
  ConnectionState,
  DtlsParameters,
  RtpParameters,
  Transport,
  TransportOptions,
} from 'mediasoup-client/types'
import { computed, onUnmounted, shallowRef } from 'vue'
import type { SendTransportRoomApi } from '../transport/useSendTransport'
import type { RemoteProducerInfo } from '../signaling/useRoomConnection'
import { waitForSignalingMessage } from '../signaling/signalingWait'
import { parseProducerSyncPayload } from '../signaling/producerSyncPayload'
import { mergeProducerLists } from './mergeProducerLists'
import {
  buildRequestProducerSyncPayload,
  createRecoveryCoordinator,
  producerSyncParsedToRecoveryEvent,
} from './recoveryCoordinator'
import { createRecvApplySerialQueue } from './recvApplySerialQueue'
import { createConsumeLifecycleManager } from './consumeLifecycleManager'
import type { NetworkQualityClass } from './webrtcLinkStats'
import {
  assignAdaptivePreferredLayersByPeerId,
  type SimulcastPreferredLayers,
} from './adaptiveVideoPreferredLayers'
import {
  applyReceiveQualityPressureToLayers,
  evaluateInboundVideoStatsForPressure,
  RECEIVE_PRESSURE_GOOD_STREAK_UP,
  RECEIVE_PRESSURE_POLL_MS,
  RECEIVE_PRESSURE_UPGRADE_COOLDOWN_MS,
  type ReceiveQualityPressure,
  type VideoInboundStatsRow,
} from './receiveVideoQualityPressure'
/** Downgrade / upgrade steps use the same streak count for minimal tuning surface. */
const RECEIVE_PRESSURE_STREAK_TO_SHIFT = 3

export type { RemoteProducerInfo }

const TIMEOUT_MS = 45_000

/** Coalesce rapid visibility / speaker / pin updates (producer-sync storms). */
const PREFERRED_LAYERS_DEBOUNCE_MS = 80

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

function isConsumeFailedForProducer(
  data: unknown,
  producerId: string,
): data is { type: 'consume-failed'; payload: { producerId: string; reason: string } } {
  if (!data || typeof data !== 'object') {
    return false
  }
  const msg = data as { type?: string; payload?: unknown }
  if (msg.type !== 'consume-failed' || !msg.payload || typeof msg.payload !== 'object') {
    return false
  }
  const p = msg.payload as { producerId?: string; reason?: string }
  return typeof p.producerId === 'string' && p.producerId === producerId && typeof p.reason === 'string'
}

function isProducerVideoSourceChanged(
  data: unknown,
): data is {
  type: 'producer-video-source-changed'
  payload: { producerId: string; peerId: string; source: 'camera' | 'screen' }
} {
  if (!data || typeof data !== 'object') {
    return false
  }
  const msg = data as { type?: string; payload?: unknown }
  if (msg.type !== 'producer-video-source-changed' || !msg.payload || typeof msg.payload !== 'object') {
    return false
  }
  const p = msg.payload as { producerId?: unknown; peerId?: unknown; source?: unknown }
  return (
    typeof p.producerId === 'string' &&
    typeof p.peerId === 'string' &&
    (p.source === 'camera' || p.source === 'screen')
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

export type SetupReceivePathOptions = {
  /**
   * When true, send `set-consumer-preferred-layers` for remote video (required if publishers use simulcast).
   * Must match `publishLocalMedia(..., { videoSimulcast })` policy for this session.
   */
  enableVideoSpatialLayerSignaling?: boolean
}

export type InboundVideoDebugRow = {
  peerId: string
  producerId: string
  frameWidth?: number
  frameHeight?: number
  framesPerSecond?: number
  framesDecoded?: number
  framesDropped?: number
  packetsLost?: number
  jitter?: number
}

/** DEV: track capture hints + inbound-rtp frame counters when the browser exposes them. */
async function logInboundVideoDebug(consumer: Consumer, peerId: string): Promise<void> {
  if (!import.meta.env.DEV) {
    return
  }
  const track = consumer.track
  const settings =
    typeof track.getSettings === 'function'
      ? (track.getSettings() as { width?: number; height?: number; frameRate?: number })
      : {}
  console.log('[video-debug] track settings', {
    peerId,
    producerId: consumer.producerId,
    width: settings.width,
    height: settings.height,
    frameRate: settings.frameRate,
  })

  try {
    const report = await consumer.getStats()
    report.forEach((r) => {
      if (r.type !== 'inbound-rtp') {
        return
      }
      const v = r as RTCInboundRtpStreamStats
      if (v.kind !== 'video') {
        return
      }
      console.log('[video-debug] inbound-rtp', {
        peerId,
        framesDecoded: v.framesDecoded,
        framesDropped: v.framesDropped,
        framesReceived: v.framesReceived,
        frameWidth: v.frameWidth,
        frameHeight: v.frameHeight,
      })
    })
  } catch {
    /* stats optional */
  }
}

export function useRemoteMedia() {
  const recvTransport = shallowRef<Transport | null>(null)
  /** Stable MediaStream per remote peer (mutate with addTrack / removeTrack only). */
  const streamsByPeerId = new Map<string, MediaStream>()
  /** shallowRef(Map) clone-on-write — reliable Vue updates vs reactive(Map). */
  const remotePeerStreamsMap = shallowRef(new Map<string, MediaStream>())
  const remotePeerStreams = computed<RemotePeerStream[]>(() => {
    const m = remotePeerStreamsMap.value
    return Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([peerId, stream]) => ({ peerId, stream }))
  })
  /**
   * Per-remote-peer counter: bump only when that peer's stream changes (not global).
   * Single rev per peer (no separate refresh tick).
   */
  const remotePeerPlayRevs = shallowRef(new Map<string, number>())
  const consumeLifecycle = createConsumeLifecycleManager()
  const recvRecovery = createRecoveryCoordinator()
  const recvApplyQueue = createRecvApplySerialQueue()
  const consumersByProducerId = new Map<string, Consumer>()
  const producerInfoById = new Map<string, RemoteProducerInfo>()
  const peerVisibility = shallowRef(new Map<string, boolean>())
  const peerPriority = shallowRef(new Map<string, number>())
  const pinnedPeerId = shallowRef<string | null>(null)
  const activeSpeakerPeerId = shallowRef<string | null>(null)
  /** Last preferred layers sent per recv video consumer (skip duplicate signaling). */
  const lastSentPreferredLayersByConsumerId = new Map<string, SimulcastPreferredLayers>()
  /** Local receive-only: lowers remote *video* preferred layers when inbound stats look unhealthy. */
  const receiveQualityPressure = shallowRef<ReceiveQualityPressure>('normal')
  let receivePressurePollTimer: ReturnType<typeof setInterval> | null = null
  let receivePressureBadStreak = 0
  let receivePressureGoodStreak = 0
  let receivePressureLastPacketsLostSum: number | null = null
  let receivePressureLastDowngradeAt = 0
  let signalingRoom: SendTransportRoomApi | null = null
  let preferredLayersDebounceTimer: ReturnType<typeof setTimeout> | null = null
  /** Set per `setupReceivePath` — avoids spatial-layer WS traffic when everyone publishes single-layer. */
  const videoSpatialLayerSignalingEnabled = shallowRef(false)
  let unsubscribeNewProducer: (() => void) | null = null
  let unsubscribeProducerSync: (() => void) | null = null
  let unsubscribeProducerVideoSource: (() => void) | null = null
  let unsubscribePeerOutboundPaused: (() => void) | null = null

  /**
   * Remote outbound video semantic for layout (camera vs screen).
   * Keyed by `peerId` — correct while each peer has at most one video producer (`replaceTrack`).
   * For multi-stream (camera + screen producers), switch to `Map<producerId, source>` and derive UI per producer.
   */
  const remoteVideoSourceByPeerId = shallowRef(new Map<string, 'camera' | 'screen'>())

  /**
   * SFU paused outbound camera (`set-outbound-video-paused`); avoids frozen last frame when track stays "live".
   * Set/cleared from producer lists and `peer-outbound-video-paused` signaling.
   */
  const remoteOutboundVideoPausedByPeerId = shallowRef(new Map<string, true>())

  function applyPeerVideoSource(peerId: string, source: 'camera' | 'screen'): void {
    const next = new Map(remoteVideoSourceByPeerId.value)
    next.set(peerId, source)
    remoteVideoSourceByPeerId.value = next
  }

  function syncPeerVideoMetadataFromInfo(info: RemoteProducerInfo): void {
    if (info.kind !== 'video') {
      return
    }
    applyPeerVideoSource(info.peerId, info.videoSource ?? 'camera')
    const next = new Map(remoteOutboundVideoPausedByPeerId.value)
    if (info.outboundVideoPaused === true) {
      next.set(info.peerId, true)
    } else if (info.outboundVideoPaused === false) {
      next.delete(info.peerId)
    }
    remoteOutboundVideoPausedByPeerId.value = next
  }

  /**
   * Reserved for future UI; transport BWE polling is disabled (quality-first baseline).
   * Layer choice uses pin / speaker / visibility only — no dynamic bandwidth cap.
   */
  const networkQualityFromStats = shallowRef<NetworkQualityClass>('good')
  const networkQualityOverride = shallowRef<'auto' | NetworkQualityClass>('auto')

  const networkQuality = computed<NetworkQualityClass>(() =>
    networkQualityOverride.value === 'auto' ? networkQualityFromStats.value : networkQualityOverride.value,
  )

  function setNetworkQualityOverride(level: 'auto' | NetworkQualityClass): void {
    networkQualityOverride.value = level
  }

  function onRecvConnectionStateChange(state: ConnectionState): void {
    if (state === 'failed' || state === 'closed') {
      if (import.meta.env.DEV) {
        console.log('[recvTransport] connection ended', state)
      }
    }
  }

  /** One entry per `peerId` with at least one remote **video** producer (camera and/or screen). */
  function getVideoPeerIds(): string[] {
    const ids = new Set<string>()
    for (const info of producerInfoById.values()) {
      if (info.kind === 'video') {
        ids.add(info.peerId)
      }
    }
    return [...ids].sort((a, b) => a.localeCompare(b))
  }

  function layerTierForDev(l: SimulcastPreferredLayers): 'high' | 'medium' | 'low' {
    if (l.spatialLayer === 2) {
      return 'high'
    }
    if (l.spatialLayer === 1) {
      return 'medium'
    }
    return 'low'
  }

  function stopReceivePressureMonitor(): void {
    if (receivePressurePollTimer !== null) {
      clearInterval(receivePressurePollTimer)
      receivePressurePollTimer = null
    }
    receivePressureBadStreak = 0
    receivePressureGoodStreak = 0
    receivePressureLastPacketsLostSum = null
    receiveQualityPressure.value = 'normal'
  }

  function startReceivePressureMonitor(): void {
    stopReceivePressureMonitor()
    if (!videoSpatialLayerSignalingEnabled.value) {
      return
    }
    receivePressurePollTimer = setInterval(() => {
      void tickReceiveQualityPressure()
    }, RECEIVE_PRESSURE_POLL_MS)
  }

  async function tickReceiveQualityPressure(): Promise<void> {
    if (!videoSpatialLayerSignalingEnabled.value || signalingRoom === null) {
      return
    }
    const rows = await collectInboundVideoDebugStats()
    const slim: VideoInboundStatsRow[] = rows.map((r) => ({
      framesDecoded: r.framesDecoded,
      framesDropped: r.framesDropped,
      framesPerSecond: r.framesPerSecond,
      packetsLost: r.packetsLost,
      jitter: r.jitter,
    }))
    const ev = evaluateInboundVideoStatsForPressure(slim, receivePressureLastPacketsLostSum)
    receivePressureLastPacketsLostSum = ev.packetsLostSum

    if (ev.verdict === 'unknown') {
      return
    }

    const before = receiveQualityPressure.value
    if (ev.verdict === 'bad') {
      receivePressureGoodStreak = 0
      receivePressureBadStreak += 1
      if (before === 'normal' && receivePressureBadStreak >= RECEIVE_PRESSURE_STREAK_TO_SHIFT) {
        receiveQualityPressure.value = 'constrained'
        receivePressureLastDowngradeAt = Date.now()
        receivePressureBadStreak = 0
        if (import.meta.env.DEV) {
          console.log('[recv-pressure] downgraded to constrained', {
            badStreak: RECEIVE_PRESSURE_STREAK_TO_SHIFT,
            debug: ev.debug,
          })
        }
        schedulePreferredLayersUpdate()
      } else if (before === 'constrained' && receivePressureBadStreak >= RECEIVE_PRESSURE_STREAK_TO_SHIFT) {
        receiveQualityPressure.value = 'critical'
        receivePressureLastDowngradeAt = Date.now()
        receivePressureBadStreak = 0
        if (import.meta.env.DEV) {
          console.log('[recv-pressure] downgraded to critical', {
            badStreak: RECEIVE_PRESSURE_STREAK_TO_SHIFT,
            debug: ev.debug,
          })
        }
        schedulePreferredLayersUpdate()
      }
    } else {
      receivePressureBadStreak = 0
      receivePressureGoodStreak += 1
      if (Date.now() - receivePressureLastDowngradeAt < RECEIVE_PRESSURE_UPGRADE_COOLDOWN_MS) {
        return
      }
      if (receivePressureGoodStreak < RECEIVE_PRESSURE_GOOD_STREAK_UP) {
        return
      }
      if (before === 'critical') {
        receiveQualityPressure.value = 'constrained'
        receivePressureGoodStreak = 0
        if (import.meta.env.DEV) {
          console.log('[recv-pressure] upgraded to constrained', {
            goodStreak: RECEIVE_PRESSURE_GOOD_STREAK_UP,
            debug: ev.debug,
          })
        }
        schedulePreferredLayersUpdate()
      } else if (before === 'constrained') {
        receiveQualityPressure.value = 'normal'
        receivePressureGoodStreak = 0
        if (import.meta.env.DEV) {
          console.log('[recv-pressure] upgraded to normal', {
            goodStreak: RECEIVE_PRESSURE_GOOD_STREAK_UP,
            debug: ev.debug,
          })
        }
        schedulePreferredLayersUpdate()
      } else {
        receivePressureGoodStreak = 0
      }
    }
  }

  function flushPreferredLayersToServer(): void {
    const room = signalingRoom
    if (!room) return
    if (!videoSpatialLayerSignalingEnabled.value) {
      if (import.meta.env.DEV) {
        console.log('[call-qa:layers] flushPreferredLayersToServer skipped (spatial layer signaling off)')
      }
      return
    }

    const baseByPeer = assignAdaptivePreferredLayersByPeerId({
      videoPeerIds: getVideoPeerIds(),
      activeSpeakerPeerId: activeSpeakerPeerId.value,
      pinnedPeerId: pinnedPeerId.value,
      peerVisibility: peerVisibility.value,
    })
    const byPeer = applyReceiveQualityPressureToLayers(baseByPeer, receiveQualityPressure.value, {
      activeSpeakerPeerId: activeSpeakerPeerId.value,
      pinnedPeerId: pinnedPeerId.value,
      peerVisibility: peerVisibility.value,
    })

    const devRows: {
      consumerId: string
      peerId: string
      spatialLayer: 0 | 1 | 2
      temporalLayer: 0 | 1 | 2
      tier: 'high' | 'medium' | 'low'
      lastSent: SimulcastPreferredLayers | undefined
      willSend: boolean
    }[] = []

    for (const [producerId, consumer] of consumersByProducerId.entries()) {
      if (consumer.closed || consumer.kind !== 'video') continue
      const info = producerInfoById.get(producerId)
      if (!info) continue

      const { spatialLayer, temporalLayer } = byPeer.get(info.peerId) ?? { spatialLayer: 0, temporalLayer: 0 }
      const next: SimulcastPreferredLayers = { spatialLayer, temporalLayer }
      const prev = lastSentPreferredLayersByConsumerId.get(consumer.id)
      const willSend =
        !prev || prev.spatialLayer !== next.spatialLayer || prev.temporalLayer !== next.temporalLayer
      if (import.meta.env.DEV) {
        devRows.push({
          consumerId: consumer.id,
          peerId: info.peerId,
          spatialLayer,
          temporalLayer,
          tier: layerTierForDev(next),
          lastSent: prev,
          willSend,
        })
      }
      if (!willSend) {
        continue
      }

      try {
        room.sendJson({
          type: 'set-consumer-preferred-layers',
          payload: { consumerId: consumer.id, spatialLayer, temporalLayer },
        })
        lastSentPreferredLayersByConsumerId.set(consumer.id, { spatialLayer, temporalLayer })
      } catch (e) {
        lastSentPreferredLayersByConsumerId.delete(consumer.id)
        console.error('[layers] send failed', { consumerId: consumer.id, producerId }, e)
      }
    }

    if (import.meta.env.DEV) {
      console.log('[call-qa:layers] flushPreferredLayersToServer', {
        receiveQualityPressure: receiveQualityPressure.value,
        consumers: devRows,
      })
    }
  }

  function schedulePreferredLayersUpdate(): void {
    if (!signalingRoom) return
    if (preferredLayersDebounceTimer) {
      clearTimeout(preferredLayersDebounceTimer)
    }
    preferredLayersDebounceTimer = setTimeout(() => {
      preferredLayersDebounceTimer = null
      flushPreferredLayersToServer()
    }, PREFERRED_LAYERS_DEBOUNCE_MS)
  }

  function bumpRemotePeerPlayRev(peerId: string): void {
    const pr = new Map(remotePeerPlayRevs.value)
    pr.set(peerId, (pr.get(peerId) ?? 0) + 1)
    remotePeerPlayRevs.value = pr
  }

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
    const next = new Map(remotePeerStreamsMap.value)
    const nextIds = new Set(streamsByPeerId.keys())
    for (const id of [...next.keys()]) {
      if (!nextIds.has(id)) {
        next.delete(id)
      }
    }
    for (const [id, stream] of streamsByPeerId) {
      if (next.get(id) !== stream) {
        next.set(id, stream)
      }
    }
    remotePeerStreamsMap.value = next
  }

  function wireRemoteTrack(stream: MediaStream, peerId: string, track: MediaStreamTrack): void {
    track.onended = () => {
      stream.removeTrack(track)
      syncRemotePeerStreamsRef()
      bumpRemotePeerPlayRev(peerId)
      if (import.meta.env.DEV) {
        console.log('[track] ended', track.id, { peerId })
      }
    }
    /** `track.muted` is not a Vue reactive source — tiles must re-run readiness when RTP starts (unmute). */
    track.addEventListener('unmute', () => {
      if (import.meta.env.DEV) {
        console.log('[track] unmuted', track.id, { peerId, kind: track.kind })
      }
      bumpRemotePeerPlayRev(peerId)
    })
    track.addEventListener('mute', () => {
      if (import.meta.env.DEV) {
        console.log('[track] muted', track.id, { peerId, kind: track.kind })
      }
      bumpRemotePeerPlayRev(peerId)
    })
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
    bumpRemotePeerPlayRev(peerId)
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
      onRecvConnectionStateChange(state)
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
        })
        .catch((err) => fail(err instanceof Error ? err : new Error(String(err))))
    })

    recvTransport.value = transport
    if (transport.connectionState === 'connected') {
      onRecvConnectionStateChange('connected')
    }
    return transport
  }

  /**
   * Recv consume: signaling + `transport.consume`. Dedupe / async boundary / rollback: see `consumeLifecycle.ts`.
   */
  async function runConsumeProducer(
    device: Device,
    room: SendTransportRoomApi,
    info: RemoteProducerInfo,
  ): Promise<void> {
    const { producerId, peerId, kind } = info
    if (consumeLifecycle.isAlreadyConsumed(producerId)) {
      return
    }
    if (!device.loaded) {
      throw new Error('Device not loaded')
    }

    const transport = await ensureRecvTransport(device, room)
    if (!consumeLifecycle.tryReserveAfterTransport(producerId)) {
      return
    }

    try {
      producerInfoById.set(producerId, info)
      if (import.meta.env.DEV) {
        console.log('[consume] request', { producerId, peerId, kind })
      }
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
        (d) => isConsumedForProducer(d, producerId) || isConsumeFailedForProducer(d, producerId),
        TIMEOUT_MS,
      )

      if (msg.type === 'consume-failed') {
        throw new Error(`consume-failed: ${msg.payload.reason}`)
      }

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

      // Audio must never be paused; video quality follows simulcast spatial layers (no consumer.pause).
      await consumer.resume()

      if (import.meta.env.DEV) {
        console.log('[consumer] after resume', {
          paused: consumer.paused,
          trackMuted: consumer.track.muted,
        })
        console.log('[consumer] recreated', { producerId, peerId, kind: consumer.kind })
      }

      consumersByProducerId.set(producerId, consumer)
      upsertRemoteTrack(peerId, consumer.track)
      if (consumer.kind === 'video') {
        syncPeerVideoMetadataFromInfo(info)
        void logInboundVideoDebug(consumer, peerId)
        // Apply target spatial layer immediately — default consumer layer can sit on low simulcast until debounce fires.
        flushPreferredLayersToServer()
        schedulePreferredLayersUpdate()
      }
    } catch (err) {
      consumeLifecycle.releaseReservation(producerId)
      throw err
    }
  }

  /** Outer entry: inflight coalescing + `runConsumeProducer`. See `consumeLifecycle.ts`. */
  async function consumeProducer(
    device: Device,
    room: SendTransportRoomApi,
    info: RemoteProducerInfo,
  ): Promise<void> {
    const { producerId } = info
    if (consumeLifecycle.isAlreadyConsumed(producerId)) {
      return
    }

    const existing = consumeLifecycle.getInflightTask(producerId)
    if (existing) {
      await existing
      return
    }

    const task = (async (): Promise<void> => {
      if (consumeLifecycle.isAlreadyConsumed(producerId)) {
        return
      }
      consumeLifecycle.markConsuming(producerId)
      try {
        if (import.meta.env.DEV) {
          console.log('[consume] CONSUMING PRODUCER', producerId, info.peerId, info.kind)
        }
        await runConsumeProducer(device, room, info)
      } catch (e) {
        consumeLifecycle.releaseReservation(producerId)
        throw e
      } finally {
        consumeLifecycle.unmarkConsuming(producerId)
      }
    })()

    consumeLifecycle.registerInflightTask(producerId, task)
    try {
      await task
    } finally {
      consumeLifecycle.unregisterInflightTask(producerId)
    }
  }

  function startNewProducerListener(device: Device, room: SendTransportRoomApi): void {
    unsubscribeNewProducer?.()
    unsubscribeNewProducer = room.addMessageListener((data) => {
      if (!isNewProducer(data)) {
        return
      }
      const info: RemoteProducerInfo = {
        producerId: data.payload.producerId,
        peerId: data.payload.peerId,
        kind: data.payload.kind,
      }
      if (info.kind === 'video') {
        const vs = (data.payload as { videoSource?: unknown }).videoSource
        if (vs === 'camera' || vs === 'screen') {
          info.videoSource = vs
        }
      }
      const d = recvRecovery.onEvent({ type: 'new-producer', producer: info })
      void recvApplyQueue
        .enqueue(async () => {
          if (d.shouldReset) {
            teardownAllRemoteConsumers()
            recvRecovery.markResetDone()
          }
          await syncExistingProducersImpl(device, room, d.producersToApply)
          recvRecovery.markSyncApplied(d.producersToApply.map((p) => p.producerId))
        })
        .catch((e) => {
          console.error('consume after new-producer failed', e)
        })
    })
  }

  /** Drop all recv-side consumers and remote composite streams (recv transport stays). */
  function teardownAllRemoteConsumers(): void {
    for (const consumer of consumersByProducerId.values()) {
      if (!consumer.closed) {
        lastSentPreferredLayersByConsumerId.delete(consumer.id)
        consumer.close()
      }
    }
    consumersByProducerId.clear()
    producerInfoById.clear()
    consumeLifecycle.resetAllLifecycle()
    remoteVideoSourceByPeerId.value = new Map()
    remoteOutboundVideoPausedByPeerId.value = new Map()
    const peerIdsToBump = new Set(streamsByPeerId.keys())
    for (const stream of streamsByPeerId.values()) {
      for (const t of [...stream.getTracks()]) {
        stream.removeTrack(t)
        t.stop()
      }
    }
    syncRemotePeerStreamsRef()
    for (const peerId of peerIdsToBump) {
      bumpRemotePeerPlayRev(peerId)
    }
    if (import.meta.env.DEV) {
      console.log('[resync] tore down remote recv consumers')
    }
  }

  /**
   * Tab visible / focus: **soft** producer list only (`resetConsumers: false` → no teardown).
   * Hard teardown + re-consume was killing RTP before `track.muted` cleared → black tiles + flicker.
   */
  function requestForcedProducerResync(): void {
    const room = signalingRoom
    if (!room) {
      return
    }
    try {
      if (import.meta.env.DEV) {
        console.log('[resync] soft producer list (no teardown)')
      }
      room.sendJson({ type: 'request-producer-sync', payload: buildRequestProducerSyncPayload('soft') })
    } catch (e) {
      console.warn('[resync] request-producer-sync failed', e)
    }
  }

  /** Explicit recovery: full recv teardown then `client-refresh` sync (use sparingly). */
  function requestHardProducerResync(): void {
    const room = signalingRoom
    if (!room) {
      return
    }
    try {
      if (import.meta.env.DEV) {
        console.log('[resync] hard producer sync (teardown)')
      }
      room.sendJson({ type: 'request-producer-sync', payload: buildRequestProducerSyncPayload('hard') })
    } catch (e) {
      console.warn('[resync] hard request-producer-sync failed', e)
    }
  }

  async function syncExistingProducersImpl(
    device: Device,
    room: SendTransportRoomApi,
    list: RemoteProducerInfo[],
  ): Promise<void> {
    if (import.meta.env.DEV) {
      console.log('[syncExistingProducers]', { count: list.length })
    }
    for (const item of list) {
      producerInfoById.set(item.producerId, item)
      syncPeerVideoMetadataFromInfo(item)
    }
    for (const item of list) {
      try {
        await consumeProducer(device, room, item)
      } catch (e) {
        console.error('[syncExistingProducers] consume failed', item, e)
      }
    }
    schedulePreferredLayersUpdate()
  }

  /** Public entry — goes through the recv apply queue so it never overlaps listener-driven applies. */
  function syncExistingProducers(
    device: Device,
    room: SendTransportRoomApi,
    list: RemoteProducerInfo[],
  ): Promise<void> {
    return recvApplyQueue.enqueue(() => syncExistingProducersImpl(device, room, list))
  }

  async function setupReceivePath(
    device: Device,
    room: SendTransportRoomApi,
    existing: RemoteProducerInfo[],
    pathOptions?: SetupReceivePathOptions,
  ): Promise<void> {
    videoSpatialLayerSignalingEnabled.value = pathOptions?.enableVideoSpatialLayerSignaling === true
    signalingRoom = room
    await ensureRecvTransport(device, room)

    const missed = room.drainPendingNewProducers?.() ?? []
    const merged = mergeProducerLists(existing, missed)
    if (import.meta.env.DEV) {
      console.log('[setupReceivePath]', {
        fromRoomState: existing.length,
        missedNewProducers: missed.length,
        merged: merged.length,
      })
      console.log(
        '[setupReceivePath] final producers',
        merged.map((p) => ({
          producerId: p.producerId,
          peerId: p.peerId,
          kind: p.kind,
        })),
      )
    }

    /** Initial room-state + missed new-producer apply runs first in the queue (before WS listeners). */
    const initialApplyDone = recvApplyQueue.enqueue(async () => {
      await syncExistingProducersImpl(device, room, merged)
      recvRecovery.markSyncApplied(merged.map((p) => p.producerId))
    })

    startNewProducerListener(device, room)
    unsubscribeProducerVideoSource?.()
    unsubscribeProducerVideoSource = room.addMessageListener((data) => {
      if (!isProducerVideoSourceChanged(data)) {
        return
      }
      const { peerId, producerId, source } = data.payload
      applyPeerVideoSource(peerId, source)
      const info = producerInfoById.get(producerId)
      if (info?.kind === 'video') {
        producerInfoById.set(producerId, { ...info, videoSource: source })
      }
      bumpRemotePeerPlayRev(peerId)
    })
    unsubscribePeerOutboundPaused?.()
    unsubscribePeerOutboundPaused = room.addMessageListener((data) => {
      if (!data || typeof data !== 'object') {
        return
      }
      const m = data as { type?: string; payload?: unknown }
      if (m.type !== 'peer-outbound-video-paused') {
        return
      }
      const p = m.payload
      if (!p || typeof p !== 'object') {
        return
      }
      const { peerId, paused } = p as { peerId?: unknown; paused?: unknown }
      if (typeof peerId !== 'string' || typeof paused !== 'boolean') {
        return
      }
      const next = new Map(remoteOutboundVideoPausedByPeerId.value)
      if (paused) {
        next.set(peerId, true)
      } else {
        next.delete(peerId)
      }
      remoteOutboundVideoPausedByPeerId.value = next
    })
    unsubscribeProducerSync?.()
    unsubscribeProducerSync = room.addMessageListener((data) => {
      const parsed = parseProducerSyncPayload(data)
      if (!parsed) {
        return
      }
      const d = recvRecovery.onEvent(producerSyncParsedToRecoveryEvent(parsed))
      if (import.meta.env.DEV) {
        console.log('[producer-sync]', {
          count: d.producersToApply.length,
          kinds: d.producersToApply.map((p) => p.kind),
          forceResync: d.shouldReset,
        })
      }
      void recvApplyQueue
        .enqueue(async () => {
          if (d.shouldReset) {
            teardownAllRemoteConsumers()
            recvRecovery.markResetDone()
          }
          await syncExistingProducersImpl(device, room, d.producersToApply)
          recvRecovery.markSyncApplied(d.producersToApply.map((p) => p.producerId))
        })
        .catch((e) => {
          console.error('[producer-sync] consume failed', e)
        })
    })

    await initialApplyDone
    schedulePreferredLayersUpdate()
    startReceivePressureMonitor()
  }

  function setPeerVisible(peerId: string, visible: boolean): void {
    if (import.meta.env.DEV) {
      console.log('[call-qa:peer-visibility] setPeerVisible', { peerId, visible })
    }
    const next = new Map(peerVisibility.value)
    next.set(peerId, visible)
    peerVisibility.value = next
    schedulePreferredLayersUpdate()
  }

  function setPeerConsumePriority(peerId: string, priority: number): void {
    const next = new Map(peerPriority.value)
    next.set(peerId, Number.isFinite(priority) ? priority : 0)
    peerPriority.value = next
    schedulePreferredLayersUpdate()
  }

  function setPinnedPeer(peerId: string | null): void {
    pinnedPeerId.value = peerId
    schedulePreferredLayersUpdate()
  }

  function setActiveSpeaker(peerId: string | null): void {
    if (activeSpeakerPeerId.value !== peerId && import.meta.env.DEV) {
      console.log('[speaker] active speaker changed', { peerId })
    }
    activeSpeakerPeerId.value = peerId
    schedulePreferredLayersUpdate()
  }

  /**
   * Tear down all consumers and the composite stream for a peer that left (or stopped publishing).
   * Prevents stale tiles and frozen frames after `peer-left`.
   */
  function removeRemotePeer(peerId: string): void {
    const nextSrc = new Map(remoteVideoSourceByPeerId.value)
    nextSrc.delete(peerId)
    remoteVideoSourceByPeerId.value = nextSrc
    const nextPaused = new Map(remoteOutboundVideoPausedByPeerId.value)
    nextPaused.delete(peerId)
    remoteOutboundVideoPausedByPeerId.value = nextPaused

    const producerIds: string[] = []
    for (const [producerId, info] of producerInfoById.entries()) {
      if (info.peerId === peerId) {
        producerIds.push(producerId)
      }
    }
    for (const producerId of producerIds) {
      const consumer = consumersByProducerId.get(producerId)
      if (consumer && !consumer.closed) {
        lastSentPreferredLayersByConsumerId.delete(consumer.id)
        consumer.close()
      }
      consumersByProducerId.delete(producerId)
      producerInfoById.delete(producerId)
      consumeLifecycle.removeProducerLifecycle(producerId)
    }

    const stream = streamsByPeerId.get(peerId)
    if (stream) {
      for (const t of stream.getTracks()) {
        t.stop()
      }
      streamsByPeerId.delete(peerId)
    }

    if (pinnedPeerId.value === peerId) {
      pinnedPeerId.value = null
    }
    if (activeSpeakerPeerId.value === peerId) {
      activeSpeakerPeerId.value = null
    }

    const vis = new Map(peerVisibility.value)
    vis.delete(peerId)
    peerVisibility.value = vis
    const pri = new Map(peerPriority.value)
    pri.delete(peerId)
    peerPriority.value = pri

    syncRemotePeerStreamsRef()
    bumpRemotePeerPlayRev(peerId)
    schedulePreferredLayersUpdate()
  }

  async function collectInboundVideoDebugStats(): Promise<InboundVideoDebugRow[]> {
    const out: InboundVideoDebugRow[] = []
    for (const [producerId, consumer] of consumersByProducerId.entries()) {
      if (consumer.closed || consumer.kind !== 'video') {
        continue
      }
      const info = producerInfoById.get(producerId)
      const peerId = info?.peerId ?? '?'
      const row: InboundVideoDebugRow = {
        peerId,
        producerId: consumer.producerId,
      }
      try {
        const report = await consumer.getStats()
        report.forEach((r) => {
          if (r.type !== 'inbound-rtp') {
            return
          }
          const v = r as RTCInboundRtpStreamStats & { framesPerSecond?: number }
          if (v.kind !== 'video') {
            return
          }
          row.frameWidth = v.frameWidth
          row.frameHeight = v.frameHeight
          row.framesDecoded = v.framesDecoded
          row.framesDropped = v.framesDropped
          row.packetsLost = v.packetsLost
          row.jitter = v.jitter
          if (typeof v.framesPerSecond === 'number') {
            row.framesPerSecond = v.framesPerSecond
          }
        })
      } catch {
        /* stats optional */
      }
      out.push(row)
    }
    return out
  }

  function stopRemoteMedia(): void {
    stopReceivePressureMonitor()
    videoSpatialLayerSignalingEnabled.value = false
    networkQualityOverride.value = 'auto'
    networkQualityFromStats.value = 'good'
    unsubscribeNewProducer?.()
    unsubscribeNewProducer = null
    unsubscribeProducerSync?.()
    unsubscribeProducerSync = null
    unsubscribeProducerVideoSource?.()
    unsubscribeProducerVideoSource = null
    unsubscribePeerOutboundPaused?.()
    unsubscribePeerOutboundPaused = null
    remoteVideoSourceByPeerId.value = new Map()
    remoteOutboundVideoPausedByPeerId.value = new Map()
    for (const consumer of consumersByProducerId.values()) {
      if (!consumer.closed) {
        consumer.close()
      }
    }
    consumersByProducerId.clear()
    producerInfoById.clear()
    for (const stream of streamsByPeerId.values()) {
      for (const track of stream.getTracks()) {
        track.stop()
      }
    }
    streamsByPeerId.clear()
    remotePeerStreamsMap.value = new Map()
    remotePeerPlayRevs.value = new Map()
    consumeLifecycle.resetAllLifecycle()
    lastSentPreferredLayersByConsumerId.clear()
    if (preferredLayersDebounceTimer) {
      clearTimeout(preferredLayersDebounceTimer)
      preferredLayersDebounceTimer = null
    }
    pinnedPeerId.value = null
    activeSpeakerPeerId.value = null
    signalingRoom = null
    const t = recvTransport.value
    if (t && !t.closed) {
      t.close()
    }
    recvTransport.value = null
    recvApplyQueue.reset()
  }

  onUnmounted(() => {
    stopRemoteMedia()
  })

  return {
    recvTransport,
    remotePeerStreams,
    remotePeerPlayRevs,
    remoteStreams,
    activeSpeakerPeerId,
    networkQuality,
    networkQualityFromStats,
    setNetworkQualityOverride,
    ensureRecvTransport,
    consumeProducer,
    startNewProducerListener,
    syncExistingProducers,
    setupReceivePath,
    setPeerVisible,
    setPeerConsumePriority,
    setPinnedPeer,
    setActiveSpeaker,
    removeRemotePeer,
    stopRemoteMedia,
    collectInboundVideoDebugStats,
    remoteVideoSourceByPeerId,
    remoteOutboundVideoPausedByPeerId,
    requestForcedProducerResync,
    requestHardProducerResync,
    receiveQualityPressure,
  }
}
