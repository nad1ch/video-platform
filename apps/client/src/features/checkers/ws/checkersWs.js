import { ref } from 'vue';
import { sameOriginApiPrefix } from '@/utils/apiUrl';
import { replyJsonPingIfNeeded } from 'call-core/utils';
export const CheckersWs = {
    join: 'checkers:join',
    move: 'checkers:move',
    restart: 'checkers:restart',
    setMode: 'checkers:set-mode',
    ready: 'checkers:ready',
    identity: 'checkers:identity',
    timeout: 'checkers:timeout',
    rematch: 'checkers:rematch',
    state: 'checkers:state',
    update: 'checkers:update',
    error: 'checkers:error',
};
function randomPeerId() {
    try {
        return globalThis.crypto.randomUUID();
    }
    catch {
        return `checkers-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
}
export function readCheckersClientId() {
    const key = 'checkers:client-id:v1';
    if (typeof localStorage !== 'undefined') {
        const existing = localStorage.getItem(key);
        if (existing) {
            return existing;
        }
    }
    const next = randomPeerId();
    try {
        localStorage.setItem(key, next);
    }
    catch {
        /* ignore */
    }
    return next;
}
function buildCheckersWsUrl(peerId) {
    if (typeof window === 'undefined') {
        return null;
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const env = import.meta.env.VITE_CHECKERS_WS_URL;
    if (typeof env === 'string' && env.trim().length > 0) {
        const url = new URL(env.trim());
        url.protocol = proto;
        url.searchParams.set('peerId', peerId);
        return url.toString();
    }
    const prefix = sameOriginApiPrefix();
    if (prefix.startsWith('http://') || prefix.startsWith('https://')) {
        const url = new URL('/checkers-ws', prefix.endsWith('/') ? prefix : `${prefix}/`);
        url.protocol = proto;
        url.searchParams.set('peerId', peerId);
        return url.toString();
    }
    const path = prefix ? `${prefix}/checkers-ws` : '/checkers-ws';
    const query = new URLSearchParams({ peerId }).toString();
    return `${proto}//${window.location.host}${path}?${query}`;
}
export function createCheckersWsClient(options) {
    const status = ref('idle');
    const lastServerPingAt = ref(null);
    const peerId = randomPeerId();
    const clientId = readCheckersClientId();
    let ws = null;
    let activeRoomId = null;
    let disposed = false;
    let reconnectTimer = null;
    let reconnectAttempt = 0;
    function clearReconnect() {
        if (reconnectTimer !== null) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    }
    function closeCurrentSocket() {
        const socket = ws;
        ws = null;
        if (!socket) {
            return;
        }
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        try {
            socket.close();
        }
        catch {
            /* ignore */
        }
    }
    function scheduleReconnect() {
        clearReconnect();
        if (disposed || !activeRoomId) {
            return;
        }
        status.value = 'reconnecting';
        const delay = Math.min(10_000, 800 * 2 ** reconnectAttempt);
        reconnectAttempt = Math.min(reconnectAttempt + 1, 12);
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            if (activeRoomId) {
                connect(activeRoomId);
            }
        }, delay);
    }
    function connect(roomIdRaw) {
        const roomId = roomIdRaw.trim();
        if (!roomId || disposed) {
            return;
        }
        if (ws && ws.readyState === WebSocket.OPEN && activeRoomId === roomId) {
            return;
        }
        activeRoomId = roomId;
        clearReconnect();
        closeCurrentSocket();
        const url = buildCheckersWsUrl(peerId);
        if (!url) {
            return;
        }
        status.value = 'reconnecting';
        const socket = new WebSocket(url);
        ws = socket;
        socket.onopen = () => {
            if (ws !== socket) {
                return;
            }
            reconnectAttempt = 0;
            status.value = 'open';
            lastServerPingAt.value = Date.now();
            socket.send(JSON.stringify({
                type: CheckersWs.join,
                roomId,
                clientId,
                displayName: options.getDisplayName?.(),
                botDifficulty: options.getBotDifficulty?.(),
            }));
        };
        socket.onmessage = (event) => {
            if (ws !== socket) {
                return;
            }
            let data;
            try {
                data = JSON.parse(String(event.data));
            }
            catch {
                return;
            }
            if (data && typeof data === 'object' && data.type === 'ping') {
                lastServerPingAt.value = Date.now();
            }
            if (replyJsonPingIfNeeded(data, socket)) {
                return;
            }
            if (!data || typeof data !== 'object') {
                return;
            }
            const msg = data;
            if ((msg.type === CheckersWs.state || msg.type === CheckersWs.update) && msg.payload) {
                options.onState(msg.payload);
                return;
            }
            if (msg.type === CheckersWs.error && msg.payload && typeof msg.payload === 'object') {
                const payload = msg.payload;
                options.onError(typeof payload.message === 'string' ? payload.message : 'Checkers WebSocket error');
            }
        };
        socket.onerror = () => {
            if (ws === socket) {
                status.value = 'error';
            }
        };
        socket.onclose = () => {
            if (ws !== socket || disposed) {
                return;
            }
            ws = null;
            scheduleReconnect();
        };
    }
    function sendMove(move, revision) {
        if (!ws || ws.readyState !== WebSocket.OPEN || !activeRoomId) {
            return;
        }
        ws.send(JSON.stringify({
            type: CheckersWs.move,
            roomId: activeRoomId,
            revision,
            from: move.from,
            to: move.to,
        }));
    }
    function restart() {
        if (!ws || ws.readyState !== WebSocket.OPEN || !activeRoomId) {
            return;
        }
        ws.send(JSON.stringify({ type: CheckersWs.restart, roomId: activeRoomId }));
    }
    function setMode(mode) {
        if (!ws || ws.readyState !== WebSocket.OPEN || !activeRoomId) {
            return;
        }
        ws.send(JSON.stringify({ type: CheckersWs.setMode, roomId: activeRoomId, mode }));
    }
    function setReady(ready) {
        if (!ws || ws.readyState !== WebSocket.OPEN || !activeRoomId) {
            return false;
        }
        ws.send(JSON.stringify({ type: CheckersWs.ready, roomId: activeRoomId, ready }));
        return true;
    }
    function setIdentity(displayName) {
        if (!ws || ws.readyState !== WebSocket.OPEN || !activeRoomId) {
            return false;
        }
        ws.send(JSON.stringify({ type: CheckersWs.identity, roomId: activeRoomId, displayName }));
        return true;
    }
    function timeoutTurn(revision) {
        if (!ws || ws.readyState !== WebSocket.OPEN || !activeRoomId) {
            return;
        }
        ws.send(JSON.stringify({ type: CheckersWs.timeout, roomId: activeRoomId, revision }));
    }
    function requestRematch() {
        if (!ws || ws.readyState !== WebSocket.OPEN || !activeRoomId) {
            return;
        }
        ws.send(JSON.stringify({ type: CheckersWs.rematch, roomId: activeRoomId }));
    }
    function dispose() {
        disposed = true;
        clearReconnect();
        closeCurrentSocket();
        activeRoomId = null;
        status.value = 'idle';
        lastServerPingAt.value = null;
    }
    return { status, lastServerPingAt, connect, sendMove, restart, setMode, setReady, setIdentity, timeoutTurn, requestRematch, dispose };
}
