"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMediasoupWorker = createMediasoupWorker;
const mediasoup_1 = require("mediasoup");
const pino_1 = __importDefault(require("pino"));
const WORKER_LOG_LEVELS = ['debug', 'warn', 'error', 'none'];
function resolveMediasoupWorkerLogLevel() {
    const raw = process.env.MEDIASOUP_WORKER_LOG_LEVEL?.trim().toLowerCase();
    if (!raw) {
        return undefined;
    }
    return WORKER_LOG_LEVELS.includes(raw) ? raw : undefined;
}
const PINO_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'];
function resolvePinoLevel() {
    const raw = process.env.SERVER_PINO_LEVEL?.trim().toLowerCase();
    if (!raw) {
        return undefined;
    }
    return PINO_LEVELS.includes(raw) ? raw : undefined;
}
async function createMediasoupWorker(options) {
    const pinoLevel = resolvePinoLevel();
    const log = (0, pino_1.default)({
        name: 'mediasoup-worker',
        ...(pinoLevel ? { level: pinoLevel } : {}),
    });
    const workerLogLevel = resolveMediasoupWorkerLogLevel();
    let worker;
    try {
        worker = await (0, mediasoup_1.createWorker)({
            rtcMinPort: 40000,
            rtcMaxPort: 49999,
            ...(workerLogLevel !== undefined ? { logLevel: workerLogLevel } : {}),
        });
    }
    catch (err) {
        log.error({ err }, 'failed to create mediasoup worker');
        throw err;
    }
    worker.on('died', (error) => {
        if (options?.isShuttingDown?.()) {
            log.info({ err: error }, 'mediasoup worker subprocess exited during shutdown');
            return;
        }
        log.error({ err: error }, 'mediasoup worker died');
        process.exit(1);
    });
    return worker;
}
