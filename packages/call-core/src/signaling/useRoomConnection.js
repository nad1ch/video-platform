import { onUnmounted, ref, shallowRef } from 'vue';
import { replyJsonPingIfNeeded } from '../utils/jsonWsPing';
import { guestDisplayNameForPeerId } from '../utils/participantsMapper';
import { inferWsOriginFromHttpApiBase, trimViteApiBase } from '../utils/inferSignalingWsUrlFromApiBase';
import { normalizeDisplayName } from '../utils/normalizeDisplayName';
function assertProductionUsesWss(url) {
    if (!import.meta.env.PROD) {
        return;
    }
    if (!/^wss:\/\//i.test(url.trim())) {
        throw new Error('Production requires wss:// for signaling (ws:// is blocked on HTTPS pages). Set VITE_SIGNALING_URL to a wss:// URL.');
    }
}
function withDefaultSignalingPath(url) {
    try {
        const u = new URL(url);
        while (u.pathname.length > 1 && u.pathname.endsWith('/')) {
            u.pathname = u.pathname.slice(0, -1);
        }
        if (u.pathname === '/' || u.pathname === '') {
            u.pathname = '/ws';
        }
        return u.href;
    }
    catch {
        return url;
    }
}
function resolveWsUrl(explicit) {
    let url;
    if (typeof explicit === 'string' && explicit.trim().length > 0) {
        url = explicit.trim();
    }
    else {
        const fromEnv = import.meta.env.VITE_SIGNALING_URL;
        if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
            url = fromEnv.trim();
        }
        else {
            const inferred = inferWsOriginFromHttpApiBase(trimViteApiBase(import.meta.env.VITE_API_URL));
            if (inferred) {
                url = inferred;
            }
            else if (import.meta.env.DEV) {
                // Host `npm run dev` API default port — sync `apps/server/src/config/localDevApiPort.ts`.
                url = 'ws://127.0.0.1:3333';
            }
            else {
                throw new Error('VITE_SIGNALING_URL is not defined. Set it in Vercel or .env.production to your API origin (wss://...) so session cookies match, or set VITE_API_URL to an absolute https:// API origin for a safe default.');
            }
        }
    }
    url = withDefaultSignalingPath(url);
    assertProductionUsesWss(url);
    return url;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function parseRoomPeerList(raw) {
    if (!Array.isArray(raw)) {
        return null;
    }
    const out = [];
    for (const p of raw) {
        if (typeof p === 'string') {
            out.push({
                peerId: p,
                displayName: guestDisplayNameForPeerId(p),
            });
            continue;
        }
        if (p && typeof p === 'object') {
            const o = p;
            if (typeof o.peerId === 'string') {
                const raw = typeof o.displayName === 'string' ? normalizeDisplayName(o.displayName) : '';
                const dn = raw.length > 0 ? raw.slice(0, 64) : guestDisplayNameForPeerId(o.peerId);
                const row = { peerId: o.peerId, displayName: dn };
                if (typeof o.userId === 'string' && o.userId.trim().length > 0) {
                    row.userId = o.userId.trim().slice(0, 128);
                }
                if (typeof o.avatarUrl === 'string' && o.avatarUrl.trim().length > 0) {
                    row.avatarUrl = o.avatarUrl.trim().slice(0, 2048);
                }
                if (p.audioMuted === true) {
                    row.audioMuted = true;
                }
                out.push(row);
            }
        }
    }
    return out;
}
function parseServerMessage(data) {
    if (!isRecord(data) || typeof data.type !== 'string') {
        return null;
    }
    const payload = data.payload;
    if (data.type === 'room-state' && isRecord(payload) && Array.isArray(payload.peers)) {
        const peerList = parseRoomPeerList(payload.peers);
        if (!peerList) {
            return null;
        }
        const caps = payload.routerRtpCapabilities;
        if (caps === undefined || caps === null || typeof caps !== 'object') {
            return null;
        }
        const existingProducers = [];
        const rawExisting = payload.existingProducers;
        if (Array.isArray(rawExisting)) {
            for (const row of rawExisting) {
                if (!row || typeof row !== 'object') {
                    continue;
                }
                const r = row;
                if (typeof r.producerId === 'string' &&
                    typeof r.peerId === 'string' &&
                    (r.kind === 'audio' || r.kind === 'video')) {
                    const entry = {
                        producerId: r.producerId,
                        peerId: r.peerId,
                        kind: r.kind,
                    };
                    if (r.kind === 'video' &&
                        (r.videoSource === 'camera' || r.videoSource === 'screen')) {
                        entry.videoSource = r.videoSource;
                    }
                    if (r.kind === 'video' && typeof r.outboundVideoPaused === 'boolean') {
                        entry.outboundVideoPaused = r.outboundVideoPaused;
                    }
                    existingProducers.push(entry);
                }
            }
        }
        return {
            type: 'room-state',
            payload: {
                peers: peerList,
                routerRtpCapabilities: caps,
                existingProducers,
            },
        };
    }
    if (data.type === 'peer-joined' && isRecord(payload) && typeof payload.peerId === 'string') {
        const raw = typeof payload.displayName === 'string' ? normalizeDisplayName(payload.displayName) : '';
        const displayName = raw.length > 0 ? raw.slice(0, 64) : guestDisplayNameForPeerId(payload.peerId);
        const avatarRaw = payload.avatarUrl;
        const out = {
            type: 'peer-joined',
            payload: { peerId: payload.peerId, displayName },
        };
        if (typeof payload.userId === 'string' && payload.userId.trim().length > 0) {
            out.payload.userId = payload.userId.trim().slice(0, 128);
        }
        if (typeof avatarRaw === 'string' && avatarRaw.trim().length > 0) {
            out.payload.avatarUrl = avatarRaw.trim().slice(0, 2048);
        }
        return out;
    }
    if (data.type === 'peer-display-name' && isRecord(payload) && typeof payload.peerId === 'string') {
        const dn = typeof payload.displayName === 'string' ? normalizeDisplayName(payload.displayName) : '';
        if (dn.length > 0) {
            return {
                type: 'peer-display-name',
                payload: {
                    peerId: payload.peerId,
                    displayName: dn.slice(0, 64),
                },
            };
        }
    }
    if (data.type === 'peer-left' &&
        isRecord(payload) &&
        typeof payload.peerId === 'string') {
        return { type: 'peer-left', payload: { peerId: payload.peerId } };
    }
    if (data.type === 'transport-created' &&
        isRecord(payload) &&
        (payload.direction === 'send' || payload.direction === 'recv') &&
        isRecord(payload.transportOptions)) {
        return {
            type: 'transport-created',
            payload: {
                direction: payload.direction,
                transportOptions: payload.transportOptions,
            },
        };
    }
    if (data.type === 'transport-connected' &&
        isRecord(payload) &&
        typeof payload.transportId === 'string') {
        return { type: 'transport-connected', payload: { transportId: payload.transportId } };
    }
    return null;
}
function tryParseNewProducerNotice(data) {
    if (!isRecord(data) || data.type !== 'new-producer') {
        return null;
    }
    const payload = data.payload;
    if (!isRecord(payload)) {
        return null;
    }
    const producerId = payload.producerId;
    const peerId = payload.peerId;
    const kind = payload.kind;
    if (typeof producerId !== 'string' ||
        typeof peerId !== 'string' ||
        (kind !== 'audio' && kind !== 'video')) {
        return null;
    }
    const out = { producerId, peerId, kind };
    if (kind === 'video' &&
        (payload.videoSource === 'camera' || payload.videoSource === 'screen')) {
        out.videoSource = payload.videoSource;
    }
    if (kind === 'video' && typeof payload.outboundVideoPaused === 'boolean') {
        out.outboundVideoPaused = payload.outboundVideoPaused;
    }
    return out;
}
export function useRoomConnection(wsUrl) {
    let memoResolvedUrl;
    function getResolvedWsUrl() {
        if (memoResolvedUrl === undefined) {
            memoResolvedUrl = resolveWsUrl(wsUrl);
        }
        return memoResolvedUrl;
    }
    const peers = ref([]);
    const lastRoomState = shallowRef(null);
    const wsRef = shallowRef(null);
    const wsStatus = ref('idle');
    const messageListeners = new Set();
    /** Before drainPendingNewProducers(), stash early new-producer (recv listener not ready yet). */
    const pendingNewProducers = [];
    let bufferNewProducers = true;
    let keepAliveTimer = null;
    function stopSignalingKeepAlive() {
        if (keepAliveTimer !== null) {
            clearInterval(keepAliveTimer);
            keepAliveTimer = null;
        }
    }
    function startSignalingKeepAlive(intervalMs = 25_000) {
        stopSignalingKeepAlive();
        keepAliveTimer = setInterval(() => {
            const ws = wsRef.value;
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                return;
            }
            try {
                ws.send(JSON.stringify({ type: 'client-ping', payload: {} }));
            }
            catch {
                /* ignore */
            }
        }, intervalMs);
    }
    function addMessageListener(handler) {
        messageListeners.add(handler);
        return () => {
            messageListeners.delete(handler);
        };
    }
    function notifyMessageListeners(data) {
        for (const listener of messageListeners) {
            listener(data);
        }
    }
    function bufferIncomingNewProducer(data) {
        if (!bufferNewProducers) {
            return;
        }
        const row = tryParseNewProducerNotice(data);
        if (!row) {
            return;
        }
        if (pendingNewProducers.some((p) => p.producerId === row.producerId)) {
            return;
        }
        pendingNewProducers.push(row);
        if (import.meta.env.DEV) {
            console.log('[ws] buffered new-producer (early)', row);
        }
    }
    function drainPendingNewProducers() {
        bufferNewProducers = false;
        const out = [...pendingNewProducers];
        pendingNewProducers.length = 0;
        if (import.meta.env.DEV && out.length > 0) {
            console.log('[ws] drainPendingNewProducers', { count: out.length });
        }
        return out;
    }
    function applyServerMessage(message) {
        if (message.type === 'room-state') {
            peers.value = message.payload.peers.map((p) => p.peerId);
            lastRoomState.value = {
                peers: [...message.payload.peers],
                routerRtpCapabilities: message.payload.routerRtpCapabilities,
                existingProducers: [...message.payload.existingProducers],
            };
            return;
        }
        if (message.type === 'peer-joined') {
            const { peerId, displayName, userId, avatarUrl } = message.payload;
            if (!peers.value.includes(peerId)) {
                peers.value = [...peers.value, peerId];
            }
            if (lastRoomState.value && !lastRoomState.value.peers.some((p) => p.peerId === peerId)) {
                const entry = { peerId, displayName };
                if (typeof userId === 'string' && userId.length > 0) {
                    entry.userId = userId;
                }
                if (typeof avatarUrl === 'string' && avatarUrl.length > 0) {
                    entry.avatarUrl = avatarUrl;
                }
                lastRoomState.value = {
                    ...lastRoomState.value,
                    peers: [...lastRoomState.value.peers, entry],
                };
            }
            return;
        }
        if (message.type === 'peer-display-name') {
            const { peerId, displayName } = message.payload;
            if (!lastRoomState.value) {
                return;
            }
            const idx = lastRoomState.value.peers.findIndex((p) => p.peerId === peerId);
            if (idx >= 0) {
                const nextPeers = [...lastRoomState.value.peers];
                nextPeers[idx] = { peerId, displayName };
                lastRoomState.value = { ...lastRoomState.value, peers: nextPeers };
            }
            return;
        }
        if (message.type === 'peer-left') {
            const id = message.payload.peerId;
            peers.value = peers.value.filter((p) => p !== id);
            if (lastRoomState.value) {
                lastRoomState.value = {
                    ...lastRoomState.value,
                    peers: lastRoomState.value.peers.filter((p) => p.peerId !== id),
                    existingProducers: lastRoomState.value.existingProducers.filter((p) => p.peerId !== id),
                };
            }
        }
    }
    function detachSocketHandlers(ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
    }
    function connect() {
        return new Promise((resolve, reject) => {
            const previous = wsRef.value;
            if (previous) {
                detachSocketHandlers(previous);
                previous.close();
                wsRef.value = null;
            }
            stopSignalingKeepAlive();
            peers.value = [];
            lastRoomState.value = null;
            pendingNewProducers.length = 0;
            bufferNewProducers = true;
            wsStatus.value = 'connecting';
            const resolvedUrl = getResolvedWsUrl();
            if (import.meta.env.DEV) {
                console.log('[ws] connecting to', resolvedUrl);
            }
            const ws = new WebSocket(resolvedUrl);
            wsRef.value = ws;
            ws.onmessage = (ev) => {
                let data;
                try {
                    data = JSON.parse(String(ev.data));
                }
                catch {
                    return;
                }
                if (replyJsonPingIfNeeded(data, ws)) {
                    return;
                }
                bufferIncomingNewProducer(data);
                notifyMessageListeners(data);
                const structured = parseServerMessage(data);
                if (structured) {
                    applyServerMessage(structured);
                }
            };
            ws.onopen = () => {
                if (wsRef.value !== ws) {
                    return;
                }
                console.log('[WS] connected');
                wsStatus.value = 'open';
                resolve();
            };
            ws.onerror = () => {
                if (wsRef.value === ws) {
                    wsStatus.value = 'error';
                    detachSocketHandlers(ws);
                    wsRef.value = null;
                }
                stopSignalingKeepAlive();
                pendingNewProducers.length = 0;
                bufferNewProducers = true;
                reject(new Error('WebSocket connection failed'));
            };
            ws.onclose = () => {
                console.log('[WS] closed');
                if (wsRef.value === ws) {
                    wsRef.value = null;
                    wsStatus.value = 'closed';
                }
                stopSignalingKeepAlive();
                pendingNewProducers.length = 0;
                bufferNewProducers = true;
            };
        });
    }
    function sendJson(obj) {
        const ws = wsRef.value;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not open');
        }
        ws.send(JSON.stringify(obj));
    }
    function joinRoom(roomId, peerId, displayName, avatarUrl, userId) {
        const ws = wsRef.value;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not open; await connect() before joinRoom()');
        }
        const trimmed = typeof displayName === 'string' ? normalizeDisplayName(displayName) : undefined;
        const payload = { roomId, peerId };
        if (trimmed !== undefined && trimmed.length > 0) {
            payload.displayName = trimmed.slice(0, 64);
        }
        const av = typeof avatarUrl === 'string' ? avatarUrl.trim() : '';
        if (av.length > 0) {
            payload.avatarUrl = av.slice(0, 2048);
        }
        const uid = typeof userId === 'string' ? userId.trim() : '';
        if (uid.length > 0) {
            payload.userId = uid.slice(0, 128);
        }
        ws.send(JSON.stringify({ type: 'join-room', payload }));
    }
    function sendUpdateDisplayName(displayName) {
        const ws = wsRef.value;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            return;
        }
        const t = normalizeDisplayName(displayName).slice(0, 64);
        if (!t) {
            return;
        }
        ws.send(JSON.stringify({ type: 'update-display-name', payload: { displayName: t } }));
    }
    function disconnect() {
        stopSignalingKeepAlive();
        const ws = wsRef.value;
        if (ws) {
            detachSocketHandlers(ws);
            ws.close();
        }
        wsRef.value = null;
        wsStatus.value = 'closed';
        peers.value = [];
        lastRoomState.value = null;
        // Do NOT clear `messageListeners` here — they are owned by their subscriber
        // Full cleanup still happens via each subscriber's own scope dispose.
        pendingNewProducers.length = 0;
        bufferNewProducers = true;
    }
    onUnmounted(() => {
        disconnect();
    });
    return {
        peers,
        lastRoomState,
        wsRef,
        wsStatus,
        connect,
        joinRoom,
        sendUpdateDisplayName,
        disconnect,
        sendJson,
        addMessageListener,
        drainPendingNewProducers,
        startSignalingKeepAlive,
        stopSignalingKeepAlive,
    };
}
