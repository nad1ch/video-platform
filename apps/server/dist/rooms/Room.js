"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Room = void 0;
const createRouter_1 = require("../mediasoup/createRouter");
class Room {
    id;
    router;
    peers = new Map();
    constructor(id, router) {
        this.id = id;
        this.router = router;
    }
    static async create(id, worker) {
        const router = await (0, createRouter_1.createRouter)(worker);
        return new Room(id, router);
    }
    getRouter() {
        return this.router;
    }
    dispose() {
        if (!this.router.closed) {
            this.router.close();
        }
    }
    addPeer(peer) {
        this.peers.set(peer.id, peer);
    }
    removePeer(peerId) {
        const peer = this.peers.get(peerId);
        if (!peer) {
            return undefined;
        }
        this.peers.delete(peerId);
        return peer;
    }
    getPeer(peerId) {
        return this.peers.get(peerId);
    }
    getPeers() {
        return [...this.peers.values()];
    }
}
exports.Room = Room;
