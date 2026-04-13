"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Peer = void 0;
const ws_1 = __importDefault(require("ws"));
class Peer {
    id;
    socket;
    roomId;
    transports = new Map();
    producers = new Map();
    consumers = new Map();
    constructor(id, socket, roomId) {
        this.id = id;
        this.socket = socket;
        this.roomId = roomId;
    }
    sendJson(payload) {
        if (this.socket.readyState === ws_1.default.OPEN) {
            this.socket.send(JSON.stringify(payload));
        }
    }
    addTransport(transport) {
        this.transports.set(transport.id, transport);
    }
    getTransport(transportId) {
        return this.transports.get(transportId);
    }
    removeTransport(transportId) {
        const transport = this.transports.get(transportId);
        if (transport && !transport.closed) {
            transport.close();
        }
        this.transports.delete(transportId);
    }
    closeTransportsForDirection(direction) {
        for (const transport of [...this.transports.values()]) {
            const appData = transport.appData;
            if (appData?.direction === direction) {
                this.removeTransport(transport.id);
            }
        }
    }
    addProducer(producer) {
        this.producers.set(producer.id, producer);
    }
    getProducer(producerId) {
        return this.producers.get(producerId);
    }
    removeProducer(producerId) {
        const producer = this.producers.get(producerId);
        if (producer && !producer.closed) {
            producer.close();
        }
        this.producers.delete(producerId);
    }
    getProducers() {
        return [...this.producers.values()];
    }
    addConsumer(consumer) {
        this.consumers.set(consumer.id, consumer);
    }
    getConsumer(consumerId) {
        return this.consumers.get(consumerId);
    }
    removeConsumer(consumerId) {
        const consumer = this.consumers.get(consumerId);
        if (consumer && !consumer.closed) {
            consumer.close();
        }
        this.consumers.delete(consumerId);
    }
    getConsumers() {
        return [...this.consumers.values()];
    }
    closeAllMedia() {
        for (const consumer of [...this.consumers.values()]) {
            if (!consumer.closed) {
                consumer.close();
            }
        }
        this.consumers.clear();
        for (const producer of [...this.producers.values()]) {
            if (!producer.closed) {
                producer.close();
            }
        }
        this.producers.clear();
        for (const transport of [...this.transports.values()]) {
            if (!transport.closed) {
                transport.close();
            }
        }
        this.transports.clear();
    }
}
exports.Peer = Peer;
