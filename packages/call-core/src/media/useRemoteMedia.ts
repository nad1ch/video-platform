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
import { waitForSignalingMessage } from '../signaling/signalingWait'
import type { NetworkQualityClass } from './webrtcLinkStats'

export type RemoteProducerInfo = {
  producerId: string
  peerId: string
  kind: 'audio' | 'video'
}

const TIMEOUT_MS = 45_000

/** Coalesce rapid visibility / speaker / pin updates (producer-sync storms). */
const PREFERRED_LAYERS_DEBOUNCE_MS = 80

/** While at most this many remote video peers exist, always request highest simulcast layer (no mid/low). */
const SMALL_ROOM_MAX_REMOTE_VIDEO_PEERS = 2

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

function parseProducerSyncPayload(data: unknown): RemoteProducerInfo[] | null {
  if (!data || typeof data !== 'object') {
    return null
  }
  const msg = data as { type?: string; payload?: unknown }
  if (msg.type !== 'producer-sync') {
    return null
  }
  const payload = msg.payload
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const raw = (payload as { producers?: unknown }).producers
  if (!Array.isArray(raw)) {
    return null
  }
  const list: RemoteProducerInfo[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') {
      continue
    }
    const r = row as { producerId?: unknown; peerId?: unknown; kind?: unknown }
    if (
      typeof r.producerId === 'string' &&
      typeof r.peerId === 'string' &&
      (r.kind === 'audio' || r.kind === 'video')
    ) {
      list.push({ producerId: r.producerId, peerId: r.peerId, kind: r.kind })
    }
  }
  return list.length > 0 ? list : null
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
  const consumedProducerIds = new Set<string>()
  /** In-flight consume per producerId (sync vs new-producer overlap). */
  const consumingProducerIds = new Set<string>()
  const consumersByProducerId = new Map<string, Consumer>()
  const producerInfoById = new Map<string, RemoteProducerInfo>()
  const peerVisibility = shallowRef(new Map<string, boolean>())
  const peerPriority = shallowRef(new Map<string, number>())
  const pinnedPeerId = shallowRef<string | null>(null)
  const activeSpeakerPeerId = shallowRef<string | null>(null)
  /** Last spatialLayer sent over signaling per recv consumer id (skip duplicates). */
  const lastSentSpatialByConsumerId = new Map<string, 0 | 1 | 2>()
  let signalingRoom: SendTransportRoomApi | null = null
  let preferredLayersDebounceTimer: ReturnType<typeof setTimeout> | null = null
  let unsubscribeNewProducer: (() => void) | null = null
  let unsubscribeProducerSync: (() => void) | null = null

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

  function remoteVideoPeerCount(): number {
    const ids = new Set<string>()
    for (const info of producerInfoById.values()) {
      if (info.kind === 'video') {
        ids.add(info.peerId)
      }
    }
    return ids.size
  }

  /**
   * Simulcast spatial only (never temporalLayer on the wire).
   * Small room (≤2 remote video peers): always high (2) — avoids 1:1 feeling “laggy” from mid layer.
   * Larger rooms: pinned & active speaker → 2, off-screen → 0, else → 1.
   */
  function spatialLayerForPeer(peerId: string): 0 | 1 | 2 {
    if (remoteVideoPeerCount() <= SMALL_ROOM_MAX_REMOTE_VIDEO_PEERS) {
      return 2
    }
    if (pinnedPeerId.value === peerId) {
      return 2
    }
    if (activeSpeakerPeerId.value === peerId) {
      return 2
    }
    const visible = peerVisibility.value.get(peerId) ?? true
    if (!visible) {
      return 0
    }
    return 1
  }

  function flushPreferredLayersToServer(): void {
    const room = signalingRoom
    if (!room) return

    for (const [producerId, consumer] of consumersByProducerId.entries()) {
      if (consumer.closed || consumer.kind !== 'video') continue
      const info = producerInfoById.get(producerId)
      if (!info) continue

      const spatialLayer = spatialLayerForPeer(info.peerId)
      const prevS = lastSentSpatialByConsumerId.get(consumer.id)
      if (prevS === spatialLayer) {
        continue
      }

      try {
        room.sendJson({
          type: 'set-consumer-preferred-layers',
          payload: { consumerId: consumer.id, spatialLayer },
        })
        lastSentSpatialByConsumerId.set(consumer.id, spatialLayer)
        if (import.meta.env.DEV) {
          console.log('[layers] spatial (debug)', {
            consumerId: consumer.id,
            peerId: info.peerId,
            producerId,
            spatialLayer,
          })
        }
      } catch (e) {
        lastSentSpatialByConsumerId.delete(consumer.id)
        console.error('[layers] send failed', { consumerId: consumer.id, producerId }, e)
      }
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

  async function runConsumeProducer(
    device: Device,
    room: SendTransportRoomApi,
    info: RemoteProducerInfo,
  ): Promise<void> {
    const { producerId, peerId, kind } = info
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
      }

      consumersByProducerId.set(producerId, consumer)
      upsertRemoteTrack(peerId, consumer.track)
      if (consumer.kind === 'video') {
        void logInboundVideoDebug(consumer, peerId)
        schedulePreferredLayersUpdate()
      }
    } catch (err) {
      consumedProducerIds.delete(producerId)
      throw err
    }
  }

  async function consumeProducer(
    device: Device,
    room: SendTransportRoomApi,
    info: RemoteProducerInfo,
  ): Promise<void> {
    const { producerId } = info
    if (consumedProducerIds.has(producerId)) {
      return
    }
    if (consumingProducerIds.has(producerId)) {
      return
    }
    consumingProducerIds.add(producerId)
    try {
      await runConsumeProducer(device, room, info)
    } catch (e) {
      consumedProducerIds.delete(producerId)
      throw e
    } finally {
      consumingProducerIds.delete(producerId)
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
      producerInfoById.set(info.producerId, info)

      void consumeProducer(device, room, info).catch((e) => {
        console.error('consume after new-producer failed', e)
      })
    })
  }

  function mergeProducerLists(...lists: RemoteProducerInfo[][]): RemoteProducerInfo[] {
    const map = new Map<string, RemoteProducerInfo>()
    for (const list of lists) {
      for (const item of list) {
        map.set(item.producerId, item)
      }
    }
    return [...map.values()]
  }

  async function syncExistingProducers(
    device: Device,
    room: SendTransportRoomApi,
    list: RemoteProducerInfo[],
  ): Promise<void> {
    if (import.meta.env.DEV) {
      console.log('[syncExistingProducers]', { count: list.length })
    }
    for (const item of list) {
      producerInfoById.set(item.producerId, item)
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

  async function setupReceivePath(
    device: Device,
    room: SendTransportRoomApi,
    existing: RemoteProducerInfo[],
  ): Promise<void> {
    signalingRoom = room
    await ensureRecvTransport(device, room)
    startNewProducerListener(device, room)
    unsubscribeProducerSync?.()
    unsubscribeProducerSync = room.addMessageListener((data) => {
      const list = parseProducerSyncPayload(data)
      if (!list) {
        return
      }
      if (import.meta.env.DEV) {
        console.log('[producer-sync]', {
          count: list.length,
          kinds: list.map((p) => p.kind),
        })
      }
      void syncExistingProducers(device, room, list).catch((e) => {
        console.error('[producer-sync] consume failed', e)
      })
    })
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
    await syncExistingProducers(device, room, merged)
    schedulePreferredLayersUpdate()
  }

  function setPeerVisible(peerId: string, visible: boolean): void {
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
    if (activeSpeakerPeerId.value !== peerId) {
      console.log('[speaker] active speaker changed', { peerId })
    }
    activeSpeakerPeerId.value = peerId
    schedulePreferredLayersUpdate()
  }

  function stopRemoteMedia(): void {
    networkQualityOverride.value = 'auto'
    networkQualityFromStats.value = 'good'
    unsubscribeNewProducer?.()
    unsubscribeNewProducer = null
    unsubscribeProducerSync?.()
    unsubscribeProducerSync = null
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
    consumedProducerIds.clear()
    consumingProducerIds.clear()
    lastSentSpatialByConsumerId.clear()
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
    stopRemoteMedia,
  }
}
