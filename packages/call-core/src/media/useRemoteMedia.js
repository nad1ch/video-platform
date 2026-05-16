import { computed, onUnmounted, shallowRef } from 'vue';
import { waitForSignalingMessage } from '../signaling/signalingWait';
import { parseProducerSyncPayload } from '../signaling/producerSyncPayload';
import { mergeProducerLists } from './mergeProducerLists';
import { buildRequestProducerSyncPayload, createRecoveryCoordinator, producerSyncParsedToRecoveryEvent, } from './recoveryCoordinator';
import { createRecvApplySerialQueue } from './recvApplySerialQueue';
import { createConsumeLifecycleManager } from './consumeLifecycleManager';
import { assignAdaptivePreferredLayersByPeerId, } from './adaptiveVideoPreferredLayers';
import { readNavigatorDeviceProfileInput, resolveReceiveDeviceProfile, } from './receiveDeviceProfile';
import { applyReceiveQualityPressureToLayers, evaluateInboundVideoStatsForPressure, RECEIVE_PRESSURE_GOOD_STREAK_UP, RECEIVE_PRESSURE_POLL_MS, RECEIVE_PRESSURE_UPGRADE_COOLDOWN_MS, } from './receiveVideoQualityPressure';
import { resolveReceiverBaselineLayer, } from './receiverBaselineLayerPolicy';
import { ENABLE_RECEIVER_ADAPTIVE_LAYERS, } from './adaptiveSimulcastFeatureFlags';
import { advancePlaybackRenderFpsPressureByPeer, } from './videoFpsPressure';
const TIMEOUT_MS = 45_000;
const SPEAKER_LINGER_MS = 2500;
/** Coalesce rapid visibility / speaker / pin updates (producer-sync storms). */
const PREFERRED_LAYERS_DEBOUNCE_MS = 80;
function isTransportCreatedRecv(data) {
    if (!data || typeof data !== 'object') {
        return false;
    }
    const msg = data;
    if (msg.type !== 'transport-created' || !msg.payload || typeof msg.payload !== 'object') {
        return false;
    }
    const p = msg.payload;
    return (p.direction === 'recv' &&
        !!p.transportOptions &&
        typeof p.transportOptions === 'object' &&
        typeof p.transportOptions.id === 'string');
}
function isTransportConnectedMessage(data, transportId) {
    if (!data || typeof data !== 'object') {
        return false;
    }
    const msg = data;
    if (msg.type !== 'transport-connected' || !msg.payload || typeof msg.payload !== 'object') {
        return false;
    }
    const p = msg.payload;
    return p.transportId === transportId;
}
function isNewProducer(data) {
    if (!data || typeof data !== 'object') {
        return false;
    }
    const msg = data;
    if (msg.type !== 'new-producer' || !msg.payload || typeof msg.payload !== 'object') {
        return false;
    }
    const p = msg.payload;
    return (typeof p.producerId === 'string' &&
        typeof p.peerId === 'string' &&
        (p.kind === 'audio' || p.kind === 'video'));
}
function isConsumeFailedForProducer(data, producerId) {
    if (!data || typeof data !== 'object') {
        return false;
    }
    const msg = data;
    if (msg.type !== 'consume-failed' || !msg.payload || typeof msg.payload !== 'object') {
        return false;
    }
    const p = msg.payload;
    return typeof p.producerId === 'string' && p.producerId === producerId && typeof p.reason === 'string';
}
function isProducerClosedNotice(data) {
    if (!data || typeof data !== 'object') {
        return false;
    }
    const msg = data;
    if (msg.type !== 'producer-closed' || !msg.payload || typeof msg.payload !== 'object') {
        return false;
    }
    const p = msg.payload;
    return (typeof p.producerId === 'string' &&
        typeof p.peerId === 'string' &&
        (p.kind === 'audio' || p.kind === 'video'));
}
function isProducerVideoSourceChanged(data) {
    if (!data || typeof data !== 'object') {
        return false;
    }
    const msg = data;
    if (msg.type !== 'producer-video-source-changed' || !msg.payload || typeof msg.payload !== 'object') {
        return false;
    }
    const p = msg.payload;
    return (typeof p.producerId === 'string' &&
        typeof p.peerId === 'string' &&
        (p.source === 'camera' || p.source === 'screen'));
}
function isConsumedForProducer(data, producerId) {
    if (!data || typeof data !== 'object') {
        return false;
    }
    const msg = data;
    if (msg.type !== 'consumed' || !msg.payload || typeof msg.payload !== 'object') {
        return false;
    }
    const p = msg.payload;
    return (typeof p.id === 'string' &&
        p.producerId === producerId &&
        (p.kind === 'audio' || p.kind === 'video') &&
        p.rtpParameters !== undefined &&
        typeof p.rtpParameters === 'object');
}
/**
 * Pull the negotiated codec mime-type for a consumer. mediasoup-client surfaces it on
 * `consumer.rtpParameters.codecs[0]` (single-codec consumers, which is our case — we
 * never request multi-codec). DEV-only helper used to verify codec negotiation when
 * the router advertises VP8/H.264/VP9.
 */
