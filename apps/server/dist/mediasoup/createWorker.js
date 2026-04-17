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
const DEFAULT_RTC_MIN = 40_000;
const DEFAULT_RTC_MAX = 49_999;
function resolveRtcPortRange(log) {
    const rawMin = process.env.MEDIASOUP_RTC_MIN_PORT?.trim();
    const rawMax = process.env.MEDIASOUP_RTC_MAX_PORT?.trim();
    const parsedMin = rawMin != null && rawMin.length > 0 ? Number.parseInt(rawMin, 10) : NaN;
    const parsedMax = rawMax != null && rawMax.length > 0 ? Number.parseInt(rawMax, 10) : NaN;
    const rtcMinPort = Number.isFinite(parsedMin) && parsedMin >= 1024 && parsedMin <= 64999 ? parsedMin : DEFAULT_RTC_MIN;
    let rtcMaxPort = Number.isFinite(parsedMax) && parsedMax >= rtcMinPort && parsedMax <= 65_535 ? parsedMax : DEFAULT_RTC_MAX;
    if (rtcMaxPort - rtcMinPort < 99) {
        rtcMaxPort = Math.min(65_535, rtcMinPort + 99);
    }
    if (rtcMinPort !== DEFAULT_RTC_MIN || rtcMaxPort !== DEFAULT_RTC_MAX) {
        log.info({ rtcMinPort, rtcMaxPort }, 'mediasoup RTC port range (override via MEDIASOUP_RTC_MIN_PORT / MEDIASOUP_RTC_MAX_PORT)');
    }
    return { rtcMinPort, rtcMaxPort };
}
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
    const { rtcMinPort, rtcMaxPort } = resolveRtcPortRange(log);
    let worker;
    try {
        worker = await (0, mediasoup_1.createWorker)({
            rtcMinPort,
            rtcMaxPort,
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
