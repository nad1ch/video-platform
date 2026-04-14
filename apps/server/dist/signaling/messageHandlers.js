"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientMessageSchema = void 0;
exports.sendServerMessage = sendServerMessage;
exports.handleJoinRoom = handleJoinRoom;
exports.handleUpdateDisplayName = handleUpdateDisplayName;
exports.handleCreateTransport = handleCreateTransport;
exports.handleConnectTransport = handleConnectTransport;
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
            list.push({ producerId: producer.id, peerId: p.id, kind: producer.kind });
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
                    payload: { producers },
                });
            }
        }
    }
    catch (err) {
        console.error('connect-transport failed', err);
    }
}
async function handleProduce(socket, transportId, kind, rtpParameters, requestId, deps) {
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
        const producer = await transport.produce({
            kind,
            rtpParameters: rtpParameters,
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
        if (producer.kind === 'audio') {
            await room.addAudioProducerToLevelObserver(producer.id);
        }
        sendServerMessage(socket, {
            type: 'produced',
            payload: { id: producer.id, requestId },
        });
        const notice = {
            type: 'new-producer',
            payload: { producerId: producer.id, peerId: peer.id, kind: producer.kind },
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
        await consumer.resume();
        if (process.env.NODE_ENV !== 'production') {
            console.log('[consume] after consumer.resume', {
                consumerPaused: consumer.paused,
            });
        }
        peer.addConsumer(consumer);
        sendServerMessage(socket, {
            type: 'consumed',
            payload: {
                id: consumer.id,
                producerId: consumer.producerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
            },
        });
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