function negotiatedCodecMimeType(consumer) {
    const c = consumer.rtpParameters?.codecs?.[0];
    return c && typeof c.mimeType === 'string' ? c.mimeType : null;
}
async function logInboundVideoDebug(consumer, peerId) {
    if (!import.meta.env.DEV) {
        return;
    }
    const track = consumer.track;
    const settings = typeof track.getSettings === 'function'
        ? track.getSettings()
        : {};
    console.log('[video-debug] track settings', {
        peerId,
        producerId: consumer.producerId,
        codec: negotiatedCodecMimeType(consumer),
        width: settings.width,
        height: settings.height,
        frameRate: settings.frameRate,
    });
    try {
        const report = await consumer.getStats();
        const codecMimeById = new Map();
        report.forEach((r) => {
            if (r.type !== 'codec') {
                return;
            }
            const c = r;
            if (typeof c.id === 'string' && typeof c.mimeType === 'string') {
                codecMimeById.set(c.id, c.mimeType);
            }
        });
        report.forEach((r) => {
            if (r.type !== 'inbound-rtp') {
                return;
            }
            const v = r;
            if (v.kind !== 'video') {
                return;
            }
            console.log('[video-debug] inbound-rtp', {
                peerId,
                codec: (v.codecId && codecMimeById.get(v.codecId)) ?? negotiatedCodecMimeType(consumer),
                framesDecoded: v.framesDecoded,
                framesDropped: v.framesDropped,
                framesReceived: v.framesReceived,
                frameWidth: v.frameWidth,
                frameHeight: v.frameHeight,
            });
        });
    }
    catch {
        /* stats optional */
    }
}
export function useRemoteMedia() {
    const receiveDeviceProfile = shallowRef(resolveReceiveDeviceProfile(readNavigatorDeviceProfileInput()));
    const lastPreferredLayerTargetsByPeerId = shallowRef({});
    const recvTransport = shallowRef(null);
    // M3: single-flight cache for `ensureRecvTransport`. Parallel `consumeProducer`
    // callers that race past the null/closed check would otherwise each send
    // `create-transport` and orphan all but the last transport server-side.
    // Cleared in `finally` so a failed creation does not get cached, and in
    // `stopRemoteMedia` so a teardown does not leave a stale pending promise.
    let recvTransportPromise = null;
    const streamsByPeerId = new Map();
    const remotePeerStreamsMap = shallowRef(new Map());
    const remotePeerStreams = computed(() => {
        const m = remotePeerStreamsMap.value;
        return Array.from(m.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([peerId, stream]) => ({ peerId, stream }));
    });
    const remotePeerPlayRevs = shallowRef(new Map());
    const consumeLifecycle = createConsumeLifecycleManager();
    const recvRecovery = createRecoveryCoordinator();
    const recvApplyQueue = createRecvApplySerialQueue();
    const consumersByProducerId = new Map();
    const producerInfoById = new Map();
    const peerVisibility = shallowRef(new Map());
    const peerPriority = shallowRef(new Map());
    const pinnedPeerId = shallowRef(null);
    const activeSpeakerPeerId = shallowRef(null);
    /** App Web Audio dominant remote; merged into layer ranking with SFU {@link activeSpeakerPeerId}. */
    const uiActiveSpeakerPeerIdForPreferredLayers = shallowRef(null);
    /** Retained only for compatibility with older layer-selection helpers. */
    const recentSpeakerAtByPeerId = new Map();
    /** Last preferred layers sent per recv video consumer (skip duplicate signaling). */
    const lastSentPreferredLayersByConsumerId = new Map();
    /**
     * Receiver-driven consumer pause: tracks consumer ids we have asked the SFU to
     * pause via `set-consumer-paused`. Only video consumers ever appear here — audio
     * is never paused by us. Used for one-shot transition semantics so we never
     * spam duplicate pause/resume messages on UI hover/scroll.
     */
    const pausedConsumerIds = new Set();
    /**
     * Cached `document.visibilityState === 'hidden'` flag. When the tab is hidden we
     * pause every video consumer regardless of the per-tile visibility map; on
     * visibilitychange we recompute and only send transitions.
     */
    let documentHiddenCached = false;
    let documentVisibilityHandler = null;
    const receiveQualityPressure = shallowRef('normal');
    const playbackRenderFpsPressureByPeerId = shallowRef(new Map());
    const playbackRenderFpsHysteresisByPeer = new Map();
    let receivePressurePollTimer = null;
    let receivePressureBadStreak = 0;
    let receivePressureGoodStreak = 0;
    let receivePressureLastPacketsLostSum = null;
    let receivePressureLastDowngradeAt = 0;
    let signalingRoom = null;
    let preferredLayersDebounceTimer = null;
    let speakerLingerTimer = null;
    /**
     * When true, `flushPreferredLayersToServer` actually sends per-consumer
     * `set-consumer-preferred-layers` over WS. Off-by-default and flipped on
     * by `setupReceivePath` based on `ENABLE_RECEIVER_ADAPTIVE_LAYERS` (or an
     * explicit override in `SetupReceivePathOptions`). Toggling this off
     * cleanly reverts to the historical "no preferred layers signaled"
     * behavior.
     */
    const videoSpatialLayerSignalingEnabled = shallowRef(false);
    /** Phase 1 receiver baseline (single layer for all normal webcam consumers). */
    const receiverBaselineLayer = shallowRef('high');
    /** `'participant'` for normal users; `'viewer'` for OBS / streamview routes. */
    let receiverRole = 'participant';
    let unsubscribeNewProducer = null;
    let unsubscribeProducerSync = null;
    let unsubscribeProducerVideoSource = null;
    let unsubscribePeerOutboundPaused = null;
    let unsubscribeProducerClosed = null;
    /**
     * Remote outbound video semantic for layout (camera vs screen).
     * Keyed by `peerId` — correct while each peer has at most one video producer (`replaceTrack`).
     * For multi-stream (camera + screen producers), switch to `Map<producerId, source>` and derive UI per producer.
     */
    const remoteVideoSourceByPeerId = shallowRef(new Map());
    /**
     * SFU paused outbound camera (`set-outbound-video-paused`); avoids frozen last frame when track stays "live".
     * Set/cleared from producer lists and `peer-outbound-video-paused` signaling.
     */
    const remoteOutboundVideoPausedByPeerId = shallowRef(new Map());
    function applyPeerVideoSource(peerId, source) {
        const next = new Map(remoteVideoSourceByPeerId.value);
        next.set(peerId, source);
        remoteVideoSourceByPeerId.value = next;
    }
    function syncPeerVideoMetadataFromInfo(info) {
        if (info.kind !== 'video') {
            return;
        }
        applyPeerVideoSource(info.peerId, info.videoSource ?? 'camera');
        const next = new Map(remoteOutboundVideoPausedByPeerId.value);
        if (info.outboundVideoPaused === true) {
            next.set(info.peerId, true);
        }
        else if (info.outboundVideoPaused === false) {
            next.delete(info.peerId);
        }
        remoteOutboundVideoPausedByPeerId.value = next;
    }
    /**
     * Reserved for future UI; transport BWE polling is disabled and does not affect video quality.
     */
    const networkQualityFromStats = shallowRef('good');
    const networkQualityOverride = shallowRef('auto');
    const networkQuality = computed(() => networkQualityOverride.value === 'auto' ? networkQualityFromStats.value : networkQualityOverride.value);
    function setNetworkQualityOverride(level) {
        networkQualityOverride.value = level;
    }
    function onRecvConnectionStateChange(state) {
        if (state === 'failed' || state === 'closed') {
            if (import.meta.env.DEV) {
                console.log('[recvTransport] connection ended', state);
            }
        }
    }
    /** One entry per `peerId` with at least one remote **video** producer (camera and/or screen). */
    function getVideoPeerIds() {
        const ids = new Set();
        for (const info of producerInfoById.values()) {
            if (info.kind === 'video') {
                ids.add(info.peerId);
            }
        }
        return [...ids].sort((a, b) => a.localeCompare(b));
    }
    function layerTierForDev(l) {
        if (l.spatialLayer === 2) {
            return 'high';
        }
        if (l.spatialLayer === 1) {
            return 'medium';
        }
        return 'low';
    }
    function clearSpeakerLingerTimer() {
        if (speakerLingerTimer !== null) {
            clearTimeout(speakerLingerTimer);
            speakerLingerTimer = null;
        }
    }
    function pruneRecentSpeakers(now = Date.now()) {
        const videoPeerIds = new Set(getVideoPeerIds());
        for (const [peerId, at] of recentSpeakerAtByPeerId) {
            if (!videoPeerIds.has(peerId) || now - at >= SPEAKER_LINGER_MS) {
                recentSpeakerAtByPeerId.delete(peerId);
            }
        }
    }
    function getRecentSpeakerPeerIds(now = Date.now()) {
        pruneRecentSpeakers(now);
        return [...recentSpeakerAtByPeerId.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([peerId]) => peerId);
    }
    function scheduleSpeakerLingerExpiryUpdate() {
        clearSpeakerLingerTimer();
        const now = Date.now();
        let nextDelay = null;
        for (const at of recentSpeakerAtByPeerId.values()) {
            const delay = at + SPEAKER_LINGER_MS - now;
            if (delay <= 0) {
                nextDelay = 0;
                break;
            }
            nextDelay = nextDelay === null ? delay : Math.min(nextDelay, delay);
        }
        if (nextDelay === null) {
            return;
        }
        speakerLingerTimer = setTimeout(() => {
            speakerLingerTimer = null;
            pruneRecentSpeakers();
            schedulePreferredLayersUpdate();
            scheduleSpeakerLingerExpiryUpdate();
        }, Math.max(0, nextDelay + 20));
    }
    function rememberRecentSpeaker(peerId) {
        const id = typeof peerId === 'string' ? peerId.trim() : '';
        if (!id) {
            return;
        }
        recentSpeakerAtByPeerId.set(id, Date.now());
        scheduleSpeakerLingerExpiryUpdate();
    }
    function stopReceivePressureMonitor() {
        if (receivePressurePollTimer !== null) {
            clearInterval(receivePressurePollTimer);
            receivePressurePollTimer = null;
        }
        receivePressureBadStreak = 0;
        receivePressureGoodStreak = 0;
        receivePressureLastPacketsLostSum = null;
        receiveQualityPressure.value = 'normal';
        playbackRenderFpsPressureByPeerId.value = new Map();
        playbackRenderFpsHysteresisByPeer.clear();
    }
    function startReceivePressureMonitor() {
        stopReceivePressureMonitor();
        receivePressurePollTimer = setInterval(() => {
            void tickReceiveQualityPressure();
        }, RECEIVE_PRESSURE_POLL_MS);
    }
    function updatePlaybackRenderFpsPressureFromInboundRows(rows) {
        const next = advancePlaybackRenderFpsPressureByPeer({
            videoPeerIds: getVideoPeerIds(),
            inboundRows: rows,
            hysteresisByPeer: playbackRenderFpsHysteresisByPeer,
        });
        playbackRenderFpsPressureByPeerId.value = next;
    }
    async function tickReceiveQualityPressure() {
        if (signalingRoom === null) {
            return;
        }
        // spatial-layer signaling is currently disabled (single-encoding wire).
        // Spatial-layer downgrade decisions remain gated on
        const rows = await collectInboundVideoDebugStats();
        // `collectInboundVideoDebugStats` awaits consumer.getStats() — `stopRemoteMedia`
        // not fire against a closed socket.
        if (signalingRoom === null) {
            return;
        }
        updatePlaybackRenderFpsPressureFromInboundRows(rows);
        if (!videoSpatialLayerSignalingEnabled.value) {
            return;
        }
        const slim = rows.map((r) => ({
            framesDecoded: r.framesDecoded,
            framesDropped: r.framesDropped,
            framesPerSecond: r.framesPerSecond,
            packetsLost: r.packetsLost,
            jitter: r.jitter,
        }));
        const ev = evaluateInboundVideoStatsForPressure(slim, receivePressureLastPacketsLostSum);
        receivePressureLastPacketsLostSum = ev.packetsLostSum;
        if (ev.verdict === 'unknown') {
            return;
        }
        const before = receiveQualityPressure.value;
        if (ev.verdict === 'bad') {
            receivePressureGoodStreak = 0;
            receivePressureBadStreak += 1;
            const streakShift = receiveDeviceProfile.value.pressureBadStreakToShift;
            if (before === 'normal' && receivePressureBadStreak >= streakShift) {
                receiveQualityPressure.value = 'constrained';
                receivePressureLastDowngradeAt = Date.now();
                receivePressureBadStreak = 0;
                if (import.meta.env.DEV) {
                    console.log('[recv-pressure] downgraded to constrained', {
                        badStreak: streakShift,
                        debug: ev.debug,
                    });
                }
                schedulePreferredLayersUpdate();
            }
            else if (before === 'constrained' && receivePressureBadStreak >= streakShift) {
                receiveQualityPressure.value = 'critical';
                receivePressureLastDowngradeAt = Date.now();
                receivePressureBadStreak = 0;
                if (import.meta.env.DEV) {
                    console.log('[recv-pressure] downgraded to critical', {
                        badStreak: streakShift,
                        debug: ev.debug,
                    });
                }
                schedulePreferredLayersUpdate();
            }
        }
        else {
            receivePressureBadStreak = 0;
            receivePressureGoodStreak += 1;
            if (Date.now() - receivePressureLastDowngradeAt < RECEIVE_PRESSURE_UPGRADE_COOLDOWN_MS) {
                return;
            }
            if (receivePressureGoodStreak < RECEIVE_PRESSURE_GOOD_STREAK_UP) {
                return;
            }
            if (before === 'critical') {
                receiveQualityPressure.value = 'constrained';
                receivePressureGoodStreak = 0;
                if (import.meta.env.DEV) {
                    console.log('[recv-pressure] upgraded to constrained', {
                        goodStreak: RECEIVE_PRESSURE_GOOD_STREAK_UP,
                        debug: ev.debug,
                    });
                }
                schedulePreferredLayersUpdate();
            }
            else if (before === 'constrained') {
                receiveQualityPressure.value = 'normal';
                receivePressureGoodStreak = 0;
                if (import.meta.env.DEV) {
                    console.log('[recv-pressure] upgraded to normal', {
                        goodStreak: RECEIVE_PRESSURE_GOOD_STREAK_UP,
                        debug: ev.debug,
                    });
                }
                schedulePreferredLayersUpdate();
            }
            else {
                receivePressureGoodStreak = 0;
            }
        }
    }
    function flushPreferredLayersToServer() {
        const room = signalingRoom;
        if (!room)
            return;
        if (!videoSpatialLayerSignalingEnabled.value) {
            if (import.meta.env.DEV) {
                console.log('[call-qa:layers] flushPreferredLayersToServer skipped (spatial layer signaling off)');
            }
            return;
        }
        const prof = receiveDeviceProfile.value;
        const videoPeerIds = getVideoPeerIds();
        // Phase 1: receiver picks ONE baseline layer for all normal webcam peers
        // based on (profile, role, room cams, sustained pressure). The baseline
        // shifts only on sustained pressure thanks to hysteresis upstream in
        // `tickReceiveQualityPressure` — no per-tile, no active-speaker churn.
        const baseline = resolveReceiverBaselineLayer({
            profile: prof.profile,
            role: receiverRole,
            activeCameraPublishers: videoPeerIds.length,
            pressure: receiveQualityPressure.value,
        });
        receiverBaselineLayer.value = baseline;
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
        });
        // Identity for Phase 1 — the baseline already accounts for pressure.
        // Kept in the call chain for forward compat (custom tests / Phase 2).
        const byPeer = applyReceiveQualityPressureToLayers(baseByPeer, receiveQualityPressure.value, {
            activeSpeakerPeerId: activeSpeakerPeerId.value,
            uiActiveSpeakerPeerId: uiActiveSpeakerPeerIdForPreferredLayers.value,
            pinnedPeerId: pinnedPeerId.value,
            peerVisibility: peerVisibility.value,
        });
        const layerRecord = {};
        for (const [pid, layers] of byPeer) {
            layerRecord[pid] = { spatialLayer: layers.spatialLayer, temporalLayer: layers.temporalLayer };
        }
        lastPreferredLayerTargetsByPeerId.value = layerRecord;
        const devRows = [];
        for (const [producerId, consumer] of consumersByProducerId.entries()) {
            if (consumer.closed || consumer.kind !== 'video')
                continue;
            const info = producerInfoById.get(producerId);
            if (!info)
                continue;
            const { spatialLayer, temporalLayer } = byPeer.get(info.peerId) ?? { spatialLayer: 0, temporalLayer: 0 };
            const next = { spatialLayer, temporalLayer };
            const prev = lastSentPreferredLayersByConsumerId.get(consumer.id);
            const willSend = !prev || prev.spatialLayer !== next.spatialLayer || prev.temporalLayer !== next.temporalLayer;
            if (import.meta.env.DEV) {
                devRows.push({
                    consumerId: consumer.id,
                    peerId: info.peerId,
                    spatialLayer,
                    temporalLayer,
                    tier: layerTierForDev(next),
                    lastSent: prev,
                    willSend,
                });
            }
            if (!willSend) {
                continue;
            }
            try {
                room.sendJson({
                    type: 'set-consumer-preferred-layers',
                    payload: { consumerId: consumer.id, spatialLayer, temporalLayer },
                });
                lastSentPreferredLayersByConsumerId.set(consumer.id, { spatialLayer, temporalLayer });
            }
            catch (e) {
                lastSentPreferredLayersByConsumerId.delete(consumer.id);
                console.error('[layers] send failed', { consumerId: consumer.id, producerId }, e);
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
            });
        }
    }
    function schedulePreferredLayersUpdate() {
        if (!signalingRoom)
            return;
        if (preferredLayersDebounceTimer) {
            clearTimeout(preferredLayersDebounceTimer);
        }
        preferredLayersDebounceTimer = setTimeout(() => {
            preferredLayersDebounceTimer = null;
            flushPreferredLayersToServer();
        }, PREFERRED_LAYERS_DEBOUNCE_MS);
    }
    /**
     * True when the tile for `peerId` should not decode video right now.
     * Combines per-tile visibility map with the document-hidden flag so a hidden
     * tab pauses every remote video at once.
     */
    function isPeerVideoConsumerEffectivelyHidden(peerId) {
        if (documentHiddenCached) {
            return true;
        }
        const v = peerVisibility.value.get(peerId);
        return v === false;
    }
    /** Send a single pause/resume transition; idempotent via {@link pausedConsumerIds}. */
    function sendConsumerPauseTransition(consumer, paused) {
        const room = signalingRoom;
        if (!room) {
            return;
        }
        if (consumer.closed || consumer.kind !== 'video') {
            return;
        }
        const isCurrentlyMarkedPaused = pausedConsumerIds.has(consumer.id);
        if (isCurrentlyMarkedPaused === paused) {
            return;
        }
        try {
            room.sendJson({
                type: 'set-consumer-paused',
                payload: { consumerId: consumer.id, paused },
            });
            if (paused) {
                pausedConsumerIds.add(consumer.id);
            }
            else {
                pausedConsumerIds.delete(consumer.id);
            }
        }
        catch (err) {
            pausedConsumerIds.delete(consumer.id);
            if (import.meta.env.DEV) {
                console.warn('[consumer-pause] send failed', { consumerId: consumer.id, paused, err });
            }
        }
    }
    /**
     * Walk every active video consumer and align its server-side pause state with the
     * effective hidden flag for its peer. Audio consumers are skipped.
     */
    function reconcileConsumerPauseStates() {
        if (!signalingRoom) {
            return;
        }
        for (const [producerId, consumer] of consumersByProducerId.entries()) {
            if (consumer.closed || consumer.kind !== 'video') {
                continue;
            }
            const info = producerInfoById.get(producerId);
            if (!info)
                continue;
            const shouldPause = isPeerVideoConsumerEffectivelyHidden(info.peerId);
            sendConsumerPauseTransition(consumer, shouldPause);
        }
    }
    function attachDocumentVisibilityListener() {
        if (typeof document === 'undefined' || documentVisibilityHandler) {
            return;
        }
        documentHiddenCached = document.visibilityState === 'hidden';
        documentVisibilityHandler = () => {
            const next = document.visibilityState === 'hidden';
            if (next === documentHiddenCached) {
                return;
            }
            documentHiddenCached = next;
            reconcileConsumerPauseStates();
        };
        document.addEventListener('visibilitychange', documentVisibilityHandler);
    }
    function detachDocumentVisibilityListener() {
        if (documentVisibilityHandler && typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', documentVisibilityHandler);
        }
        documentVisibilityHandler = null;
        documentHiddenCached = false;
    }
    function bumpRemotePeerPlayRev(peerId) {
        const pr = new Map(remotePeerPlayRevs.value);
        pr.set(peerId, (pr.get(peerId) ?? 0) + 1);
        remotePeerPlayRevs.value = pr;
    }
    const remoteStreams = computed(() => remotePeerStreams.value.map((e) => e.stream));
    function getOrCreateStream(peerId) {
        let stream = streamsByPeerId.get(peerId);
        if (!stream) {
            stream = new MediaStream();
            streamsByPeerId.set(peerId, stream);
        }
        return stream;
    }
    function syncRemotePeerStreamsRef() {
        const next = new Map(remotePeerStreamsMap.value);
        const nextIds = new Set(streamsByPeerId.keys());
        for (const id of [...next.keys()]) {
            if (!nextIds.has(id)) {
                next.delete(id);
            }
        }
        for (const [id, stream] of streamsByPeerId) {
            if (next.get(id) !== stream) {
                next.set(id, stream);
            }
        }
        remotePeerStreamsMap.value = next;
    }
    function wireRemoteTrack(stream, peerId, track) {
        track.onended = () => {
            stream.removeTrack(track);
            syncRemotePeerStreamsRef();
            bumpRemotePeerPlayRev(peerId);
            if (import.meta.env.DEV) {
                console.log('[track] ended', track.id, { peerId });
            }
        };
        track.addEventListener('unmute', () => {
            if (import.meta.env.DEV) {
                console.log('[track] unmuted', track.id, { peerId, kind: track.kind });
            }
            bumpRemotePeerPlayRev(peerId);
        });
        track.addEventListener('mute', () => {
            if (import.meta.env.DEV) {
                console.log('[track] muted', track.id, { peerId, kind: track.kind });
            }
            bumpRemotePeerPlayRev(peerId);
        });
    }
    function upsertRemoteTrack(peerId, track) {
        const stream = getOrCreateStream(peerId);
        for (const t of [...stream.getTracks()]) {
            if (t.kind === track.kind) {
                stream.removeTrack(t);
                t.stop();
            }
        }
        stream.addTrack(track);
        wireRemoteTrack(stream, peerId, track);
        if (import.meta.env.DEV) {
            console.log('[remote] stream updated', {
                peerId,
                tracks: stream.getTracks().map((t) => ({
                    kind: t.kind,
                    id: t.id,
                    readyState: t.readyState,
                })),
            });
        }
        syncRemotePeerStreamsRef();
        bumpRemotePeerPlayRev(peerId);
    }
    async function ensureRecvTransport(device, room) {
        if (recvTransport.value && !recvTransport.value.closed) {
            return recvTransport.value;
        }
        if (recvTransportPromise) {
            return recvTransportPromise;
        }
        const promise = (async () => {
            try {
                room.sendJson({ type: 'create-transport', payload: { direction: 'recv' } });
                const created = await waitForSignalingMessage(room.addMessageListener, (d) => isTransportCreatedRecv(d), TIMEOUT_MS);
                const transport = device.createRecvTransport(created.payload.transportOptions);
                transport.on('connectionstatechange', (state) => {
                    console.log('[recvTransport] connectionState:', state, { id: transport.id });
                    onRecvConnectionStateChange(state);
                    if (state === 'failed') {
                        console.error('[ICE] recv transport FAILED', { id: transport.id });
                    }
                });
                transport.on('connect', ({ dtlsParameters }, success, fail) => {
                    try {
                        room.sendJson({
                            type: 'connect-transport',
                            payload: { transportId: transport.id, dtlsParameters },
                        });
                    }
                    catch (err) {
                        fail(err instanceof Error ? err : new Error(String(err)));
                        return;
                    }
                    void waitForSignalingMessage(room.addMessageListener, (d) => isTransportConnectedMessage(d, transport.id), TIMEOUT_MS)
                        .then(() => {
                        success();
                    })
                        .catch((err) => fail(err instanceof Error ? err : new Error(String(err))));
                });
                recvTransport.value = transport;
                if (transport.connectionState === 'connected') {
                    onRecvConnectionStateChange('connected');
                }
                return transport;
            }
            finally {
                recvTransportPromise = null;
            }
        })();
        recvTransportPromise = promise;
        return promise;
    }
    /**
     * Recv consume: signaling + `transport.consume`. Dedupe / async boundary / rollback: see `consumeLifecycle.ts`.
     */
    async function runConsumeProducer(device, room, info) {
        const { producerId, peerId, kind } = info;
        if (consumeLifecycle.isAlreadyConsumed(producerId)) {
            return;
        }
        if (!device.loaded) {
            throw new Error('Device not loaded');
        }
        const transport = await ensureRecvTransport(device, room);
        if (!consumeLifecycle.tryReserveAfterTransport(producerId)) {
            return;
        }
        try {
            producerInfoById.set(producerId, info);
            if (import.meta.env.DEV) {
                console.log('[consume] request', { producerId, peerId, kind });
            }
            room.sendJson({
                type: 'consume',
                payload: {
                    transportId: transport.id,
                    producerId,
                    rtpCapabilities: device.rtpCapabilities,
                },
            });
            const msg = await waitForSignalingMessage(room.addMessageListener, (d) => isConsumedForProducer(d, producerId) || isConsumeFailedForProducer(d, producerId), TIMEOUT_MS);
            if (msg.type === 'consume-failed') {
                throw new Error(`consume-failed: ${msg.payload.reason}`);
            }
            const consumer = await transport.consume({
                id: msg.payload.id,
                producerId: msg.payload.producerId,
                kind: msg.payload.kind,
                rtpParameters: msg.payload.rtpParameters,
            });
            if (import.meta.env.DEV) {
                console.log('[consumer]', {
                    kind: consumer.kind,
                    paused: consumer.paused,
                    trackMuted: consumer.track.muted,
                    trackReadyState: consumer.track.readyState,
                });
            }
            // Visibility-first pause: if the peer is currently hidden, send the
            // server-side pause request BEFORE the local mediasoup-client resume
            // and BEFORE all the downstream metadata sync. The server creates the
            // consumer paused but auto-resumes immediately after sending `consumed`,
            // so the burst window is roughly 1 RTT — sending pause as early as
            // possible minimizes wasted RTP for hidden tiles in large rooms (8-12+
            // peers, late join, scrolled-out grid).
            if (consumer.kind === 'video' && isPeerVideoConsumerEffectivelyHidden(peerId)) {
                sendConsumerPauseTransition(consumer, true);
            }
            // Audio must never be paused; fixed-quality video does not use consumer.pause.
            await consumer.resume();
            if (import.meta.env.DEV) {
                console.log('[consumer] after resume', {
                    paused: consumer.paused,
                    trackMuted: consumer.track.muted,
                });
                console.log('[consumer] recreated', { producerId, peerId, kind: consumer.kind });
            }
            consumersByProducerId.set(producerId, consumer);
            upsertRemoteTrack(peerId, consumer.track);
            if (consumer.kind === 'video') {
                syncPeerVideoMetadataFromInfo(info);
                void logInboundVideoDebug(consumer, peerId);
                flushPreferredLayersToServer();
                schedulePreferredLayersUpdate();
                // Re-check visibility after the metadata sync window. If the tile
                // became hidden during the create/resume sequence, the early pause
                // above did not run; this idempotent call covers that case.
                if (isPeerVideoConsumerEffectivelyHidden(peerId)) {
                    sendConsumerPauseTransition(consumer, true);
                }
            }
        }
        catch (err) {
            consumeLifecycle.releaseReservation(producerId);
            // M2: roll back the optimistic `producerInfoById.set` above. Without
            // this, a failed consume leaves stale producer metadata, so
            // `getVideoPeerIds()` and preferred-layer signaling treat the producer
            // as live. Peer-level derived maps are cleared only when no other
            // producer for this `peerId` remains — a sibling (e.g. audio surviving
            // a failed video consume) keeps its peer state.
            producerInfoById.delete(producerId);
            let peerHasOtherProducer = false;
            for (const remaining of producerInfoById.values()) {
                if (remaining.peerId === peerId) {
                    peerHasOtherProducer = true;
                    break;
                }
            }
            if (!peerHasOtherProducer) {
                const nextVideoSource = new Map(remoteVideoSourceByPeerId.value);
                if (nextVideoSource.delete(peerId)) {
                    remoteVideoSourceByPeerId.value = nextVideoSource;
                }
                const nextOutboundPaused = new Map(remoteOutboundVideoPausedByPeerId.value);
                if (nextOutboundPaused.delete(peerId)) {
                    remoteOutboundVideoPausedByPeerId.value = nextOutboundPaused;
                }
            }
            throw err;
        }
    }
    async function consumeProducer(device, room, info) {
        const { producerId } = info;
        if (consumeLifecycle.isAlreadyConsumed(producerId)) {
            return;
        }
        const existing = consumeLifecycle.getInflightTask(producerId);
        if (existing) {
            await existing;
            return;
        }
        const task = (async () => {
            if (consumeLifecycle.isAlreadyConsumed(producerId)) {
                return;
            }
            consumeLifecycle.markConsuming(producerId);
            try {
                if (import.meta.env.DEV) {
                    console.log('[consume] CONSUMING PRODUCER', producerId, info.peerId, info.kind);
                }
                await runConsumeProducer(device, room, info);
            }
            catch (e) {
                consumeLifecycle.releaseReservation(producerId);
                throw e;
            }
            finally {
                consumeLifecycle.unmarkConsuming(producerId);
            }
        })();
        consumeLifecycle.registerInflightTask(producerId, task);
        try {
            await task;
        }
        finally {
            consumeLifecycle.unregisterInflightTask(producerId);
        }
    }
    function startNewProducerListener(device, room) {
        unsubscribeNewProducer?.();
        unsubscribeNewProducer = room.addMessageListener((data) => {
            if (!isNewProducer(data)) {
                return;
            }
            const info = {
                producerId: data.payload.producerId,
                peerId: data.payload.peerId,
                kind: data.payload.kind,
            };
            if (info.kind === 'video') {
                const vs = data.payload.videoSource;
                if (vs === 'camera' || vs === 'screen') {
                    info.videoSource = vs;
                }
            }
            const d = recvRecovery.onEvent({ type: 'new-producer', producer: info });
            void recvApplyQueue
                .enqueue(async () => {
                if (d.shouldReset) {
                    teardownAllRemoteConsumers();
                    recvRecovery.markResetDone();
                }
                await syncExistingProducersImpl(device, room, d.producersToApply);
                recvRecovery.markSyncApplied(d.producersToApply.map((p) => p.producerId));
            })
                .catch((e) => {
                console.error('consume after new-producer failed', e);
            });
        });
    }
    /** Drop all recv-side consumers and remote composite streams (recv transport stays). */
    function teardownAllRemoteConsumers() {
        for (const consumer of consumersByProducerId.values()) {
            if (!consumer.closed) {
                lastSentPreferredLayersByConsumerId.delete(consumer.id);
                pausedConsumerIds.delete(consumer.id);
                consumer.close();
            }
        }
        consumersByProducerId.clear();
        producerInfoById.clear();
        consumeLifecycle.resetAllLifecycle();
        remoteVideoSourceByPeerId.value = new Map();
        remoteOutboundVideoPausedByPeerId.value = new Map();
        const peerIdsToBump = new Set(streamsByPeerId.keys());
        for (const stream of streamsByPeerId.values()) {
            for (const t of [...stream.getTracks()]) {
                stream.removeTrack(t);
                t.stop();
            }
        }
        syncRemotePeerStreamsRef();
        for (const peerId of peerIdsToBump) {
            bumpRemotePeerPlayRev(peerId);
        }
        if (import.meta.env.DEV) {
            console.log('[resync] tore down remote recv consumers');
        }
    }
    /**
     * Tab visible / focus: **soft** producer list only (`resetConsumers: false` → no teardown).
     * Hard teardown + re-consume was killing RTP before `track.muted` cleared → black tiles + flicker.
     */
    function requestForcedProducerResync() {
        const room = signalingRoom;
        if (!room) {
            return;
        }
        try {
            if (import.meta.env.DEV) {
                console.log('[resync] soft producer list (no teardown)');
            }
            room.sendJson({ type: 'request-producer-sync', payload: buildRequestProducerSyncPayload('soft') });
        }
        catch (e) {
            console.warn('[resync] request-producer-sync failed', e);
        }
    }
    /** Explicit recovery: full recv teardown then `client-refresh` sync (use sparingly). */
    function requestHardProducerResync() {
        const room = signalingRoom;
        if (!room) {
            return;
        }
        try {
            if (import.meta.env.DEV) {
                console.log('[resync] hard producer sync (teardown)');
            }
            room.sendJson({ type: 'request-producer-sync', payload: buildRequestProducerSyncPayload('hard') });
        }
        catch (e) {
            console.warn('[resync] hard request-producer-sync failed', e);
        }
    }
    async function syncExistingProducersImpl(device, room, list) {
        if (import.meta.env.DEV) {
            console.log('[syncExistingProducers]', { count: list.length });
        }
        for (const item of list) {
            producerInfoById.set(item.producerId, item);
            syncPeerVideoMetadataFromInfo(item);
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
        const audioList = [];
        const videoList = [];
        for (const item of list) {
            if (item.kind === 'audio') {
                audioList.push(item);
            }
            else {
                videoList.push(item);
            }
        }
        if (audioList.length > 0) {
            const results = await Promise.allSettled(audioList.map((item) => consumeProducer(device, room, item)));
            for (let i = 0; i < results.length; i++) {
                const r = results[i];
                if (r && r.status === 'rejected') {
                    console.error('[syncExistingProducers] audio consume failed', audioList[i], r.reason);
                }
            }
        }
        for (const item of videoList) {
            try {
                await consumeProducer(device, room, item);
            }
            catch (e) {
                console.error('[syncExistingProducers] consume failed', item, e);
            }
        }
        schedulePreferredLayersUpdate();
    }
    function syncExistingProducers(device, room, list) {
        return recvApplyQueue.enqueue(() => syncExistingProducersImpl(device, room, list));
    }
    async function setupReceivePath(device, room, existing, pathOptions) {
        // Phase 1: enable preferred-layers signaling when the feature flag is on.
        // Tests and the admin force-low override pass an explicit boolean.
        const enableLayerSignaling = typeof pathOptions?.enableVideoSpatialLayerSignaling === 'boolean'
            ? pathOptions.enableVideoSpatialLayerSignaling
            : ENABLE_RECEIVER_ADAPTIVE_LAYERS;
        videoSpatialLayerSignalingEnabled.value = enableLayerSignaling;
        receiverRole = pathOptions?.role === 'viewer' ? 'viewer' : 'participant';
        receiverBaselineLayer.value = 'high';
        signalingRoom = room;
        await ensureRecvTransport(device, room);
        const missed = room.drainPendingNewProducers?.() ?? [];
        const merged = mergeProducerLists(existing, missed);
        if (import.meta.env.DEV) {
            console.log('[setupReceivePath]', {
                fromRoomState: existing.length,
                missedNewProducers: missed.length,
                merged: merged.length,
            });
            console.log('[setupReceivePath] final producers', merged.map((p) => ({
                producerId: p.producerId,
                peerId: p.peerId,
                kind: p.kind,
            })));
        }
        /** Initial room-state + missed new-producer apply runs first in the queue (before WS listeners). */
        const initialApplyDone = recvApplyQueue.enqueue(async () => {
            await syncExistingProducersImpl(device, room, merged);
            recvRecovery.markSyncApplied(merged.map((p) => p.producerId));
        });
        startNewProducerListener(device, room);
        unsubscribeProducerVideoSource?.();
        unsubscribeProducerVideoSource = room.addMessageListener((data) => {
            if (!isProducerVideoSourceChanged(data)) {
                return;
            }
            const { peerId, producerId, source } = data.payload;
            const prevSource = remoteVideoSourceByPeerId.value.get(peerId);
            applyPeerVideoSource(peerId, source);
            const info = producerInfoById.get(producerId);
            if (info?.kind === 'video') {
                producerInfoById.set(producerId, { ...info, videoSource: source });
            }
            bumpRemotePeerPlayRev(peerId);
            // Phase 1 screen-share safety: camera ↔ screen transitions flip this
            // peer's layer policy (camera = receiver baseline; screen = pinned
            // high). Schedule a debounced re-flush so the next setPreferredLayers
            // realigns the forwarded spatial layer with the new source. Server
            // already PLIs on source change; this just keeps the rung correct.
            // Skip when the source did not actually change to avoid redundant
            // scheduler work on echoed sync messages.
            if (prevSource !== source) {
                schedulePreferredLayersUpdate();
            }
        });
        unsubscribePeerOutboundPaused?.();
        unsubscribePeerOutboundPaused = room.addMessageListener((data) => {
            if (!data || typeof data !== 'object') {
                return;
            }
            const m = data;
            if (m.type !== 'peer-outbound-video-paused') {
                return;
            }
            const p = m.payload;
            if (!p || typeof p !== 'object') {
                return;
            }
            const { peerId, paused } = p;
            if (typeof peerId !== 'string' || typeof paused !== 'boolean') {
                return;
            }
            const next = new Map(remoteOutboundVideoPausedByPeerId.value);
            if (paused) {
                next.set(peerId, true);
            }
            else {
                next.delete(peerId);
            }
            remoteOutboundVideoPausedByPeerId.value = next;
        });
        unsubscribeProducerClosed?.();
        unsubscribeProducerClosed = room.addMessageListener((data) => {
            if (!isProducerClosedNotice(data)) {
                return;
            }
            const { producerId, peerId } = data.payload;
            // Close the matching consumer (if any) and drop the stale track from the
            // peer's composite stream. Safe when we don't have a consumer yet: the
            // subsequent producer-sync / new-producer flow will not re-create one
            const consumer = consumersByProducerId.get(producerId);
            if (consumer && !consumer.closed) {
                lastSentPreferredLayersByConsumerId.delete(consumer.id);
                pausedConsumerIds.delete(consumer.id);
                consumer.close();
            }
            consumersByProducerId.delete(producerId);
            producerInfoById.delete(producerId);
            consumeLifecycle.removeProducerLifecycle(producerId);
            const stream = streamsByPeerId.get(peerId);
            if (stream && consumer) {
                for (const t of [...stream.getTracks()]) {
                    if (t.id === consumer.track.id) {
                        stream.removeTrack(t);
                        try {
                            t.stop();
                        }
                        catch {
                            /* ignore */
                        }
                    }
                }
            }
            syncRemotePeerStreamsRef();
            bumpRemotePeerPlayRev(peerId);
            if (import.meta.env.DEV) {
                console.log('[producer-closed] cleaned up consumer', { producerId, peerId });
            }
        });
        unsubscribeProducerSync?.();
        unsubscribeProducerSync = room.addMessageListener((data) => {
            const parsed = parseProducerSyncPayload(data);
            if (!parsed) {
                return;
            }
            const d = recvRecovery.onEvent(producerSyncParsedToRecoveryEvent(parsed));
            if (import.meta.env.DEV) {
                console.log('[producer-sync]', {
                    count: d.producersToApply.length,
                    kinds: d.producersToApply.map((p) => p.kind),
                    forceResync: d.shouldReset,
                });
            }
            void recvApplyQueue
                .enqueue(async () => {
                if (d.shouldReset) {
                    teardownAllRemoteConsumers();
                    recvRecovery.markResetDone();
                }
                await syncExistingProducersImpl(device, room, d.producersToApply);
                recvRecovery.markSyncApplied(d.producersToApply.map((p) => p.producerId));
            })
                .catch((e) => {
                console.error('[producer-sync] consume failed', e);
            });
        });
        await initialApplyDone;
        schedulePreferredLayersUpdate();
        startReceivePressureMonitor();
        attachDocumentVisibilityListener();
        reconcileConsumerPauseStates();
    }
    function setPeerVisible(peerId, visible) {
        if (import.meta.env.DEV) {
            console.log('[call-qa:peer-visibility] setPeerVisible', { peerId, visible });
        }
        const prev = peerVisibility.value.get(peerId);
        if (prev === visible) {
            return;
        }
        const next = new Map(peerVisibility.value);
        next.set(peerId, visible);
        peerVisibility.value = next;
        schedulePreferredLayersUpdate();
        const shouldPause = isPeerVideoConsumerEffectivelyHidden(peerId);
        for (const [producerId, consumer] of consumersByProducerId.entries()) {
            if (consumer.closed || consumer.kind !== 'video') {
                continue;
            }
            const info = producerInfoById.get(producerId);
            if (!info || info.peerId !== peerId) {
                continue;
            }
            sendConsumerPauseTransition(consumer, shouldPause);
        }
    }
    function setPeerConsumePriority(peerId, priority) {
        const next = new Map(peerPriority.value);
        next.set(peerId, Number.isFinite(priority) ? priority : 0);
        peerPriority.value = next;
        schedulePreferredLayersUpdate();
    }
    function setPinnedPeer(peerId) {
        pinnedPeerId.value = peerId;
        schedulePreferredLayersUpdate();
    }
    function setActiveSpeaker(peerId) {
        rememberRecentSpeaker(activeSpeakerPeerId.value);
        rememberRecentSpeaker(peerId);
        if (activeSpeakerPeerId.value !== peerId && import.meta.env.DEV) {
            console.log('[speaker] active speaker changed', { peerId });
        }
        activeSpeakerPeerId.value = peerId;
        schedulePreferredLayersUpdate();
    }
    function setUiActiveSpeakerPeerIdForPreferredLayers(peerId) {
        const t = typeof peerId === 'string' ? peerId.trim() : '';
        const next = t.length > 0 ? t : null;
        if (uiActiveSpeakerPeerIdForPreferredLayers.value === next) {
            return;
        }
        rememberRecentSpeaker(uiActiveSpeakerPeerIdForPreferredLayers.value);
        rememberRecentSpeaker(next);
        uiActiveSpeakerPeerIdForPreferredLayers.value = next;
        schedulePreferredLayersUpdate();
    }
    /**
     * Tear down all consumers and the composite stream for a peer that left (or stopped publishing).
     * Prevents stale tiles and frozen frames after `peer-left`.
     */
    function removeRemotePeer(peerId) {
        const nextSrc = new Map(remoteVideoSourceByPeerId.value);
        nextSrc.delete(peerId);
        remoteVideoSourceByPeerId.value = nextSrc;
        const nextPaused = new Map(remoteOutboundVideoPausedByPeerId.value);
        nextPaused.delete(peerId);
        remoteOutboundVideoPausedByPeerId.value = nextPaused;
        const producerIds = [];
        for (const [producerId, info] of producerInfoById.entries()) {
            if (info.peerId === peerId) {
                producerIds.push(producerId);
            }
        }
        for (const producerId of producerIds) {
            const consumer = consumersByProducerId.get(producerId);
            if (consumer && !consumer.closed) {
                lastSentPreferredLayersByConsumerId.delete(consumer.id);
                pausedConsumerIds.delete(consumer.id);
                consumer.close();
            }
            consumersByProducerId.delete(producerId);
            producerInfoById.delete(producerId);
            consumeLifecycle.removeProducerLifecycle(producerId);
        }
        const stream = streamsByPeerId.get(peerId);
        if (stream) {
            for (const t of stream.getTracks()) {
                t.stop();
            }
            streamsByPeerId.delete(peerId);
        }
        if (pinnedPeerId.value === peerId) {
            pinnedPeerId.value = null;
        }
        if (activeSpeakerPeerId.value === peerId) {
            activeSpeakerPeerId.value = null;
        }
        if (uiActiveSpeakerPeerIdForPreferredLayers.value === peerId) {
            uiActiveSpeakerPeerIdForPreferredLayers.value = null;
        }
        recentSpeakerAtByPeerId.delete(peerId);
        const vis = new Map(peerVisibility.value);
        vis.delete(peerId);
        peerVisibility.value = vis;
        const pri = new Map(peerPriority.value);
        pri.delete(peerId);
        peerPriority.value = pri;
        syncRemotePeerStreamsRef();
        bumpRemotePeerPlayRev(peerId);
        schedulePreferredLayersUpdate();
    }
    async function collectInboundVideoDebugStats() {
        const out = [];
        // Snapshot the active consumer ids first. Iterating the live Map while
        // awaiting `consumer.getStats()` previously raced with `removeRemotePeer`
        // / `teardownAllRemoteConsumers`, polluting the pressure verdict with
        // partial / undefined-field rows for consumers that closed mid-await.
        const snapshot = [];
        for (const [producerId, consumer] of consumersByProducerId.entries()) {
            if (consumer.closed || consumer.kind !== 'video') {
                continue;
            }
            snapshot.push({ producerId, consumer });
        }
        for (const { producerId, consumer } of snapshot) {
            // Skip if the consumer was closed since the snapshot was taken.
            if (consumer.closed) {
                continue;
            }
            const info = producerInfoById.get(producerId);
            const peerId = info?.peerId ?? '?';
            const row = {
                peerId,
                producerId: consumer.producerId,
            };
            let getStatsOk = false;
            try {
                const report = await consumer.getStats();
                // Re-check after the await: if the consumer closed during getStats,
                // the report can be stale/partial. Drop the row entirely so
                // pressure decisions never see ghost data for a closed consumer.
                if (consumer.closed) {
                    continue;
                }
                report.forEach((r) => {
                    if (r.type !== 'inbound-rtp') {
                        return;
                    }
                    const v = r;
                    if (v.kind !== 'video') {
                        return;
                    }
                    row.frameWidth = v.frameWidth;
                    row.frameHeight = v.frameHeight;
                    row.framesDecoded = v.framesDecoded;
                    row.framesDropped = v.framesDropped;
                    row.packetsLost = v.packetsLost;
                    row.jitter = v.jitter;
                    if (typeof v.framesPerSecond === 'number') {
                        row.framesPerSecond = v.framesPerSecond;
                    }
                });
                getStatsOk = true;
            }
            catch {
                /* stats optional — drop the row to avoid feeding undefined fields into pressure */
            }
            if (getStatsOk) {
                out.push(row);
            }
        }
        return out;
    }
    function stopRemoteMedia() {
        stopReceivePressureMonitor();
        detachDocumentVisibilityListener();
        pausedConsumerIds.clear();
        videoSpatialLayerSignalingEnabled.value = false;
        networkQualityOverride.value = 'auto';
        networkQualityFromStats.value = 'good';
        unsubscribeNewProducer?.();
        unsubscribeNewProducer = null;
        unsubscribeProducerSync?.();
        unsubscribeProducerSync = null;
        unsubscribeProducerVideoSource?.();
        unsubscribeProducerVideoSource = null;
        unsubscribePeerOutboundPaused?.();
        unsubscribePeerOutboundPaused = null;
        unsubscribeProducerClosed?.();
        unsubscribeProducerClosed = null;
        remoteVideoSourceByPeerId.value = new Map();
        remoteOutboundVideoPausedByPeerId.value = new Map();
        for (const consumer of consumersByProducerId.values()) {
            if (!consumer.closed) {
                consumer.close();
            }
        }
        consumersByProducerId.clear();
        producerInfoById.clear();
        for (const stream of streamsByPeerId.values()) {
            for (const track of stream.getTracks()) {
                track.stop();
            }
        }
        streamsByPeerId.clear();
        remotePeerStreamsMap.value = new Map();
        remotePeerPlayRevs.value = new Map();
        consumeLifecycle.resetAllLifecycle();
        lastSentPreferredLayersByConsumerId.clear();
        if (preferredLayersDebounceTimer) {
            clearTimeout(preferredLayersDebounceTimer);
            preferredLayersDebounceTimer = null;
        }
        clearSpeakerLingerTimer();
        pinnedPeerId.value = null;
        activeSpeakerPeerId.value = null;
        uiActiveSpeakerPeerIdForPreferredLayers.value = null;
        recentSpeakerAtByPeerId.clear();
        lastPreferredLayerTargetsByPeerId.value = {};
        receiverBaselineLayer.value = 'high';
        receiverRole = 'participant';
        signalingRoom = null;
        const t = recvTransport.value;
        if (t && !t.closed) {
            t.close();
        }
        recvTransport.value = null;
        recvTransportPromise = null;
        recvApplyQueue.reset();
    }
    onUnmounted(() => {
        stopRemoteMedia();
    });
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
    };
}
