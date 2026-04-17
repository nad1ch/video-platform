"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientMessageSchema = void 0;
exports.sendServerMessage = sendServerMessage;
exports.handleJoinRoom = handleJoinRoom;
exports.handleCallChat = handleCallChat;
exports.handleRaiseHand = handleRaiseHand;
exports.handleUpdateDisplayName = handleUpdateDisplayName;
exports.handleCreateTransport = handleCreateTransport;
exports.handleConnectTransport = handleConnectTransport;
exports.handleRequestProducerSync = handleRequestProducerSync;
exports.handleSetOutboundVideoPaused = handleSetOutboundVideoPaused;
exports.handleProducerVideoSource = handleProducerVideoSource;
exports.handleProduce = handleProduce;
exports.handleConsume = handleConsume;
exports.handleSetConsumerPreferredLayers = handleSetConsumerPreferredLayers;
exports.handleDisconnect = handleDisconnect;
const ws_1 = __importDefault(require("ws"));
const zod_1 = require("zod");
const clientIceServers_1 = require("../config/clientIceServers");
const createWebRtcTransport_1 = require("../mediasoup/createWebRtcTransport");
const Peer_1 = require("../peers/Peer");
const directionSchema = zod_1.z.enum(['send', 'recv']);
const dtlsParametersSchema = zod_1.z
    .object({
    fingerprints: zod_1.z.array(zod_1.z.object({
        algorithm: zod_1.z.string(),
        value: zod_1.z.string(),
    })),
})
    .passthrough();
