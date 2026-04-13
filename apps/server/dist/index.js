"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const ws_1 = require("ws");
const createWorker_1 = require("./mediasoup/createWorker");
const RoomManager_1 = require("./rooms/RoomManager");
const socketServer_1 = require("./signaling/socketServer");
const PORT = 3000;
async function bootstrap() {
    let shuttingDown = false;
    const worker = await (0, createWorker_1.createMediasoupWorker)({
        isShuttingDown: () => shuttingDown,
    });
    const roomManager = new RoomManager_1.RoomManager(worker);
    const app = (0, express_1.default)();
    const server = http_1.default.createServer(app);
    const wss = new ws_1.WebSocketServer({ server });
    (0, socketServer_1.attachSocketServer)(wss, roomManager);
    app.get('/health', (_req, res) => {
        res.json({
            status: 'ok',
            service: 'mediasoup-server',
        });
    });
    const shutdown = () => {
        if (shuttingDown) {
            return;
        }
        shuttingDown = true;
        console.info('Server shutting down…');
        try {
            roomManager.disposeAllRooms();
        }
        catch (err) {
            console.error('disposeAllRooms failed', err);
        }
        wss.close((wssErr) => {
            if (wssErr) {
                console.error('WebSocketServer close error', wssErr);
            }
            server.close((httpErr) => {
                if (httpErr) {
                    console.error('HTTP server close error', httpErr);
                }
                try {
                    worker.close();
                }
                catch (err) {
                    console.error('worker.close failed', err);
                }
                process.exit(0);
            });
        });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    server.listen(PORT, () => {
        console.log(`Server listening on http://localhost:${PORT}`);
    });
}
bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
});
