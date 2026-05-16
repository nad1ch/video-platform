import { storeToRefs } from 'pinia';
import { onBeforeUnmount, nextTick, ref, watch } from 'vue';
import { useCallSessionStore } from 'call-core';
import { useMafiaGameStore } from '@/stores/mafiaGame';
import { useMafiaViewMode } from '@/composables/mafiaStreamViewRoute';
import { MafiaWs } from './mafiaWsProtocol';
function normalizeMafiaSpeakingQueueFlat(raw) {
    if (!Array.isArray(raw)) {
        return [];
    }
    const out = [];
    for (const x of raw) {
        if (typeof x === 'number' && Number.isInteger(x) && x >= 1) {
            out.push(x);
            if (out.length >= 24)
                break;
        }
    }
    if (out.length % 2 === 1) {
        out.pop();
    }
    return out;
}
function parseMafiaHostUpdated(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }
    const o = data;
    if (o.type !== MafiaWs.hostUpdated) {
        return null;
    }
    const p = o.payload;
    if (!p || typeof p !== 'object') {
        return null;
    }
    const h = p.hostPeerId;
    const u = p.hostUserId;
    const s = p.hostSessionId;
    const hostPeerId = typeof h === 'string' && h.length > 0 ? h : null;
    const hostUserId = typeof u === 'string' && u.length > 0 ? u : null;
    const hostSessionId = typeof s === 'string' && s.length > 0 ? s : null;
    if (h === null || hostPeerId != null || hostUserId != null || hostSessionId != null) {
        return { hostPeerId, hostUserId, hostSessionId };
    }
    return null;
}
function parseMafiaQueueUpdate(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }
    const o = data;
    if (o.type !== MafiaWs.queueUpdate) {
        return null;
    }
    const p = o.payload;
    if (!p || typeof p !== 'object') {
        return null;
    }
    const q = p.speakingQueue;
    if (!Array.isArray(q)) {
        return null;
    }
    const out = normalizeMafiaSpeakingQueueFlat(q);
    return { speakingQueue: out };
}
const MAFIA_ROLES = new Set(['mafia', 'don', 'sheriff', 'doctor', 'civilian']);
function parseMafiaReshuffle(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }
    const o = data;
    if (o.type !== MafiaWs.reshuffle) {
        return null;
    }
    const p = o.payload;
    if (!p || typeof p !== 'object') {
        return null;
    }
    const players = p.players;
    if (!Array.isArray(players) || players.length < 1) {
        return null;
    }
    const out = [];
    for (let i = 0; i < players.length; i += 1) {
        const row = players[i];
        if (!row || typeof row !== 'object') {
            return null;
        }
        const r = row;
        if (typeof r.peerId !== 'string' || r.peerId.length < 1) {
            return null;
        }
        if (typeof r.seat !== 'number' || !Number.isInteger(r.seat) || r.seat !== i + 1) {
            return null;
        }
        const isLastSeat = i === players.length - 1;
        if (r.role == null) {
            if (!isLastSeat) {
                return null;
            }
            out.push({ peerId: r.peerId, seat: r.seat, role: null });
            continue;
        }
        if (typeof r.role !== 'string' || !MAFIA_ROLES.has(r.role)) {
            return null;
        }
        out.push({ peerId: r.peerId, seat: r.seat, role: r.role });
    }
    return { players: out };
}
const NIGHT_ACTION_KEYS = ['mafia', 'doctor', 'sheriff', 'don'];
function parseMafiaPlayersUpdate(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }
    const o = data;
    if (o.type !== MafiaWs.playersUpdate) {
        return null;
    }
    const p = o.payload;
    if (!p || typeof p !== 'object') {
        return null;
    }
    const order = p.order;
    if (!Array.isArray(order) || order.length < 1) {
        return null;
    }
    const outOrder = [];
    for (const id of order) {
        if (typeof id !== 'string' || id.length < 1) {
            return null;
        }
        outOrder.push(id);
    }
    const sq = p.speakingQueue;
    if (!Array.isArray(sq)) {
        return null;
    }
    const outQ = normalizeMafiaSpeakingQueueFlat(sq);
    const naRaw = p.nightActions;
    const nightActions = {};
    if (naRaw && typeof naRaw === 'object') {
        for (const k of NIGHT_ACTION_KEYS) {
            const v = naRaw[k];
            if (v != null && typeof v === 'number' && Number.isInteger(v) && v >= 1) {
                nightActions[k] = v;
            }
        }
    }
    const clearRoles = p.clearRoles;
    const oldMode = p.oldMafiaMode;
    return {
        order: outOrder,
        nightActions,
        speakingQueue: outQ,
        ...(clearRoles === true ? { clearRoles: true } : {}),
        ...(typeof oldMode === 'boolean' ? { oldMafiaMode: oldMode } : {}),
    };
}
function parseMafiaModeUpdate(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }
    const o = data;
    if (o.type !== MafiaWs.modeUpdate) {
        return null;
    }
    const p = o.payload;
    if (!p || typeof p !== 'object') {
        return null;
    }
    const mode = p.mode;
    return mode === 'old' || mode === 'new' ? { mode } : null;
}
function parseMafiaSettingsUpdate(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }
    const o = data;
    if (o.type !== MafiaWs.settingsUpdate) {
        return null;
    }
    const p = o.payload;
    if (!p || typeof p !== 'object') {
        return null;
    }
    const rawBackgrounds = p.deadBackgrounds;
    if (!Array.isArray(rawBackgrounds)) {
        return null;
    }
    const deadBackgrounds = [];
    for (const raw of rawBackgrounds) {
        if (!raw || typeof raw !== 'object') {
            continue;
        }
        const item = raw;
        if (typeof item.id !== 'string' || item.id.length < 1) {
            continue;
        }
        if (typeof item.url !== 'string' || item.url.length < 1 || item.url.length > 7_000_000) {
            continue;
        }
        if (item.type !== 'preset' && item.type !== 'custom') {
            continue;
        }
        deadBackgrounds.push({ id: item.id, url: item.url, type: item.type });
    }
    const activeBackgroundId = p.activeBackgroundId;
    return {
        deadBackgrounds,
        activeBackgroundId: typeof activeBackgroundId === 'string' ? activeBackgroundId : null,
    };
}
function parseBackgroundItem(raw) {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const item = raw;
    if (typeof item.id !== 'string' || item.id.length < 1) {
        return null;
    }
    if (typeof item.url !== 'string' || item.url.length < 1 || item.url.length > 7_000_000) {
        return null;
    }
    if (item.type !== 'default' && item.type !== 'preset' && item.type !== 'custom') {
        return null;
    }
    return { id: item.id, url: item.url, type: item.type };
}
function parseMafiaPageBackgroundSettings(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }
    const o = data;
    if (o.type !== MafiaWs.pageBackgroundSettings) {
        return null;
    }
    const p = o.payload;
    if (!p || typeof p !== 'object') {
        return null;
    }
    const rawBackgrounds = p.backgrounds;
    if (!Array.isArray(rawBackgrounds)) {
        return null;
    }
    const backgrounds = rawBackgrounds
        .map(parseBackgroundItem)
        .filter((item) => item != null);
    const selectedBackgroundId = p.selectedBackgroundId;
    const forcedBackgroundId = p.forcedBackgroundId;
    return {
        backgrounds,
        selectedBackgroundId: typeof selectedBackgroundId === 'string' ? selectedBackgroundId : null,
        forcedBackgroundId: typeof forcedBackgroundId === 'string' ? forcedBackgroundId : null,
    };
}
function parseMafiaTimerStart(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }
    const o = data;
    if (o.type !== MafiaWs.timerStart) {
        return null;
    }
    const p = o.payload;
    if (!p || typeof p !== 'object') {
        return null;
    }
    const s = p.startedAt;
    const d = p.duration;
    if (typeof s !== 'number' || !Number.isFinite(s)) {
        return null;
    }
    if (typeof d !== 'number' || !Number.isFinite(d) || d < 1000) {
        return null;
    }
    const run = p.isRunning;
    const isRunning = run === false ? false : true;
    return { startedAt: s, duration: d, isRunning };
}
function parseMafiaTimerStop(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }
    const o = data;
    if (o.type !== MafiaWs.timerStop) {
        return null;
    }
    if (o.payload === undefined || o.payload === null) {
        return {};
    }
    if (typeof o.payload !== 'object' || Object.keys(o.payload).length > 0) {
        return null;
    }
    return {};
}
function parseMafiaTimerPresetSelect(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }
    const o = data;
    if (o.type !== MafiaWs.timerPresetSelect) {
        return null;
    }
    const p = o.payload;
    if (!p || typeof p !== 'object') {
        return null;
    }
    const ms = p.durationMs;
    if (typeof ms !== 'number' || !Number.isFinite(ms)) {
        return null;
    }
    return Math.floor(ms);
}
function parseMafiaPlayerKick(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }
    const o = data;
    if (o.type !== MafiaWs.playerKick) {
        return null;
    }
    const p = o.payload;
    if (!p || typeof p !== 'object') {
        return null;
    }
    const id = p.peerId;
    if (typeof id !== 'string' || id.length < 1) {
        return null;
    }
    return { peerId: id };
}
function parseMafiaPlayerRevive(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }
    const o = data;
    if (o.type !== MafiaWs.playerRevive) {
        return null;
    }
    const p = o.payload;
    if (!p || typeof p !== 'object') {
        return null;
    }
    const id = p.peerId;
    if (typeof id !== 'string' || id.length < 1) {
        return null;
    }
    return { peerId: id };
}
function parseMafiaForceMuteAll(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }
    const o = data;
    if (o.type !== MafiaWs.forceMuteAll) {
        return null;
    }
    const p = o.payload;
    if (!p || typeof p !== 'object') {
        return null;
    }
    const m = p.muted;
    return { muted: m !== false };
}
function parseMafiaPlayerLifeStateSnapshot(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }
    const o = data;
    if (o.type !== MafiaWs.playerLifeState) {
        return null;
    }
    const p = o.payload;
    if (!p || typeof p !== 'object') {
        return null;
    }
    const states = p.states;
    if (!states || typeof states !== 'object' || Array.isArray(states)) {
        return null;
    }
    const out = {};
    for (const [peerId, state] of Object.entries(states)) {
        if (typeof peerId !== 'string' || peerId.length < 1) {
            continue;
        }
        if (state === 'dead' || state === 'ghost' || state === 'alive') {
            out[peerId] = state;
        }
    }
    return { states: out };
}
/**
 * Mafia “ведучий” — one per signaling room, via `mafia:claim-host` / `mafia:host-updated` on the call WebSocket.
 * Shared `speakingQueue` is sent by the host as `mafia:queue-update` and applied for all clients (including host echo).
 */
