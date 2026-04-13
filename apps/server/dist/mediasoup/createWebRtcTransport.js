"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebRtcTransport = createWebRtcTransport;
function buildListenInfos() {
    const announced = process.env.MEDIASOUP_ANNOUNCED_ADDRESS;
    const announcedOpts = announced ? { announcedAddress: announced } : {};
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
