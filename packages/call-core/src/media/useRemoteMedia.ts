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
  readNavigatorDeviceProfileInput,
  resolveReceiveDeviceProfile,
  type ReceiveDeviceProfile,
} from './receiveDeviceProfile'
import {
  applyReceiveQualityPressureToLayers,
  evaluateInboundVideoStatsForPressure,
  RECEIVE_PRESSURE_GOOD_STREAK_UP,
  RECEIVE_PRESSURE_POLL_MS,
  RECEIVE_PRESSURE_UPGRADE_COOLDOWN_MS,
  type ReceiveQualityPressure,
  type VideoInboundStatsRow,
} from './receiveVideoQualityPressure'
import {
  resolveReceiverBaselineLayer,
  type ReceiverBaselineLayer,
  type ReceiverRole,
} from './receiverBaselineLayerPolicy'
import {
  ENABLE_RECEIVER_ADAPTIVE_LAYERS,
} from './adaptiveSimulcastFeatureFlags'
import {
  advancePlaybackRenderFpsPressureByPeer,
  type FpsRenderPressure,
} from './videoFpsPressure'
export type { RemoteProducerInfo }

const TIMEOUT_MS = 45_000
const SPEAKER_LINGER_MS = 2500

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

function isProducerClosedNotice(
  data: unknown,
): data is {
  type: 'producer-closed'
  payload: { producerId: string; peerId: string; kind: 'audio' | 'video' }
} {
  if (!data || typeof data !== 'object') {
    return false
  }
  const msg = data as { type?: string; payload?: unknown }
  if (msg.type !== 'producer-closed' || !msg.payload || typeof msg.payload !== 'object') {
    return false
  }
  const p = msg.payload as { producerId?: unknown; peerId?: unknown; kind?: unknown }
  return (
    typeof p.producerId === 'string' &&
    typeof p.peerId === 'string' &&
    (p.kind === 'audio' || p.kind === 'video')
  )
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
   * Back-compat: when omitted, the value is taken from `ENABLE_RECEIVER_ADAPTIVE_LAYERS`
   * (Phase 1 default). Pass an explicit boolean to force on/off (tests, force-low admin
   * override, etc.).
   */
  enableVideoSpatialLayerSignaling?: boolean

  /**
   * Distinguishes participant from viewer (OBS/streamview). Viewers get a
   * higher receiver-baseline floor so a transient pressure spike does not
   * turn a broadcast into 240p footage. See receiverBaselineLayerPolicy.
   */
  role?: ReceiverRole
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


/**
 * Pull the negotiated codec mime-type for a consumer. mediasoup-client surfaces it on
 * `consumer.rtpParameters.codecs[0]` (single-codec consumers, which is our case — we
 * never request multi-codec). DEV-only helper used to verify codec negotiation when
 * the router advertises VP8/H.264/VP9.
 */
function negotiatedCodecMimeType(consumer: Consumer): string | null {
  const c = consumer.rtpParameters?.codecs?.[0]
  return c && typeof c.mimeType === 'string' ? c.mimeType : null
}

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
    codec: negotiatedCodecMimeType(consumer),
    width: settings.width,
    height: settings.height,
    frameRate: settings.frameRate,
  })

  try {
    const report = await consumer.getStats()
    
    
    
    const codecMimeById = new Map<string, string>()
    report.forEach((r) => {
      if (r.type !== 'codec') {
        return
      }
      const c = r as RTCRtpCodec & { id?: string; mimeType?: string }
      if (typeof c.id === 'string' && typeof c.mimeType === 'string') {
        codecMimeById.set(c.id, c.mimeType)
      }
    })
    report.forEach((r) => {
      if (r.type !== 'inbound-rtp') {
        return
      }
      const v = r as RTCInboundRtpStreamStats & { codecId?: string }
      if (v.kind !== 'video') {
        return
      }
      console.log('[video-debug] inbound-rtp', {
        peerId,
        codec:
          (v.codecId && codecMimeById.get(v.codecId)) ?? negotiatedCodecMimeType(consumer),
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
  const receiveDeviceProfile = shallowRef<ReceiveDeviceProfile>(
    resolveReceiveDeviceProfile(readNavigatorDeviceProfileInput()),
  )
  
  const lastPreferredLayerTargetsByPeerId = shallowRef<
    Record<string, { spatialLayer: number; temporalLayer: number }>
  >({})

  const recvTransport = shallowRef<Transport | null>(null)
  // M3: single-flight cache for `ensureRecvTransport`. Parallel `consumeProducer`
  // callers that race past the null/closed check would otherwise each send
  // `create-transport` and orphan all but the last transport server-side.
  // Cleared in `finally` so a failed creation does not get cached, and in
  // `stopRemoteMedia` so a teardown does not leave a stale pending promise.
  let recvTransportPromise: Promise<Transport> | null = null

  const streamsByPeerId = new Map<string, MediaStream>()
  
  const remotePeerStreamsMap = shallowRef(new Map<string, MediaStream>())
  const remotePeerStreams = computed<RemotePeerStream[]>(() => {
    const m = remotePeerStreamsMap.value
    return Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([peerId, stream]) => ({ peerId, stream }))
  })
  



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
  /** App Web Audio dominant remote; merged into layer ranking with SFU {@link activeSpeakerPeerId}. */
  const uiActiveSpeakerPeerIdForPreferredLayers = shallowRef<string | null>(null)
  /** Retained only for compatibility with older layer-selection helpers. */
  const recentSpeakerAtByPeerId = new Map<string, number>()
  /** Last preferred layers sent per recv video consumer (skip duplicate signaling). */
  const lastSentPreferredLayersByConsumerId = new Map<string, SimulcastPreferredLayers>()
  /**
   * Receiver-driven consumer pause: tracks consumer ids we have asked the SFU to
   * pause via `set-consumer-paused`. Only video consumers ever appear here — audio
   * is never paused by us. Used for one-shot transition semantics so we never
   * spam duplicate pause/resume messages on UI hover/scroll.
   */
  const pausedConsumerIds = new Set<string>()
  /**
   * Cached `document.visibilityState === 'hidden'` flag. When the tab is hidden we
   * pause every video consumer regardless of the per-tile visibility map; on
   * visibilitychange we recompute and only send transitions.
   */
  let documentHiddenCached = false
  let documentVisibilityHandler: (() => void) | null = null
  
  const receiveQualityPressure = shallowRef<ReceiveQualityPressure>('normal')
  


  const playbackRenderFpsPressureByPeerId = shallowRef(new Map<string, FpsRenderPressure>())
  const playbackRenderFpsHysteresisByPeer = new Map<
    string,
    { bad: number; good: number; stable: FpsRenderPressure }
  >()
  let receivePressurePollTimer: ReturnType<typeof setInterval> | null = null
  let receivePressureBadStreak = 0
  let receivePressureGoodStreak = 0
  let receivePressureLastPacketsLostSum: number | null = null
  let receivePressureLastDowngradeAt = 0
  let signalingRoom: SendTransportRoomApi | null = null
  let preferredLayersDebounceTimer: ReturnType<typeof setTimeout> | null = null
  let speakerLingerTimer: ReturnType<typeof setTimeout> | null = null
  /**
   * When true, `flushPreferredLayersToServer` actually sends per-consumer
   * `set-consumer-preferred-layers` over WS. Off-by-default and flipped on
   * by `setupReceivePath` based on `ENABLE_RECEIVER_ADAPTIVE_LAYERS` (or an
   * explicit override in `SetupReceivePathOptions`). Toggling this off
   * cleanly reverts to the historical "no preferred layers signaled"
   * behavior.
   */
  const videoSpatialLayerSignalingEnabled = shallowRef(false)
  /** Phase 1 receiver baseline (single layer for all normal webcam consumers). */
  const receiverBaselineLayer = shallowRef<ReceiverBaselineLayer>('high')
  /** `'participant'` for normal users; `'viewer'` for OBS / streamview routes. */
  let receiverRole: ReceiverRole = 'participant'
  let unsubscribeNewProducer: (() => void) | null = null
  let unsubscribeProducerSync: (() => void) | null = null
  let unsubscribeProducerVideoSource: (() => void) | null = null
  let unsubscribePeerOutboundPaused: (() => void) | null = null
  let unsubscribeProducerClosed: (() => void) | null = null

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
   * Reserved for future UI; transport BWE polling is disabled and does not affect video quality.
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

  function clearSpeakerLingerTimer(): void {
    if (speakerLingerTimer !== null) {
      clearTimeout(speakerLingerTimer)
      speakerLingerTimer = null
    }
  }

  function pruneRecentSpeakers(now = Date.now()): void {
    const videoPeerIds = new Set(getVideoPeerIds())
    for (const [peerId, at] of recentSpeakerAtByPeerId) {
      if (!videoPeerIds.has(peerId) || now - at >= SPEAKER_LINGER_MS) {
        recentSpeakerAtByPeerId.delete(peerId)
      }
    }
  }

  function getRecentSpeakerPeerIds(now = Date.now()): string[] {
    pruneRecentSpeakers(now)
    return [...recentSpeakerAtByPeerId.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([peerId]) => peerId)
  }

  function scheduleSpeakerLingerExpiryUpdate(): void {
    clearSpeakerLingerTimer()
    const now = Date.now()
    let nextDelay: number | null = null
    for (const at of recentSpeakerAtByPeerId.values()) {
      const delay = at + SPEAKER_LINGER_MS - now
      if (delay <= 0) {
        nextDelay = 0
        break
      }
      nextDelay = nextDelay === null ? delay : Math.min(nextDelay, delay)
    }
    if (nextDelay === null) {
      return
    }
    speakerLingerTimer = setTimeout(() => {
      speakerLingerTimer = null
      pruneRecentSpeakers()
      schedulePreferredLayersUpdate()
      scheduleSpeakerLingerExpiryUpdate()
    }, Math.max(0, nextDelay + 20))
  }

  function rememberRecentSpeaker(peerId: string | null): void {
    const id = typeof peerId === 'string' ? peerId.trim() : ''
    if (!id) {
      return
    }
    recentSpeakerAtByPeerId.set(id, Date.now())
    scheduleSpeakerLingerExpiryUpdate()
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
    playbackRenderFpsPressureByPeerId.value = new Map()
    playbackRenderFpsHysteresisByPeer.clear()
  }

  function startReceivePressureMonitor(): void {
    stopReceivePressureMonitor()
    receivePressurePollTimer = setInterval(() => {
      void tickReceiveQualityPressure()
    }, RECEIVE_PRESSURE_POLL_MS)
  }

  function updatePlaybackRenderFpsPressureFromInboundRows(rows: InboundVideoDebugRow[]): void {
    const next = advancePlaybackRenderFpsPressureByPeer({
      videoPeerIds: getVideoPeerIds(),
      inboundRows: rows,
      hysteresisByPeer: playbackRenderFpsHysteresisByPeer,
    })
    playbackRenderFpsPressureByPeerId.value = next
  }

  async function tickReceiveQualityPressure(): Promise<void> {
    if (signalingRoom === null) {
      return
    }
    
    
    
    // spatial-layer signaling is currently disabled (single-encoding wire).
    // Spatial-layer downgrade decisions remain gated on
    
    
    const rows = await collectInboundVideoDebugStats()
    // `collectInboundVideoDebugStats` awaits consumer.getStats() — `stopRemoteMedia`
    
    
    // not fire against a closed socket.
    if (signalingRoom === null) {
      return
    }
    updatePlaybackRenderFpsPressureFromInboundRows(rows)

    if (!videoSpatialLayerSignalingEnabled.value) {
      return
    }

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
      const streakShift = receiveDeviceProfile.value.pressureBadStreakToShift
      if (before === 'normal' && receivePressureBadStreak >= streakShift) {
        receiveQualityPressure.value = 'constrained'
        receivePressureLastDowngradeAt = Date.now()
        receivePressureBadStreak = 0
        if (import.meta.env.DEV) {
          console.log('[recv-pressure] downgraded to constrained', {
            badStreak: streakShift,
            debug: ev.debug,
          })
        }
        schedulePreferredLayersUpdate()
      } else if (before === 'constrained' && receivePressureBadStreak >= streakShift) {
        receiveQualityPressure.value = 'critical'
        receivePressureLastDowngradeAt = Date.now()
        receivePressureBadStreak = 0
        if (import.meta.env.DEV) {
          console.log('[recv-pressure] downgraded to critical', {
            badStreak: streakShift,
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

    const prof = receiveDeviceProfile.value
    const videoPeerIds = getVideoPeerIds()

    // Phase 1: receiver picks ONE baseline layer for all normal webcam peers
    // based on (profile, role, room cams, sustained pressure). The baseline
    // shifts only on sustained pressure thanks to hysteresis upstream in
    // `tickReceiveQualityPressure` — no per-tile, no active-speaker churn.
    const baseline = resolveReceiverBaselineLayer({
      profile: prof.profile,
      role: receiverRole,
      activeCameraPublishers: videoPeerIds.length,
      pressure: receiveQualityPressure.value,
    })
    receiverBaselineLayer.value = baseline

    const baseByPeer = assignAdaptivePreferredLayersByPeerId({
      videoPeerIds,
      baselineLayer: baseline,
      screenShareSourceByPeerId: remoteVideoSourceByPeerId.value,
      activeSpeakerPeerId: activeSpeakerPeerId.value,
      uiActiveSpeakerPeerId: uiActiveSpeakerPeerIdForPreferredLayers.value,
      recentSpeakerPeerIds: getRecentSpeakerPeerIds(),
      pinnedPeerId: pinnedPeerId.value,
      peerVisibility: peerVisibility.value,
      layerSlots: {
        maxHighStreams: prof.maxHighStreams,
        maxMediumStreams: prof.maxMediumStreams,
      },
    })
    // Identity for Phase 1 — the baseline already accounts for pressure.
    // Kept in the call chain for forward compat (custom tests / Phase 2).
    const byPeer = applyReceiveQualityPressureToLayers(baseByPeer, receiveQualityPressure.value, {
      activeSpeakerPeerId: activeSpeakerPeerId.value,
      uiActiveSpeakerPeerId: uiActiveSpeakerPeerIdForPreferredLayers.value,
      pinnedPeerId: pinnedPeerId.value,
      peerVisibility: peerVisibility.value,
    })

    const layerRecord: Record<string, { spatialLayer: number; temporalLayer: number }> = {}
    for (const [pid, layers] of byPeer) {
      layerRecord[pid] = { spatialLayer: layers.spatialLayer, temporalLayer: layers.temporalLayer }
    }
    lastPreferredLayerTargetsByPeerId.value = layerRecord

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
        receiveDeviceProfile: prof.profile,
        receiverRole,
        receiverBaselineLayer: baseline,
        roomCamerasFromVideoPeerIds: videoPeerIds.length,
        maxHighStreams: prof.maxHighStreams,
        maxMediumStreams: prof.maxMediumStreams,
        receiveQualityPressure: receiveQualityPressure.value,
        preferredLayersByPeerId: layerRecord,
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

  /**
   * True when the tile for `peerId` should not decode video right now.
   * Combines per-tile visibility map with the document-hidden flag so a hidden
   * tab pauses every remote video at once.
   */
  function isPeerVideoConsumerEffectivelyHidden(peerId: string): boolean {
    if (documentHiddenCached) {
      return true
    }
    const v = peerVisibility.value.get(peerId)
    
    return v === false
  }

  /** Send a single pause/resume transition; idempotent via {@link pausedConsumerIds}. */
  function sendConsumerPauseTransition(consumer: Consumer, paused: boolean): void {
    const room = signalingRoom
    if (!room) {
      return
    }
    if (consumer.closed || consumer.kind !== 'video') {
      return
    }
    const isCurrentlyMarkedPaused = pausedConsumerIds.has(consumer.id)
    if (isCurrentlyMarkedPaused === paused) {
      return
    }
    try {
      room.sendJson({
        type: 'set-consumer-paused',
        payload: { consumerId: consumer.id, paused },
      })
      if (paused) {
        pausedConsumerIds.add(consumer.id)
      } else {
        pausedConsumerIds.delete(consumer.id)
      }
    } catch (err) {
      
      pausedConsumerIds.delete(consumer.id)
      if (import.meta.env.DEV) {
        console.warn('[consumer-pause] send failed', { consumerId: consumer.id, paused, err })
      }
    }
  }

  /**
   * Walk every active video consumer and align its server-side pause state with the
   * effective hidden flag for its peer. Audio consumers are skipped.
   */
  function reconcileConsumerPauseStates(): void {
    if (!signalingRoom) {
      return
    }
    for (const [producerId, consumer] of consumersByProducerId.entries()) {
      if (consumer.closed || consumer.kind !== 'video') {
        continue
      }
      const info = producerInfoById.get(producerId)
      if (!info) continue
      const shouldPause = isPeerVideoConsumerEffectivelyHidden(info.peerId)
      sendConsumerPauseTransition(consumer, shouldPause)
    }
  }

  function attachDocumentVisibilityListener(): void {
    if (typeof document === 'undefined' || documentVisibilityHandler) {
      return
    }
    documentHiddenCached = document.visibilityState === 'hidden'
    documentVisibilityHandler = (): void => {
      const next = document.visibilityState === 'hidden'
      if (next === documentHiddenCached) {
        return
      }
      documentHiddenCached = next
      reconcileConsumerPauseStates()
    }
    document.addEventListener('visibilitychange', documentVisibilityHandler)
  }

  function detachDocumentVisibilityListener(): void {
    if (documentVisibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', documentVisibilityHandler)
    }
    documentVisibilityHandler = null
    documentHiddenCached = false
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
    if (recvTransportPromise) {
      return recvTransportPromise
    }

    const promise = (async (): Promise<Transport> => {
      try {
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
      } finally {
        recvTransportPromise = null
      }
    })()

    recvTransportPromise = promise
    return promise
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

      // Visibility-first pause: if the peer is currently hidden, send the
      // server-side pause request BEFORE the local mediasoup-client resume
      // and BEFORE all the downstream metadata sync. The server creates the
      // consumer paused but auto-resumes immediately after sending `consumed`,
      // so the burst window is roughly 1 RTT — sending pause as early as
      // possible minimizes wasted RTP for hidden tiles in large rooms (8-12+
      // peers, late join, scrolled-out grid).
      if (consumer.kind === 'video' && isPeerVideoConsumerEffectivelyHidden(peerId)) {
        sendConsumerPauseTransition(consumer, true)
      }

      // Audio must never be paused; fixed-quality video does not use consumer.pause.
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
        flushPreferredLayersToServer()
        schedulePreferredLayersUpdate()
        // Re-check visibility after the metadata sync window. If the tile
        // became hidden during the create/resume sequence, the early pause
        // above did not run; this idempotent call covers that case.
        if (isPeerVideoConsumerEffectivelyHidden(peerId)) {
          sendConsumerPauseTransition(consumer, true)
        }
      }
    } catch (err) {
      consumeLifecycle.releaseReservation(producerId)
      throw err
    }
  }

  
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
        pausedConsumerIds.delete(consumer.id)
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
    // Audio-first parallel + video sequential.
    //
    // Audio consumes are independent (no shared per-producer state outside
    // `consumeLifecycleManager`, which already deduplicates), and the recv
    // transport is awaited inside `setupReceivePath` before this runs, so
    // every parallel `ensureRecvTransport` call here hits the cached fast
    // path. Running audio in parallel cuts time-to-first-remote-audio in
    // 12-peer joins from ~3-7s (24 sequential RPC round-trips) to roughly
    // one audio RPC round-trip.
    //
    // Video stays sequential to avoid a burst of `transport.consume` +
    // `setPreferredLayers` calls that would compete with the audio path
    // for the WS send buffer; the existing serial behavior is preserved.
    const audioList: RemoteProducerInfo[] = []
    const videoList: RemoteProducerInfo[] = []
    for (const item of list) {
      if (item.kind === 'audio') {
        audioList.push(item)
      } else {
        videoList.push(item)
      }
    }
    if (audioList.length > 0) {
      const results = await Promise.allSettled(
        audioList.map((item) => consumeProducer(device, room, item)),
      )
      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        if (r && r.status === 'rejected') {
          console.error('[syncExistingProducers] audio consume failed', audioList[i], r.reason)
        }
      }
    }
    for (const item of videoList) {
      try {
        await consumeProducer(device, room, item)
      } catch (e) {
        console.error('[syncExistingProducers] consume failed', item, e)
      }
    }
    schedulePreferredLayersUpdate()
  }

  
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
    // Phase 1: enable preferred-layers signaling when the feature flag is on.
    // Tests and the admin force-low override pass an explicit boolean.
    const enableLayerSignaling =
      typeof pathOptions?.enableVideoSpatialLayerSignaling === 'boolean'
        ? pathOptions.enableVideoSpatialLayerSignaling
        : ENABLE_RECEIVER_ADAPTIVE_LAYERS
    videoSpatialLayerSignalingEnabled.value = enableLayerSignaling
    receiverRole = pathOptions?.role === 'viewer' ? 'viewer' : 'participant'
    receiverBaselineLayer.value = 'high'
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
      const prevSource = remoteVideoSourceByPeerId.value.get(peerId)
      applyPeerVideoSource(peerId, source)
      const info = producerInfoById.get(producerId)
      if (info?.kind === 'video') {
        producerInfoById.set(producerId, { ...info, videoSource: source })
      }
      bumpRemotePeerPlayRev(peerId)
      // Phase 1 screen-share safety: camera ↔ screen transitions flip this
      // peer's layer policy (camera = receiver baseline; screen = pinned
      // high). Schedule a debounced re-flush so the next setPreferredLayers
      // realigns the forwarded spatial layer with the new source. Server
      // already PLIs on source change; this just keeps the rung correct.
      // Skip when the source did not actually change to avoid redundant
      // scheduler work on echoed sync messages.
      if (prevSource !== source) {
        schedulePreferredLayersUpdate()
      }
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
    unsubscribeProducerClosed?.()
    unsubscribeProducerClosed = room.addMessageListener((data) => {
      if (!isProducerClosedNotice(data)) {
        return
      }
      const { producerId, peerId } = data.payload
      // Close the matching consumer (if any) and drop the stale track from the
      // peer's composite stream. Safe when we don't have a consumer yet: the
      // subsequent producer-sync / new-producer flow will not re-create one
      
      const consumer = consumersByProducerId.get(producerId)
      if (consumer && !consumer.closed) {
        lastSentPreferredLayersByConsumerId.delete(consumer.id)
        pausedConsumerIds.delete(consumer.id)
        consumer.close()
      }
      consumersByProducerId.delete(producerId)
      producerInfoById.delete(producerId)
      consumeLifecycle.removeProducerLifecycle(producerId)

      const stream = streamsByPeerId.get(peerId)
      if (stream && consumer) {
        for (const t of [...stream.getTracks()]) {
          if (t.id === consumer.track.id) {
            stream.removeTrack(t)
            try {
              t.stop()
            } catch {
              /* ignore */
            }
          }
        }
      }
      syncRemotePeerStreamsRef()
      bumpRemotePeerPlayRev(peerId)
      if (import.meta.env.DEV) {
        console.log('[producer-closed] cleaned up consumer', { producerId, peerId })
      }
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
    attachDocumentVisibilityListener()
    
    reconcileConsumerPauseStates()
  }

  function setPeerVisible(peerId: string, visible: boolean): void {
    if (import.meta.env.DEV) {
      console.log('[call-qa:peer-visibility] setPeerVisible', { peerId, visible })
    }
    const prev = peerVisibility.value.get(peerId)
    if (prev === visible) {
      return
    }
    const next = new Map(peerVisibility.value)
    next.set(peerId, visible)
    peerVisibility.value = next
    schedulePreferredLayersUpdate()
    
    
    const shouldPause = isPeerVideoConsumerEffectivelyHidden(peerId)
    for (const [producerId, consumer] of consumersByProducerId.entries()) {
      if (consumer.closed || consumer.kind !== 'video') {
        continue
      }
      const info = producerInfoById.get(producerId)
      if (!info || info.peerId !== peerId) {
        continue
      }
      sendConsumerPauseTransition(consumer, shouldPause)
    }
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
    rememberRecentSpeaker(activeSpeakerPeerId.value)
    rememberRecentSpeaker(peerId)
    if (activeSpeakerPeerId.value !== peerId && import.meta.env.DEV) {
      console.log('[speaker] active speaker changed', { peerId })
    }
    activeSpeakerPeerId.value = peerId
    schedulePreferredLayersUpdate()
  }

  function setUiActiveSpeakerPeerIdForPreferredLayers(peerId: string | null): void {
    const t = typeof peerId === 'string' ? peerId.trim() : ''
    const next = t.length > 0 ? t : null
    if (uiActiveSpeakerPeerIdForPreferredLayers.value === next) {
      return
    }
    rememberRecentSpeaker(uiActiveSpeakerPeerIdForPreferredLayers.value)
    rememberRecentSpeaker(next)
    uiActiveSpeakerPeerIdForPreferredLayers.value = next
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
        pausedConsumerIds.delete(consumer.id)
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
    if (uiActiveSpeakerPeerIdForPreferredLayers.value === peerId) {
      uiActiveSpeakerPeerIdForPreferredLayers.value = null
    }
    recentSpeakerAtByPeerId.delete(peerId)

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
    // Snapshot the active consumer ids first. Iterating the live Map while
    // awaiting `consumer.getStats()` previously raced with `removeRemotePeer`
    // / `teardownAllRemoteConsumers`, polluting the pressure verdict with
    // partial / undefined-field rows for consumers that closed mid-await.
    const snapshot: Array<{ producerId: string; consumer: Consumer }> = []
    for (const [producerId, consumer] of consumersByProducerId.entries()) {
      if (consumer.closed || consumer.kind !== 'video') {
        continue
      }
      snapshot.push({ producerId, consumer })
    }
    for (const { producerId, consumer } of snapshot) {
      // Skip if the consumer was closed since the snapshot was taken.
      if (consumer.closed) {
        continue
      }
      const info = producerInfoById.get(producerId)
      const peerId = info?.peerId ?? '?'
      const row: InboundVideoDebugRow = {
        peerId,
        producerId: consumer.producerId,
      }
      let getStatsOk = false
      try {
        const report = await consumer.getStats()
        // Re-check after the await: if the consumer closed during getStats,
        // the report can be stale/partial. Drop the row entirely so
        // pressure decisions never see ghost data for a closed consumer.
        if (consumer.closed) {
          continue
        }
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
        getStatsOk = true
      } catch {
        /* stats optional — drop the row to avoid feeding undefined fields into pressure */
      }
      if (getStatsOk) {
        out.push(row)
      }
    }
    return out
  }

  function stopRemoteMedia(): void {
    stopReceivePressureMonitor()
    detachDocumentVisibilityListener()
    pausedConsumerIds.clear()
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
    unsubscribeProducerClosed?.()
    unsubscribeProducerClosed = null
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
    clearSpeakerLingerTimer()
    pinnedPeerId.value = null
    activeSpeakerPeerId.value = null
    uiActiveSpeakerPeerIdForPreferredLayers.value = null
    recentSpeakerAtByPeerId.clear()
    lastPreferredLayerTargetsByPeerId.value = {}
    receiverBaselineLayer.value = 'high'
    receiverRole = 'participant'
    signalingRoom = null
    const t = recvTransport.value
    if (t && !t.closed) {
      t.close()
    }
    recvTransport.value = null
    recvTransportPromise = null
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
    setUiActiveSpeakerPeerIdForPreferredLayers,
    removeRemotePeer,
    stopRemoteMedia,
    collectInboundVideoDebugStats,
    remoteVideoSourceByPeerId,
    remoteOutboundVideoPausedByPeerId,
    requestForcedProducerResync,
    requestHardProducerResync,
    receiveQualityPressure,
    receiveDeviceProfile,
    lastPreferredLayerTargetsByPeerId,
    playbackRenderFpsPressureByPeerId,
    receiverBaselineLayer,
  }
}