export function useMafiaHostSignaling(sendSignalingMessage, subscribeSignalingMessage, wsStatus) {
    const mafia = useMafiaGameStore();
    const { mafiaHostPeerId, mafiaHostUserId, mafiaHostSessionId, localMafiaSessionId, localMafiaUserId, speakingQueue, isMafiaHost, reshuffleBroadcastPayload, playersUpdateBroadcastPayload, applyingPlayersUpdateFromSignaling, timerStartBroadcastPayload, timerStopBroadcastPayload, timerPresetSelectBroadcastPayload, kickBroadcastPayload, reviveBroadcastPayload, eatFirstCallEliminationHost, modeUpdateBroadcastPayload, settingsUpdateBroadcastPayload, pageBackgroundSettingsBroadcastPayload, } = storeToRefs(mafia);
    const session = useCallSessionStore();
    const { inCall, selfPeerId } = storeToRefs(session);
    /** While true, do not re-send `mafia:queue-update` (remote / echo apply). */
    const applyingQueueFromSignaling = ref(false);
    // OBS / `?mode=view` page must be display-only and never claim host
    // (P0 Bug 2). The gate is read inside the watcher below; reading the
    // route here keeps it reactive across same-component view-mode toggles.
    const { isViewMode } = useMafiaViewMode();
    const off = subscribeSignalingMessage((data) => {
        const hostParsed = parseMafiaHostUpdated(data);
        if (hostParsed) {
            mafia.setMafiaHostFromSignaling(hostParsed.hostPeerId, hostParsed.hostUserId, hostParsed.hostSessionId);
        }
        const queueParsed = parseMafiaQueueUpdate(data);
        if (queueParsed) {
            applyingQueueFromSignaling.value = true;
            mafia.applySpeakingQueueFromSignaling(queueParsed.speakingQueue);
            // The host's broadcast dedupe (`lastSentQueueKey`) tracks what THIS tab
            // last sent. When the server replaces local queue state (snapshot replay,
            // another host's broadcast received after a transfer-back), our cached
            // key no longer reflects what receivers actually have. Invalidate so the
            // next local mutation always broadcasts even if it happens to match the
            // stale cached key.
            lastSentQueueKey = null;
            void nextTick(() => {
                applyingQueueFromSignaling.value = false;
            });
        }
        const reshuffleParsed = parseMafiaReshuffle(data);
        if (reshuffleParsed) {
            mafia.applyMafiaReshuffleFromSignaling(reshuffleParsed);
        }
        const playersParsed = parseMafiaPlayersUpdate(data);
        if (playersParsed) {
            applyingPlayersUpdateFromSignaling.value = true;
            mafia.applyMafiaPlayersUpdateFromSignaling(playersParsed);
            void nextTick(() => {
                applyingPlayersUpdateFromSignaling.value = false;
            });
        }
        const modeParsed = parseMafiaModeUpdate(data);
        if (modeParsed) {
            mafia.applyMafiaModeFromSignaling(modeParsed);
        }
        const settingsParsed = parseMafiaSettingsUpdate(data);
        if (settingsParsed && !isMafiaHost.value) {
            mafia.applyMafiaSettingsUpdateFromSignaling(settingsParsed);
        }
        const pageBackgroundParsed = parseMafiaPageBackgroundSettings(data);
        if (pageBackgroundParsed && !isMafiaHost.value) {
            mafia.applyMafiaPageBackgroundSettingsFromSignaling(pageBackgroundParsed);
        }
        const timerParsed = parseMafiaTimerStart(data);
        if (timerParsed) {
            mafia.applyMafiaTimerFromSignaling(timerParsed);
        }
        if (parseMafiaTimerStop(data) != null) {
            mafia.applyMafiaTimerStopFromSignaling();
        }
        const presetParsed = parseMafiaTimerPresetSelect(data);
        if (presetParsed != null) {
            mafia.applyMafiaTimerPresetSelectFromSignaling(presetParsed);
        }
        const kickParsed = parseMafiaPlayerKick(data);
        if (kickParsed) {
            mafia.applyMafiaKickFromSignaling(kickParsed);
        }
        const reviveParsed = parseMafiaPlayerRevive(data);
        if (reviveParsed) {
            mafia.applyMafiaReviveFromSignaling(reviveParsed);
        }
        const lifeStateParsed = parseMafiaPlayerLifeStateSnapshot(data);
        if (lifeStateParsed) {
            mafia.applyMafiaPlayerLifeStateSnapshotFromSignaling(lifeStateParsed);
        }
        const forceMuteAllParsed = parseMafiaForceMuteAll(data);
        if (forceMuteAllParsed) {
            mafia.setMafiaForceMuteAllActiveFromSignaling(forceMuteAllParsed.muted);
        }
    });
    onBeforeUnmount(off);
    watch([inCall, mafiaHostPeerId, mafiaHostUserId, mafiaHostSessionId, localMafiaSessionId, localMafiaUserId, selfPeerId, wsStatus], () => {
        if (!inCall.value) {
            mafia.setMafiaHostFromSignaling(null, null, null);
            return;
        }
        if (wsStatus.value !== 'open') {
            return;
        }
        // Hard gate: OBS / `?mode=view` is display-only. Even if the same user
        // is opening the OBS tab, the claim must come from the participant tab,
        // not the view tab — otherwise the participant peer loses host on
        // session-id rebind to the view tab's session.
        if (isViewMode.value) {
            return;
        }
        const sid = selfPeerId.value;
        if (typeof sid !== 'string' || sid.length === 0) {
            return;
        }
        const localUserId = localMafiaUserId.value;
        const localSessionId = localMafiaSessionId.value;
        if (typeof localUserId !== 'string' || localUserId.length === 0 || localSessionId.length === 0) {
            return;
        }
        if (mafiaHostUserId.value != null && mafiaHostUserId.value !== localUserId) {
            return;
        }
        sendSignalingMessage({ type: MafiaWs.claimHost, payload: { sessionId: localSessionId } });
    }, { immediate: true });
    /**
     * `speakingQueue` deep watch fires on every array mutation; in active play
     * with 8-12 cameras the host can produce 3-5 mutations per second
     * (nominations, reorder, mid-mutation re-emits). The previous code sent
     * one `mafia:queue-update` WS frame per fire, with no dedupe. Over a
     * 3-hour stream that adds up to thousands of redundant frames on the host
     * tab and matching apply work on every receiver.
     *
     * Trailing 75 ms debounce + shallow-equal cache: the watcher still fires
     * synchronously, but we only send when the snapshot has settled and the
     * payload differs from the last broadcast. Game logic is unchanged — the
     * receiver applies the same final state. Re-entry guards
     * (`applyingQueueFromSignaling`, `applyingPlayersUpdateFromSignaling`)
     * still short-circuit before scheduling.
     */
    const QUEUE_BROADCAST_DEBOUNCE_MS = 75;
    let queueBroadcastTimer = null;
    let lastSentQueueKey = null;
    function flushQueueBroadcast() {
        queueBroadcastTimer = null;
        if (!inCall.value)
            return;
        if (wsStatus.value !== 'open')
            return;
        if (!isMafiaHost.value)
            return;
        const snapshot = [...speakingQueue.value];
        const key = snapshot.join(',');
        if (key === lastSentQueueKey)
            return;
        lastSentQueueKey = key;
        sendSignalingMessage({ type: MafiaWs.queueUpdate, payload: { speakingQueue: snapshot } });
    }
    function scheduleQueueBroadcast() {
        if (queueBroadcastTimer != null)
            return;
        queueBroadcastTimer = setTimeout(flushQueueBroadcast, QUEUE_BROADCAST_DEBOUNCE_MS);
    }
    watch(speakingQueue, (next) => {
        if (applyingQueueFromSignaling.value || applyingPlayersUpdateFromSignaling.value) {
            return;
        }
        if (!inCall.value) {
            return;
        }
        if (wsStatus.value !== 'open') {
            return;
        }
        if (!isMafiaHost.value) {
            return;
        }
        // Shallow-equal short-circuit BEFORE scheduling the trailing debounce.
        // Without this, a watcher fired by a same-value mutation (e.g. an
        // upstream array spread that produced an identical sequence) still
        // installed a setTimeout, paid the rAF/macrotask cost, and only
        // dropped the send inside `flushQueueBroadcast`. With it, no timer
        // is set at all when the queue genuinely did not change. The flush
        // path keeps the same equality check as a defensive net.
        if (queueBroadcastTimer == null) {
            const snapshot = Array.isArray(next) ? next : [...speakingQueue.value];
            if (snapshot.join(',') === lastSentQueueKey) {
                return;
            }
        }
        scheduleQueueBroadcast();
    }, { deep: true });
    onBeforeUnmount(() => {
        if (queueBroadcastTimer != null) {
            clearTimeout(queueBroadcastTimer);
            queueBroadcastTimer = null;
        }
    });
    /**
     * OBS / `?mode=view` snapshot recovery: ask the server to re-emit the full
     * Mafia snapshot block whenever this socket transitions `closed → open`
     * after the initial join. The server already sends the snapshot from
     * `handleJoinRoom`, so the first transition is a no-op redundancy
     * (idempotent on the apply side); subsequent reconnects that did not
     * re-trigger `join-room` (transient flap, browser-source quirk) finally
     * get a fresh snapshot without forcing a page reload.
     *
     * Gated by `isViewMode` so OBS is the only sender — regular participants
     * already get state through the normal host broadcast loop.
     */
    let lastWsStatus = null;
    watch([wsStatus, isViewMode], ([wsNow, viewNow]) => {
        const prev = lastWsStatus;
        lastWsStatus = wsNow;
        // `isViewMode` is route-gated to `name === 'mafia'`, so this watcher
        // is implicitly Mafia-only. No-op for regular participants and OBS
        // before the first WS open (initial join already replays).
        if (!viewNow)
            return;
        if (wsNow !== 'open')
            return;
        if (prev === 'open' || prev == null)
            return;
        sendSignalingMessage({ type: MafiaWs.requestSnapshot });
    }, { immediate: true });
    watch([reshuffleBroadcastPayload, inCall, wsStatus, isMafiaHost], ([p, inCallNow, wsNow, isHostNow]) => {
        if (p == null) {
            return;
        }
        if (!inCallNow || wsNow !== 'open' || !isHostNow) {
            // Keep pending payload: send after reconnect/focus resync when socket reopens.
            return;
        }
        sendSignalingMessage({ type: MafiaWs.reshuffle, payload: p });
        mafia.clearReshuffleBroadcastPayload();
    }, { flush: 'post' });
    watch([playersUpdateBroadcastPayload, inCall, wsStatus, isMafiaHost], ([p, inCallNow, wsNow, isHostNow]) => {
        if (p == null) {
            return;
        }
        if (!inCallNow || wsNow !== 'open' || !isHostNow) {
            // Keep pending payload: send after reconnect/focus resync when socket reopens.
            return;
        }
        sendSignalingMessage({ type: MafiaWs.playersUpdate, payload: p });
        mafia.clearPlayersUpdateBroadcastPayload();
    }, { flush: 'post' });
    watch(modeUpdateBroadcastPayload, (p) => {
        if (p == null) {
            return;
        }
        if (!inCall.value) {
            mafia.clearModeUpdateBroadcastPayload();
            return;
        }
        if (wsStatus.value !== 'open') {
            mafia.clearModeUpdateBroadcastPayload();
            return;
        }
        if (!isMafiaHost.value) {
            mafia.clearModeUpdateBroadcastPayload();
            return;
        }
        sendSignalingMessage({ type: MafiaWs.modeUpdate, payload: p });
        mafia.clearModeUpdateBroadcastPayload();
    }, { flush: 'post' });
    watch(settingsUpdateBroadcastPayload, (p) => {
        if (p == null) {
            return;
        }
        if (!inCall.value) {
            mafia.clearSettingsUpdateBroadcastPayload();
            return;
        }
        if (wsStatus.value !== 'open') {
            mafia.clearSettingsUpdateBroadcastPayload();
            return;
        }
        if (!isMafiaHost.value) {
            mafia.clearSettingsUpdateBroadcastPayload();
            return;
        }
        sendSignalingMessage({ type: MafiaWs.settingsUpdate, payload: p });
        mafia.clearSettingsUpdateBroadcastPayload();
    }, { flush: 'post' });
    watch(pageBackgroundSettingsBroadcastPayload, (p) => {
        if (p == null) {
            return;
        }
        if (!inCall.value) {
            mafia.clearPageBackgroundSettingsBroadcastPayload();
            return;
        }
        if (wsStatus.value !== 'open') {
            mafia.clearPageBackgroundSettingsBroadcastPayload();
            return;
        }
        if (!isMafiaHost.value) {
            mafia.clearPageBackgroundSettingsBroadcastPayload();
            return;
        }
        sendSignalingMessage({ type: MafiaWs.pageBackgroundSettings, payload: p });
        mafia.clearPageBackgroundSettingsBroadcastPayload();
    }, { flush: 'post' });
    watch(timerStartBroadcastPayload, (p) => {
        if (p == null) {
            return;
        }
        if (!inCall.value) {
            mafia.clearTimerStartBroadcastPayload();
            return;
        }
        if (wsStatus.value !== 'open') {
            mafia.clearTimerStartBroadcastPayload();
            return;
        }
        if (!isMafiaHost.value) {
            mafia.clearTimerStartBroadcastPayload();
            return;
        }
        sendSignalingMessage({ type: MafiaWs.timerStart, payload: p });
        mafia.clearTimerStartBroadcastPayload();
    }, { flush: 'post' });
    watch(timerStopBroadcastPayload, (p) => {
        if (p == null) {
            return;
        }
        if (!inCall.value) {
            mafia.clearTimerStopBroadcastPayload();
            return;
        }
        if (wsStatus.value !== 'open') {
            mafia.clearTimerStopBroadcastPayload();
            return;
        }
        if (!isMafiaHost.value) {
            mafia.clearTimerStopBroadcastPayload();
            return;
        }
        sendSignalingMessage({ type: MafiaWs.timerStop, payload: {} });
        mafia.clearTimerStopBroadcastPayload();
    }, { flush: 'post' });
    watch(timerPresetSelectBroadcastPayload, (durationMs) => {
        if (durationMs == null) {
            return;
        }
        if (!inCall.value) {
            mafia.clearTimerPresetSelectBroadcastPayload();
            return;
        }
        if (wsStatus.value !== 'open') {
            mafia.clearTimerPresetSelectBroadcastPayload();
            return;
        }
        if (!isMafiaHost.value) {
            mafia.clearTimerPresetSelectBroadcastPayload();
            return;
        }
        sendSignalingMessage({
            type: MafiaWs.timerPresetSelect,
            payload: { durationMs },
        });
        mafia.clearTimerPresetSelectBroadcastPayload();
    }, { flush: 'post' });
    watch(kickBroadcastPayload, (p) => {
        if (p == null) {
            return;
        }
        if (!inCall.value) {
            mafia.clearKickBroadcastPayload();
            return;
        }
        if (wsStatus.value !== 'open') {
            mafia.clearKickBroadcastPayload();
            return;
        }
        if (!isMafiaHost.value && !eatFirstCallEliminationHost.value) {
            mafia.clearKickBroadcastPayload();
            return;
        }
        sendSignalingMessage({ type: MafiaWs.playerKick, payload: p });
        mafia.clearKickBroadcastPayload();
    }, { flush: 'post' });
    watch(reviveBroadcastPayload, (p) => {
        if (p == null) {
            return;
        }
        if (!inCall.value) {
            mafia.clearReviveBroadcastPayload();
            return;
        }
        if (wsStatus.value !== 'open') {
            mafia.clearReviveBroadcastPayload();
            return;
        }
        if (!isMafiaHost.value && !eatFirstCallEliminationHost.value) {
            mafia.clearReviveBroadcastPayload();
            return;
        }
        sendSignalingMessage({ type: MafiaWs.playerRevive, payload: p });
        mafia.clearReviveBroadcastPayload();
    }, { flush: 'post' });
}