exports.clientMessageSchema = zod_1.z.discriminatedUnion('type', [
    zod_1.z.object({
        type: zod_1.z.literal('join-room'),
        payload: zod_1.z.object({
            roomId: zod_1.z.string().min(1),
            peerId: zod_1.z.string().min(1),
            displayName: zod_1.z.string().max(64).optional(),
        }),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('update-display-name'),
        payload: zod_1.z.object({
            displayName: zod_1.z.string().min(1).max(64),
        }),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('create-transport'),
        payload: zod_1.z.object({
            direction: directionSchema,
        }),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('connect-transport'),
        payload: zod_1.z.object({
            transportId: zod_1.z.string().min(1),
            dtlsParameters: dtlsParametersSchema,
        }),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('produce'),
        payload: zod_1.z.object({
            transportId: zod_1.z.string().min(1),
            kind: zod_1.z.enum(['audio', 'video']),
            rtpParameters: zod_1.z.unknown(),
            requestId: zod_1.z.string().min(1),
            /** Outbound video semantic; default `camera` on server. */
            videoSource: zod_1.z.enum(['camera', 'screen']).optional(),
        }),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('producer-video-source'),
        payload: zod_1.z.object({
            producerId: zod_1.z.string().min(1),
            source: zod_1.z.enum(['camera', 'screen']),
        }),
    }),
    /** Pause/resume this peer's outbound video producers so remotes get `track.muted`, not a black tile. */
    zod_1.z.object({
        type: zod_1.z.literal('set-outbound-video-paused'),
        payload: zod_1.z.object({
            paused: zod_1.z.boolean(),
        }),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('consume'),
        payload: zod_1.z.object({
            transportId: zod_1.z.string().min(1),
            producerId: zod_1.z.string().min(1),
            rtpCapabilities: zod_1.z.unknown(),
        }),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('set-consumer-preferred-layers'),
        payload: zod_1.z.object({
            consumerId: zod_1.z.string().min(1),
            spatialLayer: zod_1.z.number().int().min(0).max(2),
        }),
    }),
    /** App-level keepalive so proxies / CDNs do not close idle signaling (background tabs). */
    zod_1.z.object({
        type: zod_1.z.literal('client-ping'),
        payload: zod_1.z.object({}).optional(),
    }),
    /** Answer to server JSON `{ type: 'ping' }` (nginx / proxy idle timeouts). */
    zod_1.z.object({
        type: zod_1.z.literal('pong'),
        payload: zod_1.z.object({}).optional(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('call-chat'),
        payload: zod_1.z.object({
            text: zod_1.z.string().min(1).max(500),
        }),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('raise-hand'),
        payload: zod_1.z.object({
            raised: zod_1.z.boolean(),
        }),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('request-producer-sync'),
        payload: zod_1.z
            .object({
            /**
             * When true (default): client may `teardownAllRemoteConsumers` before re-consuming (tab refresh / recovery).
             * When false: merge-only catch-up — same producer list semantics as `recv-connected` (post-join race fix).
             */
            resetConsumers: zod_1.z.boolean().optional(),
        })
            .optional(),
    }),
]);
function sendServerMessage(socket, message) {
    if (socket.readyState === ws_1.default.OPEN) {
        socket.send(JSON.stringify(message));
    }
}
let loggedClientIceConfig = false;
function serializeTransportOptions(transport) {
    const iceServers = (0, clientIceServers_1.getClientIceServersFromEnv)();
    const iceTransportPolicy = (0, clientIceServers_1.getIceTransportPolicyFromEnv)();
    if (!loggedClientIceConfig && (iceServers?.length || iceTransportPolicy)) {
        loggedClientIceConfig = true;
        if (process.env.NODE_ENV !== 'production') {
            console.log('[ice] client RTCConfiguration extras:', {
                extraIceServers: iceServers?.length ?? 0,
                iceTransportPolicy: iceTransportPolicy ?? 'all (default)',
            });
        }
    }
    return {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        ...(iceServers?.length ? { iceServers } : {}),
        ...(iceTransportPolicy ? { iceTransportPolicy } : {}),
    };
}
function collectExistingProducers(room, excludePeerId) {
    const list = [];
    for (const p of room.getPeers()) {
        if (p.id === excludePeerId) {
            continue;
        }
        for (const producer of p.getProducers()) {
            if (producer.closed) {
                continue;
            }
            const row = { producerId: producer.id, peerId: p.id, kind: producer.kind };
            if (producer.kind === 'video') {
                row.videoSource = p.getVideoProducerSource(producer.id) ?? 'camera';
            }
            list.push(row);
        }
    }
    return list;
}
function findProducerInRoom(room, producerId) {
    for (const p of room.getPeers()) {
        const prod = p.getProducer(producerId);
        if (prod) {
            return prod;
        }
    }
    return undefined;
}
/**
 * After outbound `replaceTrack` (same producer id), remotes may receive RTP without a decodable keyframe.
 * Ask each mediasoup video Consumer for this producer to request PLI/FIR toward the publisher.
 */
function requestVideoKeyframesForProducerConsumers(room, producerId) {
    for (const p of room.getPeers()) {
        for (const c of p.getConsumers()) {
            if (c.closed || c.kind !== 'video' || c.producerId !== producerId) {
                continue;
            }
            void c.requestKeyFrame().catch((err) => {
                if (process.env.NODE_ENV !== 'production') {
                    console.warn('[mediasoup] consumer.requestKeyFrame failed', {
                        producerId,
                        consumerId: c.id,
                        consumerPeerId: p.id,
                        err,
                    });
                }
            });
        }
    }
}
function transportDirection(transport) {
    return transport.appData?.direction;
}
function detachPeerAudioProducersFromLevelObserver(peer, room) {
    for (const pr of peer.getProducers()) {
        if (pr.kind === 'audio') {
            void room.removeAudioProducerFromLevelObserver(pr.id);
        }
    }
}
function broadcastPeerLeftToRoom(room, leftPeerId) {
    const msg = { type: 'peer-left', payload: { peerId: leftPeerId } };
    for (const p of room.getPeers()) {
        p.sendJson(msg);
    }
}
function finalizeRoomIfEmpty(room, roomManager) {
    if (room.getPeers().length > 0) {
        return;
    }
    room.dispose();
    roomManager.removeRoom(room.id);
}
function removePeerFromNetwork(peer, deps) {
    const room = deps.roomManager.getRoom(peer.roomId);
    if (room) {
        detachPeerAudioProducersFromLevelObserver(peer, room);
    }
    peer.closeAllMedia();
    deps.socketPeer.delete(peer.socket);
    if (!room) {
        return;
    }
    const removed = room.removePeer(peer.id);
    if (!removed) {
        return;
    }
    broadcastPeerLeftToRoom(room, peer.id);
    finalizeRoomIfEmpty(room, deps.roomManager);
}
function disassociateSocketFromCurrentRoom(socket, deps) {
    const prev = deps.socketPeer.get(socket);
    if (!prev) {
        return;
    }
    removePeerFromNetwork(prev, deps);
}
function replaceDuplicatePeerId(room, incomingSocket, peerId, deps) {
    const existing = room.getPeer(peerId);
    if (!existing || existing.socket === incomingSocket) {
        return;
    }
    console.warn('[signaling] duplicate peerId in room; closing previous socket (open a new tab with a fresh peer id)', {
        roomId: room.id,
        peerId,
    });
    detachPeerAudioProducersFromLevelObserver(existing, room);
    existing.closeAllMedia();
    deps.socketPeer.delete(existing.socket);
    room.removePeer(peerId);
    broadcastPeerLeftToRoom(room, peerId);
    try {
        existing.socket.close(4000, 'Replaced by new connection');
    }
    catch {
        // ignore
    }
    finalizeRoomIfEmpty(room, deps.roomManager);
}
function sanitizeDisplayName(raw, peerId) {
    const t = raw?.trim() ?? '';
    if (t.length > 0) {
        return t.slice(0, 64);
    }
    return `Guest ${peerId.length > 6 ? peerId.slice(-6) : peerId}`;
}
async function handleJoinRoom(socket, roomId, peerId, displayName, deps) {
    disassociateSocketFromCurrentRoom(socket, deps);
    let room = await deps.roomManager.getOrCreateRoom(roomId);
    replaceDuplicatePeerId(room, socket, peerId, deps);
    room = await deps.roomManager.getOrCreateRoom(roomId);
    const name = sanitizeDisplayName(displayName, peerId);
    const peer = new Peer_1.Peer(peerId, socket, room.id, name);
    room.addPeer(peer);
    deps.socketPeer.set(socket, peer);
    const others = room
        .getPeers()
        .filter((p) => p.id !== peerId)
        .map((p) => ({ peerId: p.id, displayName: p.displayName }));
    const routerRtpCapabilities = room.getRouter().rtpCapabilities;
    const existingProducers = collectExistingProducers(room, peerId);
    if (process.env.NODE_ENV !== 'production') {
        const producerSnapshot = room.getPeers().map((p) => ({
            peerId: p.id,
            displayName: p.displayName,
            producers: p.getProducers().filter((pr) => !pr.closed).map((pr) => ({ id: pr.id, kind: pr.kind })),
        }));
        console.log('[join]', {
            roomId: room.id,
            peerId,
            displayName: name,
            peersInRoom: others.length + 1,
            existingProducers: existingProducers.length,
            producerSnapshot,
        });
    }
    sendServerMessage(socket, {
        type: 'room-state',
        payload: { peers: others, routerRtpCapabilities, existingProducers },
    });
    room.sendActiveSpeakerCatchUpToPeer(peer);
    const joinedMsg = {
        type: 'peer-joined',
        payload: { peerId, displayName: name },
    };
    for (const p of room.getPeers()) {
        if (p.id === peerId) {
            continue;
        }
        p.sendJson(joinedMsg);
    }
}
function handleCallChat(socket, text, deps) {
    const peer = getPeerForSocket(socket, deps);
    if (!peer) {
        return;
    }
    const room = deps.roomManager.getRoom(peer.roomId);
    if (!room) {
        return;
    }
    const trimmed = text.trim().slice(0, 500);
    if (!trimmed) {
        return;
    }
    const msg = {
        type: 'call-chat',
        payload: {
            peerId: peer.id,
            displayName: peer.displayName,
            text: trimmed,
            at: Date.now(),
        },
    };
    for (const p of room.getPeers()) {
        p.sendJson(msg);
    }
}
function handleRaiseHand(socket, raised, deps) {
    const peer = getPeerForSocket(socket, deps);
    if (!peer) {
        return;
    }
    const room = deps.roomManager.getRoom(peer.roomId);
    if (!room) {
        return;
    }
    const msg = { type: 'raise-hand', payload: { peerId: peer.id, raised } };
    for (const p of room.getPeers()) {
        p.sendJson(msg);
    }
}
function handleUpdateDisplayName(socket, displayName, deps) {
    const peer = getPeerForSocket(socket, deps);
    if (!peer) {
        return;
    }
    const room = deps.roomManager.getRoom(peer.roomId);
    if (!room) {
        return;
    }
    const trimmed = displayName.trim().slice(0, 64);
    const name = trimmed.length > 0 ? trimmed : sanitizeDisplayName(undefined, peer.id);
    peer.displayName = name;
    const msg = {
        type: 'peer-display-name',
        payload: { peerId: peer.id, displayName: name },
    };
    for (const p of room.getPeers()) {
        p.sendJson(msg);
    }
}
function getPeerForSocket(socket, deps) {
    return deps.socketPeer.get(socket);
}
async function handleCreateTransport(socket, direction, deps) {
    const peer = getPeerForSocket(socket, deps);
    if (!peer) {
        return;
    }
    const room = deps.roomManager.getRoom(peer.roomId);
    if (!room) {
        return;
    }
    try {
        peer.closeTransportsForDirection(direction);
        const transport = await (0, createWebRtcTransport_1.createWebRtcTransport)(room.getRouter(), direction);
        peer.addTransport(transport);
        const transportOptions = serializeTransportOptions(transport);
        sendServerMessage(socket, {
            type: 'transport-created',
            payload: { direction, transportOptions },
        });
    }
    catch (err) {
        console.error('create-transport failed', err);
    }
}
async function handleConnectTransport(socket, transportId, dtlsParameters, deps) {
    const peer = getPeerForSocket(socket, deps);
    if (!peer) {
        return;
    }
    const transport = peer.getTransport(transportId);
    if (!transport || transport.closed) {
        return;
    }
    try {
        await transport.connect({ dtlsParameters });
        sendServerMessage(socket, {
            type: 'transport-connected',
            payload: { transportId },
        });
        if (transportDirection(transport) === 'recv') {
            const r = deps.roomManager.getRoom(peer.roomId);
            if (r) {
                const producers = collectExistingProducers(r, peer.id);
                sendServerMessage(socket, {
                    type: 'producer-sync',
                    payload: { producers, syncReason: 'recv-connected' },
                });
            }
        }
    }
    catch (err) {
        console.error('connect-transport failed', err);
    }
}
/** Client asks for a fresh producer list (e.g. tab became visible after background throttling). */
function handleRequestProducerSync(socket, deps, payload) {
    const peer = getPeerForSocket(socket, deps);
    if (!peer) {
        return;
    }
    const room = deps.roomManager.getRoom(peer.roomId);
    if (!room) {
        return;
    }
    const producers = collectExistingProducers(room, peer.id);
    const resetConsumers = payload?.resetConsumers !== false;
    if (process.env.NODE_ENV !== 'production') {
        console.log('[signaling] request-producer-sync', {
            roomId: room.id,
            peerId: peer.id,
            producerCount: producers.length,
            resetConsumers,
        });
    }
    sendServerMessage(socket, {
        type: 'producer-sync',
        payload: {
            producers,
            syncReason: resetConsumers ? 'client-refresh' : 'recv-connected',
        },
    });
}
async function handleSetOutboundVideoPaused(socket, paused, deps) {
    const peer = getPeerForSocket(socket, deps);
    if (!peer) {
        return;
    }
    for (const p of peer.getProducers()) {
        if (p.closed || p.kind !== 'video') {
            continue;
        }
        try {
            if (paused) {
                if (!p.paused) {
                    await p.pause();
                }
            }
            else if (p.paused) {
                await p.resume();
            }
        }
        catch (e) {
            console.warn('[signaling] set-outbound-video-paused failed', { peerId: peer.id, producerId: p.id }, e);
        }
    }
}
async function handleProducerVideoSource(socket, producerId, source, deps) {
    const peer = getPeerForSocket(socket, deps);
    if (!peer) {
        return;
    }
    const producer = peer.getProducer(producerId);
    if (!producer || producer.closed || producer.kind !== 'video') {
        return;
    }
    peer.setVideoProducerSource(producerId, source);
    const room = deps.roomManager.getRoom(peer.roomId);
    if (!room) {
        return;
    }
    requestVideoKeyframesForProducerConsumers(room, producerId);
    const notice = {
        type: 'producer-video-source-changed',
        payload: { producerId, peerId: peer.id, source },
    };
    for (const p of room.getPeers()) {
        p.sendJson(notice);
    }
}
async function handleProduce(socket, transportId, kind, rtpParameters, requestId, deps, videoSource) {
    const peer = getPeerForSocket(socket, deps);
    if (!peer) {
        return;
    }
    const room = deps.roomManager.getRoom(peer.roomId);
    if (!room) {
        return;
    }
    const transport = peer.getTransport(transportId);
    if (!transport || transport.closed || transportDirection(transport) !== 'send') {
        return;
    }
    try {
        const previousAudioProducers = kind === 'audio' ? peer.getProducers().filter((p) => p.kind === 'audio') : [];
        const initialVideoSource = kind === 'video' ? (videoSource === 'screen' || videoSource === 'camera' ? videoSource : 'camera') : undefined;
        const producer = await transport.produce({
            kind,
            rtpParameters: rtpParameters,
            ...(kind === 'video' && initialVideoSource
                ? { appData: { source: initialVideoSource } }
                : {}),
        });
        if (producer.paused) {
            await producer.resume();
        }
        if (producer.kind === 'audio') {
            for (const prev of previousAudioProducers) {
                await room.removeAudioProducerFromLevelObserver(prev.id);
                peer.removeProducer(prev.id);
            }
        }
        peer.addProducer(producer);
        if (producer.kind === 'video' && initialVideoSource) {
            peer.setVideoProducerSource(producer.id, initialVideoSource);
        }
        if (producer.kind === 'audio') {
            await room.addAudioProducerToLevelObserver(producer.id);
        }
        if (process.env.NODE_ENV !== 'production') {
            console.log('[mediasoup] SERVER PRODUCER', producer.kind, producer.id);
        }
        sendServerMessage(socket, {
            type: 'produced',
            payload: { id: producer.id, requestId },
        });
        const notice = {
            type: 'new-producer',
            payload: {
                producerId: producer.id,
                peerId: peer.id,
                kind: producer.kind,
                ...(producer.kind === 'video'
                    ? { videoSource: peer.getVideoProducerSource(producer.id) ?? 'camera' }
                    : {}),
            },
        };
        for (const p of room.getPeers()) {
            if (p.id === peer.id) {
                continue;
            }
            p.sendJson(notice);
        }
    }
    catch (err) {
        console.error('produce failed', err);
    }
}
function sendConsumeFailed(socket, producerId, reason) {
    sendServerMessage(socket, { type: 'consume-failed', payload: { producerId, reason } });
}
async function handleConsume(socket, transportId, producerId, rtpCapabilities, deps) {
    const peer = getPeerForSocket(socket, deps);
    if (!peer) {
        sendConsumeFailed(socket, producerId, 'no_peer');
        return;
    }
    const room = deps.roomManager.getRoom(peer.roomId);
    if (!room) {
        sendConsumeFailed(socket, producerId, 'no_room');
        return;
    }
    const transport = peer.getTransport(transportId);
    if (!transport || transport.closed || transportDirection(transport) !== 'recv') {
        sendConsumeFailed(socket, producerId, 'invalid_recv_transport');
        return;
    }
    const sourceProducer = findProducerInRoom(room, producerId);
    if (!sourceProducer || sourceProducer.closed) {
        sendConsumeFailed(socket, producerId, 'producer_not_found_or_closed');
        return;
    }
    const caps = rtpCapabilities;
    const canConsume = room.getRouter().canConsume({ producerId, rtpCapabilities: caps });
    if (!canConsume) {
        if (process.env.NODE_ENV !== 'production') {
            console.warn('[canConsume] false', {
                producerId,
                kind: sourceProducer.kind,
                consumerPeerId: peer.id,
            });
        }
        sendConsumeFailed(socket, producerId, 'can_consume_false');
        return;
    }
    try {
        if (sourceProducer.paused) {
            await sourceProducer.resume();
        }
        const consumer = await transport.consume({
            producerId,
            rtpCapabilities: caps,
            paused: true,
        });
        if (process.env.NODE_ENV !== 'production') {
            console.log('[consume] consumer created', {
                producerId,
                kind: consumer.kind,
                consumerPaused: consumer.paused,
                producerPaused: sourceProducer.paused,
            });
        }
        peer.addConsumer(consumer);
        if (process.env.NODE_ENV !== 'production') {
            console.log('[mediasoup] SERVER CONSUMER', consumer.producerId, consumer.kind, consumer.id);
        }
        sendServerMessage(socket, {
            type: 'consumed',
            payload: {
                id: consumer.id,
                producerId: consumer.producerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
            },
        });
        // Resume after signaling so the browser can apply `transport.consume()` first; reduces stuck
        // `track.muted` / no inbound RTP when SFU starts forwarding slightly before the recv path is ready.
        await consumer.resume();
        if (consumer.kind === 'video') {
            void consumer.requestKeyFrame().catch(() => {
                /* optional: codec / timing */
            });
        }
        if (process.env.NODE_ENV !== 'production') {
            console.log('[consume] after consumer.resume', {
                consumerPaused: consumer.paused,
            });
        }
    }
    catch (err) {
        console.error('consume failed', err);
        sendConsumeFailed(socket, producerId, 'server_consume_error');
    }
}
/**
 * Simulcast / SVC layer selection runs on the mediasoup worker Consumer.
 * mediasoup-client browserside Consumer has no setPreferredLayers — the client must signal here.
 */
async function handleSetConsumerPreferredLayers(socket, consumerId, spatialLayer, deps) {
    const peer = getPeerForSocket(socket, deps);
    if (!peer) {
        return;
    }
    const consumer = peer.getConsumer(consumerId);
    if (!consumer || consumer.closed || consumer.kind !== 'video') {
        return;
    }
    try {
        // Spatial simulcast only — do not pass temporalLayer (forces low temporal FPS on some codecs).
        await consumer.setPreferredLayers({ spatialLayer });
        if (process.env.NODE_ENV !== 'production') {
            console.log('[layers] server setPreferredLayers', { consumerId, spatialLayer });
        }
    }
    catch (err) {
        if (process.env.NODE_ENV !== 'production') {
            console.warn('[layers] server setPreferredLayers failed', { consumerId, spatialLayer, err });
        }
        else {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[layers] setPreferredLayers failed', consumerId, spatialLayer, msg);
        }
    }
}
function handleDisconnect(socket, deps) {
    const peer = deps.socketPeer.get(socket);
    if (!peer) {
        return;
    }
    removePeerFromNetwork(peer, deps);
}
