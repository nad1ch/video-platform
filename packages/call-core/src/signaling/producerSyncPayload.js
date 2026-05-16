/** Parse server `producer-sync` JSON; returns null when not a valid producer-sync message. */
export function parseProducerSyncPayload(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }
    const msg = data;
    if (msg.type !== 'producer-sync') {
        return null;
    }
    const payload = msg.payload;
    if (!payload || typeof payload !== 'object') {
        return null;
    }
    const raw = payload.producers;
    if (!Array.isArray(raw)) {
        return null;
    }
    const syncReason = payload.syncReason;
    const forceResync = syncReason === 'client-refresh';
    const rawPeers = payload.peers;
    const peers = [];
    if (Array.isArray(rawPeers)) {
        for (const row of rawPeers) {
            if (!row || typeof row !== 'object') {
                continue;
            }
            const r = row;
            if (typeof r.peerId !== 'string' || typeof r.displayName !== 'string') {
                continue;
            }
            const entry = { peerId: r.peerId, displayName: r.displayName.slice(0, 64) };
            if (typeof r.avatarUrl === 'string' && r.avatarUrl.trim().length > 0) {
                entry.avatarUrl = r.avatarUrl.trim().slice(0, 2048);
            }
            peers.push(entry);
        }
    }
    const list = [];
    for (const row of raw) {
        if (!row || typeof row !== 'object') {
            continue;
        }
        const r = row;
        if (typeof r.producerId === 'string' &&
            typeof r.peerId === 'string' &&
            (r.kind === 'audio' || r.kind === 'video')) {
            const rowInfo = { producerId: r.producerId, peerId: r.peerId, kind: r.kind };
            if (r.kind === 'video' && (r.videoSource === 'camera' || r.videoSource === 'screen')) {
                rowInfo.videoSource = r.videoSource;
            }
            if (r.kind === 'video' && typeof r.outboundVideoPaused === 'boolean') {
                rowInfo.outboundVideoPaused = r.outboundVideoPaused;
            }
            list.push(rowInfo);
        }
    }
    const out = {
        producers: list,
        forceResync,
    };
    if (peers.length > 0) {
        out.peers = peers;
    }
    return out;
}
