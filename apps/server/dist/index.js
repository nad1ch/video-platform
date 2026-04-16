"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./loadDotEnv");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const ws_1 = require("ws");
const createWorker_1 = require("./mediasoup/createWorker");
const RoomManager_1 = require("./rooms/RoomManager");
const socketServer_1 = require("./signaling/socketServer");
const clientOrigin_1 = require("./auth/clientOrigin");
const oauthRouter_1 = require("./auth/oauthRouter");
const leaderboardRouter_1 = require("./leaderboardRouter");
const twitchAuthRouter_1 = require("./wordle/twitchAuthRouter");
const tmiChat_1 = require("./wordle/tmiChat");
const wordleSocket_1 = require("./wordle/wordleSocket");
async function bootstrap() {
    let shuttingDown = false;
    const worker = await (0, createWorker_1.createMediasoupWorker)({
        isShuttingDown: () => shuttingDown,
    });
    const roomManager = new RoomManager_1.RoomManager(worker);
    const app = (0, express_1.default)();
    app.use((req, res, next) => {
        const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
        const allowed = (0, clientOrigin_1.corsAllowedOrigins)();
        if (origin && !allowed.includes(origin)) {
            if (req.method === 'OPTIONS') {
                res.status(403).end();
                return;
            }
            res.status(403).type('text/plain').send('Forbidden by CORS');
            return;
        }
        if (origin && allowed.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Vary', 'Origin');
        }
        if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.status(204).end();
            return;
        }
        next();
    });
    app.use((0, cookie_parser_1.default)());
    app.use(express_1.default.json());
    const server = http_1.default.createServer(app);
    const wssSignaling = new ws_1.WebSocketServer({ noServer: true });
    const wssWordle = new ws_1.WebSocketServer({ noServer: true });
    (0, socketServer_1.attachSocketServer)(wssSignaling, roomManager);
    (0, wordleSocket_1.attachWordleSocketServer)(wssWordle);
    server.on('upgrade', (request, socket, head) => {
        const host = request.headers.host ?? 'localhost';
        const pathname = new URL(request.url ?? '/', `http://${host}`).pathname;
        if (pathname === '/wordle-ws') {
            wssWordle.handleUpgrade(request, socket, head, (ws) => {
                wssWordle.emit('connection', ws, request);
            });
            return;
        }
        if (pathname === '/ws' || pathname === '/') {
            wssSignaling.handleUpgrade(request, socket, head, (ws) => {
                wssSignaling.emit('connection', ws, request);
            });
            return;
        }
        socket.destroy();
    });
    (0, oauthRouter_1.mountGlobalAuth)(app);
    (0, twitchAuthRouter_1.mountTwitchWordleAuth)(app);
    (0, leaderboardRouter_1.mountLeaderboardRoutes)(app);
    app.get('/health', (_req, res) => {
        res.json({
            status: 'ok',
            service: 'mediasoup-server',
        });
    });
    (0, tmiChat_1.startTwitchChatIngest)();
    const shutdown = () => {
        if (shuttingDown) {
            return;
        }
        shuttingDown = true;
        console.info('Server shutting down…');
        (0, tmiChat_1.stopTwitchChatIngest)();
        try {
            roomManager.disposeAllRooms();
        }
        catch (err) {
            console.error('disposeAllRooms failed', err);
        }
        const closeWss = (w, name, cb) => {
            w.close((wssErr) => {
                if (wssErr) {
                    console.error(`WebSocketServer ${name} close error`, wssErr);
                }
                cb();
            });
        };
        closeWss(wssWordle, 'wordle', () => {
            closeWss(wssSignaling, 'signaling', () => {
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
        });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    const host = process.env.HOST || '0.0.0.0';
    const port = Number(process.env.PORT) || 3000;
    server.listen(port, host, () => {
        console.log(`Server listening on http://${host}:${port}`);
    });
}
bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
});
