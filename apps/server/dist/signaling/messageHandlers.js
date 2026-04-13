"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientMessageSchema = void 0;
exports.sendServerMessage = sendServerMessage;
exports.handleJoinRoom = handleJoinRoom;
exports.handleCreateTransport = handleCreateTransport;
exports.handleConnectTransport = handleConnectTransport;
exports.handleProduce = handleProduce;
exports.handleConsume = handleConsume;
exports.handleDisconnect = handleDisconnect;
const ws_1 = __importDefault(require("ws"));
const zod_1 = require("zod");
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
]);
function sendServerMessage(socket, message) {
    if (socket.readyState === ws_1.default.OPEN) {
        socket.send(JSON.stringify(message));
    }
}
function serializeTransportOptions(transport) {
    return {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
    };
}
function collectExistingProducers(room, excludePeerId) {
    const list = [];
    for (const p of room.getPeers()) {
        if (p.id === excludePeerId) {
            continue;
        }
        for (const producer of p.getProducers()) {
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
    peer.closeAllMedia();
    deps.socketPeer.delete(peer.socket);
    const room = deps.roomManager.getRoom(peer.roomId);
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
async function handleJoinRoom(socket, roomId, peerId, deps) {
    disassociateSocketFromCurrentRoom(socket, deps);
    let room = await deps.roomManager.getOrCreateRoom(roomId);
    replaceDuplicatePeerId(room, socket, peerId, deps);
    room = await deps.roomManager.getOrCreateRoom(roomId);
    const peer = new Peer_1.Peer(peerId, socket, room.id);
    room.addPeer(peer);
    deps.socketPeer.set(socket, peer);
    const others = room
        .getPeers()
        .filter((p) => p.id !== peerId)
        .map((p) => p.id);
    const routerRtpCapabilities = room.getRouter().rtpCapabilities;
    const existingProducers = collectExistingProducers(room, peerId);
    sendServerMessage(socket, {
        type: 'room-state',
        payload: { peers: others, routerRtpCapabilities, existingProducers },
    });
    const joinedMsg = { type: 'peer-joined', payload: { peerId } };
    for (const p of room.getPeers()) {
        if (p.id === peerId) {
            continue;
        }
        p.sendJson(joinedMsg);
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
        const producer = await transport.produce({
            kind,
            rtpParameters: rtpParameters,
        });
        if (producer.paused) {
            await producer.resume();
        }
        peer.addProducer(producer);
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
async function handleConsume(socket, transportId, producerId, rtpCapabilities, deps) {
    const peer = getPeerForSocket(socket, deps);
    if (!peer) {
        return;
    }
    const room = deps.roomManager.getRoom(peer.roomId);
    if (!room) {
        return;
    }
    const transport = peer.getTransport(transportId);
    if (!transport || transport.closed || transportDirection(transport) !== 'recv') {
        return;
    }
    const sourceProducer = findProducerInRoom(room, producerId);
    if (!sourceProducer || sourceProducer.closed) {
        return;
    }
    const caps = rtpCapabilities;
    if (!room.getRouter().canConsume({ producerId, rtpCapabilities: caps })) {
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
        console.log('[consume] consumer created', {
            producerId,
            kind: consumer.kind,
            consumerPaused: consumer.paused,
            producerPaused: sourceProducer.paused,
        });
        await consumer.resume();
        console.log('[consume] after consumer.resume', {
            consumerPaused: consumer.paused,
        });
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
    }
}
function handleDisconnect(socket, deps) {
    const peer = deps.socketPeer.get(socket);
    if (!peer) {
        return;
    }
    removePeerFromNetwork(peer, deps);
}
