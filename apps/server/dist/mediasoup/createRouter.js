"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRouter = createRouter;
const mediasoup_1 = require("mediasoup");
/**
 * Use mediasoup's full codec entries (incl. rtcpFeedback like transport-cc / nack).
 * Minimal { mimeType, clockRate }-only codecs often break canConsume for Opus while VP8 still passes.
 */
function pickMediaCodecs() {
    const supported = (0, mediasoup_1.getSupportedRtpCapabilities)();
    const codecs = supported.codecs ?? [];
    const opus = codecs.find((c) => c.kind === 'audio' && c.mimeType === 'audio/opus' && c.channels === 2);
    const vp8 = codecs.find((c) => c.kind === 'video' && c.mimeType === 'video/VP8');
    if (!opus || !vp8) {
        throw new Error('mediasoup getSupportedRtpCapabilities() missing audio/opus or video/VP8');
    }
    return [opus, vp8];
}
async function createRouter(worker) {
    return worker.createRouter({ mediaCodecs: pickMediaCodecs() });
}
