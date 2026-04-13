"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachSocketServer = attachSocketServer;
const messageHandlers_1 = require("./messageHandlers");
function attachSocketServer(wss, roomManager) {
    const socketPeer = new Map();
    const deps = { roomManager, socketPeer };
    wss.on('connection', (socket) => {
        const onDisconnect = () => {
            (0, messageHandlers_1.handleDisconnect)(socket, deps);
        };
        socket.on('message', (raw) => {
            void (async () => {
                let data;
                try {
                    data = JSON.parse(raw.toString());
                }
                catch {
                    return;
                }
                const parsed = messageHandlers_1.clientMessageSchema.safeParse(data);
                if (!parsed.success) {
                    return;
                }
                try {
                    switch (parsed.data.type) {
                        case 'join-room': {
                            const { roomId, peerId, displayName } = parsed.data.payload;
                            await (0, messageHandlers_1.handleJoinRoom)(socket, roomId, peerId, displayName, deps);
                            break;
                        }
                        case 'update-display-name': {
                            const { displayName } = parsed.data.payload;
                            (0, messageHandlers_1.handleUpdateDisplayName)(socket, displayName, deps);
                            break;
                        }
                        case 'create-transport': {
                            const { direction } = parsed.data.payload;
                            await (0, messageHandlers_1.handleCreateTransport)(socket, direction, deps);
                            break;
                        }
                        case 'connect-transport': {
                            const { transportId, dtlsParameters } = parsed.data.payload;
                            await (0, messageHandlers_1.handleConnectTransport)(socket, transportId, dtlsParameters, deps);
                            break;
                        }
                        case 'produce': {
                            const { transportId, kind, rtpParameters, requestId } = parsed.data.payload;
                            await (0, messageHandlers_1.handleProduce)(socket, transportId, kind, rtpParameters, requestId, deps);
                            break;
                        }
                        case 'consume': {
                            const { transportId, producerId, rtpCapabilities } = parsed.data.payload;
                            await (0, messageHandlers_1.handleConsume)(socket, transportId, producerId, rtpCapabilities, deps);
                            break;
                        }
                        default:
                            break;
                    }
                }
                catch (err) {
                    console.error('signaling handler failed', err);
                }
            })();
        });
        socket.on('close', onDisconnect);
        socket.on('error', onDisconnect);
    });
}
