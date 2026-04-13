"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMediasoupWorker = createMediasoupWorker;
const mediasoup_1 = require("mediasoup");
const pino_1 = __importDefault(require("pino"));
async function createMediasoupWorker(options) {
    const log = (0, pino_1.default)({ name: 'mediasoup-worker' });
    let worker;
    try {
        worker = await (0, mediasoup_1.createWorker)({
            rtcMinPort: 40000,
            rtcMaxPort: 49999,
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
