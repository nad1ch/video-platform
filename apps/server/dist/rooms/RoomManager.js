"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomManager = void 0;
const Room_1 = require("./Room");
class RoomManager {
    worker;
    rooms = new Map();
    pendingRooms = new Map();
    constructor(worker) {
        this.worker = worker;
    }
    async getOrCreateRoom(roomId) {
        const existing = this.rooms.get(roomId);
        if (existing) {
            return existing;
        }
        let pending = this.pendingRooms.get(roomId);
        if (!pending) {
            pending = Room_1.Room.create(roomId, this.worker)
                .then((room) => {
                this.rooms.set(roomId, room);
                return room;
            })
                .finally(() => {
                this.pendingRooms.delete(roomId);
            });
            this.pendingRooms.set(roomId, pending);
        }
        return pending;
    }
    removeRoom(roomId) {
        this.rooms.delete(roomId);
    }
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
    disposeAllRooms() {
        for (const room of this.rooms.values()) {
            for (const peer of room.getPeers()) {
                peer.closeAllMedia();
            }
            room.dispose();
        }
        this.rooms.clear();
        this.pendingRooms.clear();
    }
}
exports.RoomManager = RoomManager;
