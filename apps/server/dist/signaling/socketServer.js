"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachSocketServer = attachSocketServer;
const ws_1 = __importDefault(require("ws"));
const messageHandlers_1 = require("./messageHandlers");
const WS_PING_INTERVAL_MS = 45_000;
/** JSON frames so reverse proxies that ignore WS-level ping still see traffic. */
const WS_JSON_PING_INTERVAL_MS = 25_000;
function attachSocketServer(wss, roomManager) {
    const socketPeer = new Map();
    const deps = { roomManager, socketPeer };
    const jsonPing = setInterval(() => {
        for (const socket of wss.clients) {
            if (socket.readyState !== ws_1.default.OPEN) {
                continue;
            }
            try {
                socket.send(JSON.stringify({ type: 'ping' }));
            }
            catch {
                /* ignore */
            }
        }
    }, WS_JSON_PING_INTERVAL_MS);
    if (typeof jsonPing.unref === 'function') {
        jsonPing.unref();
    }
    const heartbeat = setInterval(() => {
        for (const socket of wss.clients) {
            const s = socket;
            if (s.readyState !== ws_1.default.OPEN) {
                continue;
            }
            if (s.isAlive === false) {
                s.terminate();
                continue;
            }
            s.isAlive = false;
            s.ping();
        }
    }, WS_PING_INTERVAL_MS);
    if (typeof heartbeat.unref === 'function') {
        heartbeat.unref();
    }
    wss.on('close', () => {
        clearInterval(heartbeat);
        clearInterval(jsonPing);
    });
    wss.on('connection', (socket) => {
        const ext = socket;
        ext.isAlive = true;
        socket.on('pong', () => {
            ext.isAlive = true;
        });
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
                        case 'client-ping': {
                            (0, messageHandlers_1.sendServerMessage)(socket, { type: 'server-pong', payload: {} });
                            break;
                        }
                        case 'pong': {
                            break;
                        }
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
                            const { transportId, kind, rtpParameters, requestId, videoSource } = parsed.data.payload;
                            await (0, messageHandlers_1.handleProduce)(socket, transportId, kind, rtpParameters, requestId, deps, videoSource);
                            break;
                        }
                        case 'producer-video-source': {
                            const { producerId, source } = parsed.data.payload;
                            await (0, messageHandlers_1.handleProducerVideoSource)(socket, producerId, source, deps);
                            break;
                        }
                        case 'set-outbound-video-paused': {
                            const { paused } = parsed.data.payload;
                            await (0, messageHandlers_1.handleSetOutboundVideoPaused)(socket, paused, deps);
                            break;
                        }
                        case 'consume': {
                            const { transportId, producerId, rtpCapabilities } = parsed.data.payload;
                            await (0, messageHandlers_1.handleConsume)(socket, transportId, producerId, rtpCapabilities, deps);
                            break;
                        }
                        case 'set-consumer-preferred-layers': {
                            const { consumerId, spatialLayer } = parsed.data.payload;
                            await (0, messageHandlers_1.handleSetConsumerPreferredLayers)(socket, consumerId, spatialLayer, deps);
                            break;
                        }
                        case 'call-chat': {
                            const { text } = parsed.data.payload;
                            (0, messageHandlers_1.handleCallChat)(socket, text, deps);
                            break;
                        }
                        case 'raise-hand': {
                            const { raised } = parsed.data.payload;
                            (0, messageHandlers_1.handleRaiseHand)(socket, raised, deps);
                            break;
                        }
                        case 'request-producer-sync': {
                            (0, messageHandlers_1.handleRequestProducerSync)(socket, deps, parsed.data.payload);
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
