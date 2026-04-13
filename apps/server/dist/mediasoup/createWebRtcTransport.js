"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebRtcTransport = createWebRtcTransport;
let warnedAnnouncedMissing = false;
/**
 * ICE candidates must advertise an address the browser can reach. Bind stays on 0.0.0.0.
 * Set MEDIASOUP_ANNOUNCED_ADDRESS to host LAN IP for other devices; Docker needs the host IP, not the container's.
 */
function resolveAnnouncedAddress() {
    const fromEnv = process.env.MEDIASOUP_ANNOUNCED_ADDRESS?.trim();
    if (fromEnv) {
        return fromEnv;
    }
    if (process.env.NODE_ENV !== 'production') {
        if (!warnedAnnouncedMissing) {
            warnedAnnouncedMissing = true;
            console.warn('[mediasoup] MEDIASOUP_ANNOUNCED_ADDRESS unset → using 127.0.0.1 (OK for two tabs on this PC). ' +
                'For another machine on LAN, set MEDIASOUP_ANNOUNCED_ADDRESS to this host\'s LAN IP.');
        }
        return '127.0.0.1';
    }
    if (!warnedAnnouncedMissing) {
        warnedAnnouncedMissing = true;
        console.warn('[mediasoup] MEDIASOUP_ANNOUNCED_ADDRESS unset — remote peers may get black video / no RTP. Set it to the public/LAN IP browsers use to reach this server.');
    }
    return undefined;
}
function buildListenInfos() {
    const announced = resolveAnnouncedAddress();
    const announcedOpts = announced !== undefined && announced !== '' ? { announcedAddress: announced } : {};
    const udp = {
        protocol: 'udp',
        ip: '0.0.0.0',
        ...announcedOpts,
    };
    const tcp = {
        protocol: 'tcp',
        ip: '0.0.0.0',
        ...announcedOpts,
    };
    return [udp, tcp];
}
async function createWebRtcTransport(router, direction) {
    return router.createWebRtcTransport({
        listenInfos: buildListenInfos(),
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        appData: { direction },
    });
}
