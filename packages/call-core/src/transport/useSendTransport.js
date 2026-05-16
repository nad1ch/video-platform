import { onUnmounted, shallowRef } from 'vue';
import { CALL_VIDEO_MAX_FRAMERATE, CALL_VIDEO_TARGET_BITRATE_BPS, clampCallVideoBitrate, getOutgoingVideoEncodings, } from '../media/videoQualityPreset';
import { ensureDisplayCaptureVideoTrackEnabled } from '../screenShare/displayCaptureVideoTrack';
import { buildCallAudioDevMicSnapshot, logCallAudioDevDiagnostics } from '../audio/callAudioDevDiagnostics';
import { resolveCallOutboundOpusDtxForProduce } from '../audio/callOutboundOpusPolicy';
import { waitForSignalingMessage } from '../signaling/signalingWait';
function isTransportCreatedMessage(data, direction) {
    if (!data || typeof data !== 'object') {
        return false;
    }
    const msg = data;
    if (msg.type !== 'transport-created' || !msg.payload || typeof msg.payload !== 'object') {
        return false;
    }
    const p = msg.payload;
    return (p.direction === direction &&
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
function isProducedMessage(data, requestId) {
    if (!data || typeof data !== 'object') {
        return false;
    }
    const msg = data;
    if (msg.type !== 'produced' || !msg.payload || typeof msg.payload !== 'object') {
        return false;
    }
    const p = msg.payload;
    return typeof p.id === 'string' && p.requestId === requestId;
}
const CONNECT_TIMEOUT_MS = 45_000;
function outboundVideoGoogleStartBitrateKbps(tier) {
    void tier;
    return Math.round(clampCallVideoBitrate(CALL_VIDEO_TARGET_BITRATE_BPS) / 1000);
}
/**
 * Re-apply our intended encoder caps after `transport.produce` and after every
 * `replaceTrack`. Single-encoding path is the historical behavior — overwrite
 * encodings[0] with the 1.15 Mbps / 20 fps / scale=1 cap. Simulcast path uses
 * the rid-keyed targets from `getOutgoingVideoEncodings(simulcast=true)` and
 * matches them onto the live `params.encodings` by `rid`, preserving any
 * encoder-internal fields that mediasoup-client populated at produce time
 * (`active`, `priority`, etc.). Encodings with unknown rids are passed
 * through untouched so we never silently drop a layer.
 */
async function forceOutboundVideoSenderParameters(producer, snapshot) {
    const sender = producer.rtpSender;
    if (!sender) {
        return;
    }
    const params = sender.getParameters();
    const liveEncodings = params.encodings ?? [];
    if (snapshot.videoSimulcast) {
        const desired = getOutgoingVideoEncodings(snapshot.videoPublishTier, true);
        // Index desired entries by rid for an O(N) merge. Simulcast encodings
        // produced via `transport.produce({ encodings: [...] })` keep the rid we
        // assigned, so this matches one-to-one in normal operation.
        const desiredByRid = new Map();
        for (const e of desired) {
            if (typeof e.rid === 'string' && e.rid.length > 0) {
                desiredByRid.set(e.rid, e);
            }
        }
        const merged = liveEncodings.map((live) => {
            const rid = typeof live.rid === 'string' ? live.rid : '';
            const want = rid.length > 0 ? desiredByRid.get(rid) : undefined;
            if (!want) {
                return live;
            }
            return {
                ...live,
                maxBitrate: want.maxBitrate,
                maxFramerate: want.maxFramerate,
                scaleResolutionDownBy: want.scaleResolutionDownBy,
            };
        });
        params.encodings = merged;
        await sender.setParameters(params);
        return;
    }
    const first = liveEncodings[0] ?? {};
    params.encodings = [
        {
            ...first,
            maxBitrate: clampCallVideoBitrate(CALL_VIDEO_TARGET_BITRATE_BPS),
            maxFramerate: CALL_VIDEO_MAX_FRAMERATE,
            scaleResolutionDownBy: 1,
        },
    ];
    await sender.setParameters(params);
}
const OUTBOUND_AUDIO_OPUS_MAX_AVG_BITRATE_BPS = 96_000;
export function useSendTransport() {
    const sendTransport = shallowRef(null);
    /** First outbound camera producer (used for screen-share `replaceTrack`). */
    const outboundVideoProducer = shallowRef(null);
    /** First outbound mic producer (`replaceTrack` when user switches input device). */
    const outboundAudioProducer = shallowRef(null);
    /** Last `publishLocalMedia` video options — used to recreate the producer if it was closed. */
    let lastOutboundVideoPublish = {
        videoSimulcast: false,
        videoPublishTier: 'balanced',
    };
    /** Serialize outbound video `replaceTrack` (screen ↔ camera spam, device swap + screen). */
    let outboundVideoReplaceChain = Promise.resolve();
    async function createSendTransport(mediaDevice, room) {
        if (!mediaDevice.loaded) {
            throw new Error('Device must be loaded before creating send transport');
        }
        if (sendTransport.value && !sendTransport.value.closed) {
            sendTransport.value.close();
            sendTransport.value = null;
        }
        room.sendJson({ type: 'create-transport', payload: { direction: 'send' } });
        const created = await waitForSignalingMessage(room.addMessageListener, (d) => isTransportCreatedMessage(d, 'send'), CONNECT_TIMEOUT_MS);
        const options = created.payload.transportOptions;
        const transport = mediaDevice.createSendTransport(options);
        transport.on('connectionstatechange', (state) => {
            console.log('[sendTransport] connectionState:', state, { id: transport.id });
            if (state === 'failed') {
                console.error('[ICE] send transport FAILED', { id: transport.id });
            }
        });
        transport.on('connect', ({ dtlsParameters }, success, fail) => {
            try {
                room.sendJson({
                    type: 'connect-transport',
                    payload: {
                        transportId: transport.id,
                        dtlsParameters,
                    },
                });
            }
            catch (err) {
                fail(err instanceof Error ? err : new Error(String(err)));
                return;
            }
            void waitForSignalingMessage(room.addMessageListener, (d) => isTransportConnectedMessage(d, transport.id), CONNECT_TIMEOUT_MS)
                .then(() => success())
                .catch((err) => fail(err instanceof Error ? err : new Error(String(err))));
        });
        transport.on('produce', ({ kind, rtpParameters }, resolve, reject) => {
            const requestId = crypto.randomUUID();
            try {
                room.sendJson({
                    type: 'produce',
                    payload: {
                        transportId: transport.id,
                        kind,
                        rtpParameters,
                        requestId,
                        ...(kind === 'video' ? { videoSource: 'camera' } : {}),
                    },
                });
            }
            catch (err) {
                reject(err instanceof Error ? err : new Error(String(err)));
                return;
            }
            void waitForSignalingMessage(room.addMessageListener, (d) => isProducedMessage(d, requestId), CONNECT_TIMEOUT_MS)
                .then((msg) => resolve({ id: msg.payload.id }))
                .catch((err) => reject(err instanceof Error ? err : new Error(String(err))));
        });
        transport.on('producedata', (_params, _resolve, reject) => {
            reject(new Error('data producer signaling not implemented yet'));
        });
        sendTransport.value = transport;
        return transport;
    }
    async function publishLocalMedia(stream, options) {
        const desiredSimulcast = Boolean(options?.videoSimulcast);
        if (import.meta.env.DEV) {
            console.log('[call-qa:publish] publishLocalMedia', {
                trackKinds: stream.getTracks().map((t) => t.kind),
                videoSimulcast: desiredSimulcast,
                videoPublishTier: options?.videoPublishTier,
            });
        }
        const transport = sendTransport.value;
        if (!transport || transport.closed) {
            throw new Error('Send transport required');
        }
        // Phase 1: when simulcast is on, we still record the wire-time tier so a
        // subsequent reconnect mid-call (which calls `publishLocalMedia` again)
        // resolves the same encodings deterministically. The tier alone does NOT
        // imply simulcast; the boolean is the source of truth.
        lastOutboundVideoPublish = {
            videoSimulcast: desiredSimulcast,
            videoPublishTier: options?.videoPublishTier ?? 'balanced',
        };
        for (const track of stream.getTracks()) {
            if (track.kind !== 'audio' && track.kind !== 'video') {
                continue;
            }
            if (track.kind === 'video') {
                const tier = options?.videoPublishTier ?? 'balanced';
                const encodings = getOutgoingVideoEncodings(tier, desiredSimulcast);
                if (import.meta.env.DEV) {
                    console.log('[produce] video outbound', {
                        trackId: track.id,
                        simulcast: desiredSimulcast,
                        tier,
                        encodings: encodings.map((e) => ({
                            rid: e.rid,
                            scaleResolutionDownBy: e.scaleResolutionDownBy,
                            maxBitrate: e.maxBitrate,
                            maxFramerate: e.maxFramerate,
                        })),
                    });
                }
                const producer = await transport.produce({
                    track,
                    encodings,
                    codecOptions: {
                        videoGoogleStartBitrate: outboundVideoGoogleStartBitrateKbps(tier),
                    },
                });
                await forceOutboundVideoSenderParameters(producer, lastOutboundVideoPublish);
                if (import.meta.env.DEV) {
                    console.log('[produce] PRODUCER CREATED', producer.id, producer.kind);
                }
                outboundVideoProducer.value = producer;
            }
            else {
                if (import.meta.env.DEV) {
                    console.log('[produce-audio] before produce', {
                        trackId: track.id,
                        enabled: track.enabled,
                        muted: track.muted,
                        readyState: track.readyState,
                        transportState: transport.connectionState,
                    });
                }
                const opusDtxForProduce = resolveCallOutboundOpusDtxForProduce();
                logCallAudioDevDiagnostics('before-audio-produce', {
                    opusDtxForProduce,
                    opusDtxNote: 'opusDtx is fixed at Producer creation; change requires new audio producer (rejoin) — replaceTrack does not update it.',
                    ...buildCallAudioDevMicSnapshot(track),
                });
                const audioProducer = await transport.produce({
                    track,
                    codecOptions: {
                        opusDtx: opusDtxForProduce,
                        opusFec: true,
                        opusMaxAverageBitrate: OUTBOUND_AUDIO_OPUS_MAX_AVG_BITRATE_BPS,
                    },
                });
                logCallAudioDevDiagnostics('after-audio-produce', {
                    producerId: audioProducer.id,
                    opusDtxUsed: opusDtxForProduce,
                    ...buildCallAudioDevMicSnapshot(track),
                });
                if (import.meta.env.DEV) {
                    console.log('[produce-audio] created', {
                        producerId: audioProducer.id,
                        transportState: transport.connectionState,
                    });
                }
                outboundAudioProducer.value = audioProducer;
            }
        }
    }
    async function createOutboundVideoProducerFromTrack(track) {
        const transport = sendTransport.value;
        if (!transport || transport.closed) {
            throw new Error('Send transport required to recreate video producer');
        }
        const { videoSimulcast, videoPublishTier } = lastOutboundVideoPublish;
        const encodings = getOutgoingVideoEncodings(videoPublishTier, videoSimulcast);
        if (import.meta.env.DEV) {
            console.log('[produce] recreate outbound video producer', { trackId: track.id, videoPublishTier, videoSimulcast });
        }
        const producer = await transport.produce({
            track,
            encodings,
            codecOptions: {
                videoGoogleStartBitrate: outboundVideoGoogleStartBitrateKbps(videoPublishTier),
            },
        });
        await forceOutboundVideoSenderParameters(producer, lastOutboundVideoPublish);
        outboundVideoProducer.value = producer;
        return producer;
    }
    async function replaceOutboundVideoTrack(track) {
        const job = outboundVideoReplaceChain.then(async () => {
            let p = outboundVideoProducer.value;
            if (track && track.kind === 'video') {
                if (!p || p.closed) {
                    p = await createOutboundVideoProducerFromTrack(track);
                    ensureDisplayCaptureVideoTrackEnabled(track);
                    if (import.meta.env.DEV) {
                        console.log('[produce] replaceOutboundVideoTrack (recreated producer)', { producerId: p.id, trackId: track.id });
                    }
                    return p.id;
                }
                if (import.meta.env.DEV) {
                    console.log('[produce] replaceOutboundVideoTrack', { producerId: p.id, trackId: track.id });
                }
                await p.replaceTrack({ track });
                await forceOutboundVideoSenderParameters(p, lastOutboundVideoPublish);
                ensureDisplayCaptureVideoTrackEnabled(track);
                if (import.meta.env.DEV) {
                    console.log('[produce] replaceTrack applied', p.id);
                }
                return p.id;
            }
            if (!p || p.closed) {
                throw new Error('Outbound video producer is not ready');
            }
            /**
             * `replaceTrack({ track: null })` detaches the sender track — often **no new RTP** until a track
             * is attached again. Remotes can keep an inbound `MediaStreamTrack` in `readyState === 'live'`
             * with **no decoded frames** (last frame / black / pixel sum 0) until producer pause + UI align.
             * For **camera off** while a device still exists, prefer attaching a **live** camera track with
             * `track.enabled === false` and server `set-outbound-video-paused` (Meet-style), not null.
             * Use null only when there is **no** usable camera track to publish (e.g. after screen share end).
             */
            if (import.meta.env.DEV) {
                console.log('[produce] replaceOutboundVideoTrack', { producerId: p.id, trackId: null });
            }
            await p.replaceTrack({ track: null });
            if (import.meta.env.DEV) {
                console.log('[produce] replaceTrack applied', p.id);
            }
            return p.id;
        });
        outboundVideoReplaceChain = job.catch(() => {
            /* never stall the queue */
        });
        return job;
    }
    async function replaceOutboundAudioTrack(track) {
        const p = outboundAudioProducer.value;
        if (!p || p.closed) {
            throw new Error('Outbound audio producer is not ready');
        }
        await p.replaceTrack({ track });
    }
    function closeSendTransport() {
        outboundVideoReplaceChain = Promise.resolve();
        outboundVideoProducer.value = null;
        outboundAudioProducer.value = null;
        const t = sendTransport.value;
        if (t && !t.closed) {
            t.close();
        }
        sendTransport.value = null;
    }
    onUnmounted(() => {
        closeSendTransport();
    });
    return {
        sendTransport,
        createSendTransport,
        publishLocalMedia,
        replaceOutboundVideoTrack,
        replaceOutboundAudioTrack,
        closeSendTransport,
    };
}
