import { createLogger } from '@/utils/logger';
import { apiUrl } from '@/utils/apiUrl';
import { readJsonIfOk } from '@/utils/apiFetch';
import { computed, onBeforeUnmount, ref, shallowRef, watch, } from 'vue';
import { replyJsonPingIfNeeded } from 'call-core/utils';
import { buildNadrawShowWsUrl } from '../url/nadrawWsUrl';
import { useNadrawAccess } from '../access/useNadrawAccess';
import { useI18n } from 'vue-i18n';
import { NadrawWs } from '../core/nadrawWsProtocol';
const log = createLogger('nadraw-show:orch');
const WS = NadrawWs;
function randomPeerId() {
    try {
        return crypto.randomUUID();
    }
    catch {
        return `nadraw-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
}
export function useNadrawShowOrchestrator(options) {
    const { route, streamerProfile, authLoaded, isAuthenticated } = options;
    const { t } = useI18n();
    const peerId = randomPeerId();
    const nadrawState = shallowRef(null);
    const sessionCanControl = ref(false);
    const chatLines = ref([]);
    const lastWsError = ref(null);
    const wsStatus = ref('idle');
    const lastServerPingAt = ref(null);
    const prompts = ref([]);
    const promptsLoading = ref(false);
    const nowTick = ref(Date.now());
    let ws = null;
    /** Streamer id the current socket was opened for (avoids duplicate connects + detects slug changes). */
    let wsTargetStreamerId = null;
    let disposed = false;
    let reconnectTimer = null;
    /** Increments on each scheduled reconnect; reset when the socket opens. */
    let reconnectAttempt = 0;
    let loggedWsErrorThisSocket = false;
    let lockTickTimer = null;
    let pingWatchTimer = null;
    const PING_STALE_MS = 60_000;
    const PING_WATCH_MS = 5_000;
    let lineUid = 0;
    let onCanvasClearHook = null;
    let onRemoteDrawHook = null;
    const effectiveSlug = computed(() => {
        const p = route.params.streamer;
        const s = typeof p === 'string' ? p : Array.isArray(p) ? p[0] : '';
        const t = String(s ?? '').trim().toLowerCase();
        return t.length > 0 ? t : null;
    });
    const { showHostChrome } = useNadrawAccess({
        sessionCanControl,
        authLoaded,
        isAuthenticated,
    });
    const wsLinkDot = computed(() => {
        if (wsStatus.value === 'reconnecting') {
            return 'reconnecting';
        }
        if (wsStatus.value !== 'open') {
            return 'offline';
        }
        const t = lastServerPingAt.value;
        if (t == null) {
            return 'connected';
        }
        if (Date.now() - t > PING_STALE_MS) {
            return 'reconnecting';
        }
        return 'connected';
    });
    function stopPingWatch() {
        if (pingWatchTimer) {
            clearInterval(pingWatchTimer);
            pingWatchTimer = null;
        }
    }
    function startPingWatch(socket) {
        stopPingWatch();
        lastServerPingAt.value = Date.now();
        pingWatchTimer = setInterval(() => {
            if (disposed || !ws || ws !== socket || ws.readyState !== WebSocket.OPEN) {
                return;
            }
            const t = lastServerPingAt.value;
            if (t != null && Date.now() - t > PING_STALE_MS) {
                log.warn('[nadraw-ws] server ping stale; closing to reconnect');
                try {
                    socket.close();
                }
                catch {
                    /* ignore */
                }
            }
        }, PING_WATCH_MS);
    }
    function pushLine(line) {
        lineUid += 1;
        chatLines.value = [
            ...chatLines.value.slice(-400),
            { id: line.id ?? `L${lineUid}`, userId: line.userId, displayName: line.displayName, text: line.text, system: line.system },
        ];
    }
    function appendFeedback(f) {
        let msg = '';
        if (f.kind === 'rate_limit') {
            msg = t('nadrawShow.feedbackRateLimit');
        }
        else if (f.kind === 'guess_locked') {
            msg = t('nadrawShow.feedbackGuessLocked');
        }
        else if (f.kind === 'win') {
            msg = t('nadrawShow.feedbackWin', { name: f.displayName });
        }
        else if (f.kind === 'wrong') {
            msg = t('nadrawShow.feedbackWrong');
        }
        else if (f.kind === 'heat') {
            const h = f.heat ?? 'cold';
            msg = t('nadrawShow.feedbackHeat', { name: f.displayName, text: f.text, heat: h });
        }
        if (msg) {
            pushLine({ userId: f.userId, displayName: f.displayName, text: msg, system: true });
        }
    }
    function applyHistory(payload) {
        chatLines.value = [];
        lineUid = 0;
        for (const event of payload.chatEvents ?? []) {
            if (event.kind === 'chat') {
                pushLine({ userId: event.userId, displayName: event.displayName, text: event.text });
            }
            else {
                appendFeedback({ ...event, kind: event.feedbackKind });
            }
        }
        onCanvasClearHook?.();
        for (const op of payload.drawOps ?? []) {
            onRemoteDrawHook?.(op);
        }
    }
    function clearReconnect() {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    }
    const MAX_RECONNECT_MS = 10_000;
    const BASE_RECONNECT_MS = 800;
    function nextReconnectDelayMs() {
        const exp = BASE_RECONNECT_MS * Math.pow(2, reconnectAttempt);
        return Math.min(MAX_RECONNECT_MS, exp);
    }
    function scheduleReconnect() {
        clearReconnect();
        if (disposed) {
            return;
        }
        wsStatus.value = 'reconnecting';
        const delay = nextReconnectDelayMs();
        reconnectAttempt += 1;
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            if (disposed) {
                return;
            }
            connectWs(true);
        }, delay);
    }
    /** Tear down the socket without triggering reconnect (intentional replace or logout). */
    function silentCloseWs() {
        stopPingWatch();
        if (!ws) {
            wsTargetStreamerId = null;
            return;
        }
        const s = ws;
        ws = null;
        wsTargetStreamerId = null;
        s.onopen = null;
        s.onmessage = null;
        s.onerror = null;
        s.onclose = null;
        try {
            s.close();
        }
        catch {
            /* ignore */
        }
    }
    function disposeWs() {
        disposed = true;
        clearReconnect();
        reconnectAttempt = 0;
        if (lockTickTimer) {
            clearInterval(lockTickTimer);
            lockTickTimer = null;
        }
        stopPingWatch();
        lastServerPingAt.value = null;
        silentCloseWs();
        wsStatus.value = 'idle';
    }
    function connectWs(fromScheduledReconnect = false) {
        const id = streamerProfile.value?.id;
        if (!id || disposed) {
            return;
        }
        if (ws && ws.readyState === WebSocket.OPEN && wsTargetStreamerId === id) {
            return;
        }
        if (ws && ws.readyState === WebSocket.CONNECTING && wsTargetStreamerId === id) {
            return;
        }
        if (!fromScheduledReconnect) {
            reconnectAttempt = 0;
        }
        clearReconnect();
        silentCloseWs();
        const url = buildNadrawShowWsUrl(id, peerId);
        log.info('[nadraw-ws] connecting', { url });
        loggedWsErrorThisSocket = false;
        const s = new WebSocket(url);
        ws = s;
        wsTargetStreamerId = id;
        wsStatus.value = 'reconnecting';
        s.onopen = () => {
            if (disposed || ws !== s) {
                return;
            }
            reconnectAttempt = 0;
            wsStatus.value = 'open';
            lastWsError.value = null;
            startPingWatch(s);
        };
        s.onmessage = (ev) => {
            if (disposed || ws !== s) {
                return;
            }
            let data;
            try {
                data = JSON.parse(String(ev.data));
            }
            catch {
                return;
            }
            if (data && typeof data === 'object' && data.type === 'ping') {
                lastServerPingAt.value = Date.now();
            }
            if (replyJsonPingIfNeeded(data, s)) {
                return;
            }
            if (!data || typeof data !== 'object') {
                return;
            }
            const o = data;
            if (o.type === WS.state && o.payload && typeof o.payload === 'object') {
                nadrawState.value = o.payload;
                return;
            }
            if (o.type === WS.session && o.payload && typeof o.payload === 'object') {
                const p = o.payload;
                sessionCanControl.value = p.canControl === true;
                return;
            }
            if (o.type === WS.twitchChat && o.payload && typeof o.payload === 'object') {
                const p = o.payload;
                pushLine({ userId: p.userId, displayName: p.displayName, text: p.text });
                return;
            }
            if (o.type === WS.guessFeedback && o.payload && typeof o.payload === 'object') {
                appendFeedback(o.payload);
                return;
            }
            if (o.type === WS.history && o.payload && typeof o.payload === 'object') {
                applyHistory(o.payload);
                return;
            }
            if (o.type === WS.canvasClear) {
                onCanvasClearHook?.();
                return;
            }
            if (o.type === WS.draw && o.payload && typeof o.payload === 'object') {
                onRemoteDrawHook?.(o.payload);
                return;
            }
            if (o.type === WS.error && o.payload && typeof o.payload === 'object') {
                const p = o.payload;
                lastWsError.value = typeof p.message === 'string' ? p.message : 'Server error';
            }
        };
        s.onerror = () => {
            if (disposed || ws !== s) {
                return;
            }
            if (!loggedWsErrorThisSocket) {
                loggedWsErrorThisSocket = true;
                log.warn('nadraw ws connection error', { streamerId: id.slice(0, 8) });
            }
            lastWsError.value = 'WebSocket error';
        };
        s.onclose = () => {
            if (disposed) {
                return;
            }
            if (ws !== s) {
                return;
            }
            stopPingWatch();
            ws = null;
            wsTargetStreamerId = null;
            scheduleReconnect();
        };
    }
    function startRound(wordSource, manualWord, roundDurationSec, roundsPlanned) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            return;
        }
        const payload = {
            type: WS.hostStartRound,
            wordSource,
        };
        if (typeof manualWord === 'string' && manualWord.length > 0) {
            payload.manualWord = manualWord;
        }
        if (typeof roundDurationSec === 'number' && Number.isFinite(roundDurationSec)) {
            payload.roundDurationSec = roundDurationSec;
        }
        if (typeof roundsPlanned === 'number' && Number.isFinite(roundsPlanned)) {
            payload.roundsPlanned = roundsPlanned;
        }
        ws.send(JSON.stringify(payload));
    }
    function clearRound() {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            return;
        }
        ws.send(JSON.stringify({ type: WS.hostClearRound }));
    }
    function clearCanvasOnly() {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            return;
        }
        ws.send(JSON.stringify({ type: WS.hostClearCanvas }));
    }
    function ackNextRound(word) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            return;
        }
        const payload = {
            type: WS.hostAckNextRound,
        };
        if (typeof word === 'string' && word.length > 0) {
            payload.word = word;
        }
        ws.send(JSON.stringify(payload));
    }
    function drawPayload(phase, strokeId, x, y, meta) {
        const m = meta ?? { color: '#111827', lineWidth: 3, erase: false };
        const base = {
            type: WS.hostDraw,
            phase,
            strokeId,
            x,
            y,
            lineWidth: m.lineWidth,
            erase: m.erase === true,
        };
        if (!m.erase && typeof m.color === 'string') {
            base.color = m.color;
        }
        if (m.op != null && m.op !== 'stroke') {
            base.op = m.op;
        }
        if (typeof m.x2 === 'number' && Number.isFinite(m.x2)) {
            base.x2 = m.x2;
        }
        if (typeof m.y2 === 'number' && Number.isFinite(m.y2)) {
            base.y2 = m.y2;
        }
        return base;
    }
    function sendDrawStart(strokeId, x, y, meta) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            return;
        }
        ws.send(JSON.stringify(drawPayload('start', strokeId, x, y, meta)));
    }
    function sendDrawMove(strokeId, x, y, meta) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            return;
        }
        ws.send(JSON.stringify(drawPayload('move', strokeId, x, y, meta)));
    }
    function sendDrawEnd(strokeId, x, y, meta) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            return;
        }
        ws.send(JSON.stringify(drawPayload('end', strokeId, x, y, meta)));
    }
    function onCanvasClear(fn) {
        onCanvasClearHook = fn;
    }
    function onRemoteDraw(fn) {
        onRemoteDrawHook = fn;
    }
    async function loadPrompts() {
        const sid = streamerProfile.value?.id;
        if (!sid || !sessionCanControl.value) {
            prompts.value = [];
            return;
        }
        promptsLoading.value = true;
        try {
            const res = await fetch(apiUrl(`/api/nadraw-show/prompts?streamerId=${encodeURIComponent(sid)}`), {
                credentials: 'include',
            });
            if (!res.ok) {
                prompts.value = [];
                return;
            }
            const body = await readJsonIfOk(res);
            prompts.value = body?.prompts ?? [];
        }
        catch {
            prompts.value = [];
        }
        finally {
            promptsLoading.value = false;
        }
    }
    async function approvePrompt(id, approved) {
        const sid = streamerProfile.value?.id;
        if (!sid) {
            return;
        }
        try {
            const res = await fetch(apiUrl(`/api/nadraw-show/prompts/${encodeURIComponent(id)}`), {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ streamerId: sid, approved }),
            });
            if (res.ok) {
                await loadPrompts();
            }
        }
        catch {
            /* ignore */
        }
    }
    async function deletePrompt(id) {
        const sid = streamerProfile.value?.id;
        if (!sid) {
            return;
        }
        try {
            const res = await fetch(apiUrl(`/api/nadraw-show/prompts/${encodeURIComponent(id)}?streamerId=${encodeURIComponent(sid)}`), { method: 'DELETE', credentials: 'include' });
            if (res.ok || res.status === 204) {
                await loadPrompts();
            }
        }
        catch {
            /* ignore */
        }
    }
    watch(() => nadrawState.value?.phase, (ph) => {
        if (lockTickTimer) {
            clearInterval(lockTickTimer);
            lockTickTimer = null;
        }
        if (ph === 'drawing_locked' || ph === 'drawing_active') {
            nowTick.value = Date.now();
            lockTickTimer = setInterval(() => {
                nowTick.value = Date.now();
            }, 1000);
        }
    });
    watch([streamerProfile, authLoaded], () => {
        if (!streamerProfile.value || !authLoaded.value) {
            clearReconnect();
            reconnectAttempt = 0;
            stopPingWatch();
            lastServerPingAt.value = null;
            silentCloseWs();
            wsStatus.value = 'idle';
            return;
        }
        disposed = false;
        connectWs();
    }, { immediate: true });
    watch(showHostChrome, (v) => {
        if (v) {
            void loadPrompts();
        }
    });
    onBeforeUnmount(() => {
        disposeWs();
    });
    return {
        nadrawState,
        sessionCanControl,
        chatLines,
        lastWsError,
        wsStatus,
        lastServerPingAt,
        wsLinkDot,
        prompts,
        promptsLoading,
        nowTick,
        showHostChrome,
        connectWs,
        disposeWs,
        startRound,
        clearRound,
        clearCanvasOnly,
        ackNextRound,
        sendDrawStart,
        sendDrawMove,
        sendDrawEnd,
        onCanvasClear,
        onRemoteDraw,
        loadPrompts,
        approvePrompt,
        deletePrompt,
        effectiveSlug,
    };
}
