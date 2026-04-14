"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Room = void 0;
const createRouter_1 = require("../mediasoup/createRouter");
function envNumber(name, fallback) {
    const raw = process.env[name]?.trim();
    if (!raw) {
        return fallback;
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
}
class Room {
    id;
    router;
    peers = new Map();
    audioLevelObserver = null;
    /** Last `peerId` sent in `active-speaker` (null = last send was clear). `undefined` = nothing sent yet. */
    lastBroadcastSpeakerPeerId = undefined;
    silenceClearTimer = null;
    constructor(id, router) {
        this.id = id;
        this.router = router;
    }
    static async create(id, worker) {
        const router = await (0, createRouter_1.createRouter)(worker);
        const room = new Room(id, router);
        await room.initAudioLevelObserver();
        return room;
    }
    clearSilenceHoldTimer() {
        if (this.silenceClearTimer !== null) {
            clearTimeout(this.silenceClearTimer);
            this.silenceClearTimer = null;
        }
    }
    async initAudioLevelObserver() {
        const observer = await this.router.createAudioLevelObserver({
            maxEntries: 1,
            threshold: envNumber('AUDIO_LEVEL_THRESHOLD', -70),
            interval: envNumber('AUDIO_LEVEL_INTERVAL_MS', 800),
        });
        this.audioLevelObserver = observer;
        observer.on('volumes', (volumes) => {
            this.onAudioVolumes(volumes);
        });
        observer.on('silence', () => {
            this.clearSilenceHoldTimer();
            const holdMs = envNumber('AUDIO_SPEAKER_SILENCE_HOLD_MS', 1200);
            this.silenceClearTimer = setTimeout(() => {
                this.silenceClearTimer = null;
                this.emitActiveSpeakerIfChanged(null);
            }, holdMs);
        });
    }
    onAudioVolumes(volumes) {
        this.clearSilenceHoldTimer();
        if (volumes.length === 0) {
            return;
        }
        const { producer } = volumes[0];
        if (!producer || producer.closed) {
            return;
        }
        const speakerPeerId = this.findPeerIdForProducer(producer.id);
        if (!speakerPeerId) {
            return;
        }
        this.emitActiveSpeakerIfChanged(speakerPeerId);
    }
    findPeerIdForProducer(producerId) {
        for (const p of this.peers.values()) {
            if (p.getProducer(producerId)) {
                return p.id;
            }
        }
        return undefined;
    }
    /**
     * Broadcast `active-speaker` only when the dominant speaker actually changes (reduces WS noise).
     */
    emitActiveSpeakerIfChanged(peerId) {
        if (this.lastBroadcastSpeakerPeerId === peerId) {
            return;
        }
        this.lastBroadcastSpeakerPeerId = peerId;
        const msg = { type: 'active-speaker', payload: { peerId } };
        for (const p of this.peers.values()) {
            p.sendJson(msg);
        }
    }
    /**
     * Late joiners miss deduped broadcasts; replay last known dominant speaker (or null) once.
     */
    sendActiveSpeakerCatchUpToPeer(peer) {
        if (this.lastBroadcastSpeakerPeerId === undefined) {
            return;
        }
        peer.sendJson({
            type: 'active-speaker',
            payload: { peerId: this.lastBroadcastSpeakerPeerId },
        });
    }
    async addAudioProducerToLevelObserver(producerId) {
        const obs = this.audioLevelObserver;
        if (!obs || obs.closed) {
            return;
        }
        try {
            await obs.addProducer({ producerId });
        }
        catch {
            /* producer may already be closed */
        }
    }
    async removeAudioProducerFromLevelObserver(producerId) {
        const obs = this.audioLevelObserver;
        if (!obs || obs.closed) {
            return;
        }
        try {
            await obs.removeProducer({ producerId });
        }
        catch {
            /* ignore */
        }
    }
    getRouter() {
        return this.router;
    }
    dispose() {
        this.clearSilenceHoldTimer();
        if (!this.router.closed) {
            this.router.close();
        }
        this.audioLevelObserver = null;
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
