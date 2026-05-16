import { onBeforeUnmount, watch } from 'vue';
import { MafiaWs } from './mafiaWsProtocol';
function parseMafiaAudioMixUpdate(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }
    const o = data;
    if (o.type !== MafiaWs.audioMixUpdate) {
        return null;
    }
    const p = o.payload;
    if (!p || typeof p !== 'object') {
        return null;
    }
    const raw = p.entries;
    if (!Array.isArray(raw)) {
        return null;
    }
    const out = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object')
            continue;
        const r = item;
        const peerId = typeof r.peerId === 'string' ? r.peerId.trim() : '';
        if (!peerId)
            continue;
        const volumeRaw = typeof r.volume === 'number' && Number.isFinite(r.volume) ? r.volume : 1;
        const volume = Math.min(2, Math.max(0, volumeRaw));
        const muted = r.muted === true;
        const userIdRaw = typeof r.userId === 'string' ? r.userId.trim() : '';
        const userId = userIdRaw.length > 0 ? userIdRaw : null;
        out.push({ peerId, userId, volume, muted });
    }
    return { entries: out };
}
export function useMafiaAudioMixSignaling(deps) {
    const { sendSignalingMessage, subscribeSignalingMessage, wsStatus, isMafiaRoute, isViewMode, isMafiaHost, hostPeerId, setRemoteListenVolume, setRemoteListenMuted, } = deps;
    // Local peerId → userId index maintained from call signaling. Lets the host
    // emit entries with a stable `userId` so the server can rebind across
    // peerId changes (host or participant reload).
    const userIdByPeerId = new Map();
    function rememberPeerUserIdFromRoomState(data) {
        if (!data || typeof data !== 'object')
            return;
        const m = data;
        if (m.type === 'room-state') {
            const p = m.payload;
            const list = Array.isArray(p?.peers) ? p?.peers : null;
            if (!list)
                return;
            for (const row of list) {
                if (!row || typeof row !== 'object')
                    continue;
                const r = row;
                const pid = typeof r.peerId === 'string' ? r.peerId.trim() : '';
                if (!pid)
                    continue;
                const uid = typeof r.userId === 'string' ? r.userId.trim() : '';
                if (uid.length > 0) {
                    userIdByPeerId.set(pid, uid);
                }
            }
            return;
        }
        if (m.type === 'peer-joined') {
            const p = m.payload;
            if (!p)
                return;
            const pid = typeof p.peerId === 'string' ? p.peerId.trim() : '';
            if (!pid)
                return;
            const uid = typeof p.userId === 'string' ? p.userId.trim() : '';
            if (uid.length > 0) {
                userIdByPeerId.set(pid, uid);
            }
            return;
        }
        if (m.type === 'peer-left') {
            const p = m.payload;
            const pid = typeof p?.peerId === 'string' ? p.peerId.trim() : '';
            if (pid) {
                userIdByPeerId.delete(pid);
                // `lastServerMixByPeerId` is the OBS-side cache used to restore the
                // previous host's tile mix on host transfer. Without this prune, it
                // accumulated one orphan entry per anonymous-peer reload across long
                // sessions. Authenticated peers re-snapshot through the server's
                // userId-keyed mix on the next join, so dropping the peerId entry is
                // safe — the entry will be re-added if the same peerId returns.
                lastServerMixByPeerId.delete(pid);
            }
        }
    }
    /**
     * Last server-authoritative mix per peerId (from snapshots / deltas). Used to
     * restore the previous host's tile when host transfers — not a blind unmute.
     */
    const lastServerMixByPeerId = new Map();
    function currentHostPeerIdTrimmed() {
        const h = hostPeerId.value;
        return typeof h === 'string' ? h.trim() : '';
    }
    function applyEntriesIfViewMode(entries) {
        // Cache userId hint from inbound entries so reload-and-resnapshot still
        // resolves identity even before `peer-joined` fires for the new peerId.
        for (const e of entries) {
            if (e.userId) {
                userIdByPeerId.set(e.peerId, e.userId);
            }
        }
        for (const e of entries) {
            lastServerMixByPeerId.set(e.peerId, { volume: e.volume, muted: e.muted });
        }
        if (!isViewMode.value) {
            return;
        }
        const hp = currentHostPeerIdTrimmed();
        for (const e of entries) {
            setRemoteListenVolume(e.peerId, e.volume);
            // Never apply inbound mute for the current room host: snapshots may
            // carry muted:false for that peerId; OBS must keep host playback muted.
            if (hp.length > 0 && e.peerId === hp) {
                continue;
            }
            setRemoteListenMuted(e.peerId, e.muted);
        }
        if (hp.length > 0) {
            setRemoteListenMuted(hp, true);
        }
    }
    const off = subscribeSignalingMessage((data) => {
        rememberPeerUserIdFromRoomState(data);
        const parsed = parseMafiaAudioMixUpdate(data);
        if (parsed) {
            applyEntriesIfViewMode(parsed.entries);
        }
    });
    onBeforeUnmount(off);
    // OBS view: force-mute current host playback (mic is captured separately in OBS).
    // Previous host is restored from lastServerMixByPeerId (not blindly unmuted).
    let lastForcedHostMutePeerId = null;
    watch([isViewMode, isMafiaRoute, hostPeerId], ([viewMode, mafiaRoute, hpid]) => {
        if (!mafiaRoute || !viewMode) {
            if (lastForcedHostMutePeerId != null) {
                const prev = lastForcedHostMutePeerId;
                const rec = lastServerMixByPeerId.get(prev);
                setRemoteListenVolume(prev, rec?.volume ?? 1);
                setRemoteListenMuted(prev, rec?.muted ?? false);
                lastForcedHostMutePeerId = null;
            }
            return;
        }
        const next = typeof hpid === 'string' && hpid.trim().length > 0 ? hpid.trim() : null;
        if (lastForcedHostMutePeerId === next) {
            return;
        }
        if (lastForcedHostMutePeerId != null) {
            const prev = lastForcedHostMutePeerId;
            const rec = lastServerMixByPeerId.get(prev);
            setRemoteListenVolume(prev, rec?.volume ?? 1);
            setRemoteListenMuted(prev, rec?.muted ?? false);
        }
        lastForcedHostMutePeerId = next;
        if (next != null) {
            setRemoteListenMuted(next, true);
        }
    }, { immediate: true });
    function broadcastMafiaAudioMixDelta(delta) {
        if (!isMafiaRoute.value || !isMafiaHost.value) {
            return;
        }
        if (wsStatus.value !== 'open') {
            return;
        }
        const peerId = typeof delta.peerId === 'string' ? delta.peerId.trim() : '';
        if (!peerId) {
            return;
        }
        const volumeRaw = typeof delta.volume === 'number' && Number.isFinite(delta.volume) ? delta.volume : 1;
        const volume = Math.min(2, Math.max(0, volumeRaw));
        const muted = delta.muted === true;
        const userId = userIdByPeerId.get(peerId);
        try {
            sendSignalingMessage({
                type: MafiaWs.audioMixUpdate,
                payload: {
                    entries: [
                        {
                            peerId,
                            ...(userId ? { userId } : {}),
                            volume,
                            muted,
                        },
                    ],
                },
            });
        }
        catch {
            /* ws closed mid-send: server snapshot replay covers the gap on next open */
        }
    }
    return { broadcastMafiaAudioMixDelta };
}
