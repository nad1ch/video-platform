import { storeToRefs } from 'pinia';
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useCallSessionStore } from 'call-core';
import { useGameTemplateGameStore } from '@/stores/gameTemplateGame';
import { useGameRoomViewMode } from '@/composables/gameRoomStreamViewRoute';
import { GameRoomWs } from './gameRoomWsProtocol';
/**
 * Generic game-room host signaling (Phase 3B).
 *
 * Parallel of `useMafiaHostSignaling.ts` for the generic subset of the
 * protocol:
 *   - inbound: host-updated, queue-update, reshuffle (order-only),
 *     players-update (order + speakingQueue only), timer-start/stop,
 *     player-kick / player-revive / player-life-state, force-mute-all.
 *   - outbound: claim-host on WS open, queue-update debounced fan-out,
 *     reshuffle / players-update / timer-start / timer-stop / kick /
 *     revive when the store stages a broadcast payload.
 *   - OBS reconnect snapshot request on `closed → open`.
 *
 * Deliberately omitted vs Mafia: `mode-update`, `settings-update`,
 * `page-background-settings` parsers and broadcast watchers (Mafia
 * dead/page-background galleries + old/new mode are not part of the
 * generic protocol). Role validation inside reshuffle and the
 * `nightActions / clearRoles / oldMafiaMode` fields inside
 * players-update are also stripped from the parsers.
 */
function normalizeGameRoomSpeakingQueueFlat(raw) {
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
function parseGameRoomHostUpdated(data) {
    if (!data || typeof data !== 'object')
        return null;
    const o = data;
    if (o.type !== GameRoomWs.hostUpdated)
        return null;
    const p = o.payload;
    if (!p || typeof p !== 'object')
        return null;
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
function parseGameRoomQueueUpdate(data) {
    if (!data || typeof data !== 'object')
        return null;
    const o = data;
    if (o.type !== GameRoomWs.queueUpdate)
        return null;
    const p = o.payload;
    if (!p || typeof p !== 'object')
        return null;
    const q = p.speakingQueue;
    if (!Array.isArray(q))
        return null;
    return { speakingQueue: normalizeGameRoomSpeakingQueueFlat(q) };
}
/**
 * Generic reshuffle parser — order-only. No `role` validation, unlike
 * `parseMafiaReshuffle`. The Mafia version walks `players[].role` against
 * `MAFIA_ROLES`; that whole branch is deleted here.
 */
function parseGameRoomReshuffle(data) {
    if (!data || typeof data !== 'object')
        return null;
    const o = data;
    if (o.type !== GameRoomWs.reshuffle)
        return null;
    const p = o.payload;
    if (!p || typeof p !== 'object')
        return null;
    const order = p.order;
    if (!Array.isArray(order) || order.length < 1)
        return null;
    const out = [];
    const seen = new Set();
    for (const id of order) {
        if (typeof id !== 'string' || id.length < 1)
            return null;
        if (seen.has(id))
            return null;
        seen.add(id);
        out.push(id);
    }
    return { order: out };
}
/**
 * Generic players-update parser — order + speakingQueue only. The Mafia
 * variant also walks `nightActions`, `clearRoles`, `oldMafiaMode`; those
 * fields are intentionally NOT part of the generic wire format and would
 * cause a parser mismatch if a Mafia-style payload was ever sent to a
 * `gameroom:` socket (the server should reject it before it reaches here).
 */
function parseGameRoomPlayersUpdate(data) {
    if (!data || typeof data !== 'object')
        return null;
    const o = data;
    if (o.type !== GameRoomWs.playersUpdate)
        return null;
    const p = o.payload;
    if (!p || typeof p !== 'object')
        return null;
    const order = p.order;
    if (!Array.isArray(order) || order.length < 1)
        return null;
    const outOrder = [];
    const seen = new Set();
    for (const id of order) {
        if (typeof id !== 'string' || id.length < 1)
            return null;
        if (seen.has(id))
            return null;
        seen.add(id);
        outOrder.push(id);
    }
    const sq = p.speakingQueue;
    if (!Array.isArray(sq))
        return null;
    return { order: outOrder, speakingQueue: normalizeGameRoomSpeakingQueueFlat(sq) };
}
function parseGameRoomTimerStart(data) {
    if (!data || typeof data !== 'object')
        return null;
    const o = data;
    if (o.type !== GameRoomWs.timerStart)
        return null;
    const p = o.payload;
    if (!p || typeof p !== 'object')
        return null;
    const s = p.startedAt;
    const d = p.duration;
    if (typeof s !== 'number' || !Number.isFinite(s))
        return null;
    if (typeof d !== 'number' || !Number.isFinite(d) || d < 1000)
        return null;
    const run = p.isRunning;
    const isRunning = run === false ? false : true;
    return { startedAt: s, duration: d, isRunning };
}
function parseGameRoomTimerPresetSelect(data) {
    if (!data || typeof data !== 'object')
        return null;
    const o = data;
    if (o.type !== GameRoomWs.timerPresetSelect)
        return null;
    const p = o.payload;
    if (!p || typeof p !== 'object')
        return null;
    const ms = p.durationMs;
    if (typeof ms !== 'number' || !Number.isFinite(ms))
        return null;
    return Math.floor(ms);
}
function parseGameRoomTimerStop(data) {
    if (!data || typeof data !== 'object')
        return null;
    const o = data;
    if (o.type !== GameRoomWs.timerStop)
        return null;
    if (o.payload === undefined || o.payload === null) {
        return {};
    }
    if (typeof o.payload !== 'object' || Object.keys(o.payload).length > 0) {
        return null;
    }
    return {};
}
function parseGameRoomPlayerKick(data) {
    if (!data || typeof data !== 'object')
        return null;
    const o = data;
    if (o.type !== GameRoomWs.playerKick)
        return null;
    const p = o.payload;
    if (!p || typeof p !== 'object')
        return null;
    const id = p.peerId;
    if (typeof id !== 'string' || id.length < 1)
        return null;
    return { peerId: id };
}
function parseGameRoomPlayerRevive(data) {
    if (!data || typeof data !== 'object')
        return null;
    const o = data;
    if (o.type !== GameRoomWs.playerRevive)
        return null;
    const p = o.payload;
    if (!p || typeof p !== 'object')
        return null;
    const id = p.peerId;
    if (typeof id !== 'string' || id.length < 1)
        return null;
    return { peerId: id };
}
function parseGameRoomForceMuteAll(data) {
    if (!data || typeof data !== 'object')
        return null;
    const o = data;
    if (o.type !== GameRoomWs.forceMuteAll)
        return null;
    const p = o.payload;
    if (!p || typeof p !== 'object')
        return null;
    const m = p.muted;
    return { muted: m !== false };
}
function parseGameRoomPlayerLifeStateSnapshot(data) {
    if (!data || typeof data !== 'object')
        return null;
    const o = data;
    if (o.type !== GameRoomWs.playerLifeState)
        return null;
    const p = o.payload;
    if (!p || typeof p !== 'object')
        return null;
    const states = p.states;
    if (!states || typeof states !== 'object' || Array.isArray(states))
        return null;
    const out = {};
    for (const [peerId, state] of Object.entries(states)) {
        if (typeof peerId !== 'string' || peerId.length < 1)
            continue;
        if (state === 'dead' || state === 'ghost' || state === 'alive') {
            out[peerId] = state;
        }
    }
    return { states: out };
}
/**
 * Generic game-room host signaling. Mirrors `useMafiaHostSignaling`
 * structure: inbound dispatch, claim-host on WS open, debounced queue
 * broadcast, broadcast watchers for store-staged payloads, OBS reconnect
 * snapshot request.
 */
export function useGameRoomHostSignaling(sendSignalingMessage, subscribeSignalingMessage, wsStatus) {
    const gameStore = useGameTemplateGameStore();
    const { hostPeerId, hostUserId, hostSessionId, localHostSessionId, localUserId, speakingQueue, isGameRoomHost, reshuffleBroadcastPayload, playersUpdateBroadcastPayload, applyingPlayersUpdateFromSignaling, timerStartBroadcastPayload, timerStopBroadcastPayload, timerPresetSelectBroadcastPayload, kickBroadcastPayload, reviveBroadcastPayload, } = storeToRefs(gameStore);
    const session = useCallSessionStore();
    const { inCall, selfPeerId } = storeToRefs(session);
    /** While true, do not re-send `gameroom:queue-update` (remote / echo apply). */
    const applyingQueueFromSignaling = ref(false);
    // OBS / `?mode=view` page must be display-only and never claim host.
    const { isViewMode } = useGameRoomViewMode();
    const off = subscribeSignalingMessage((data) => {
        const hostParsed = parseGameRoomHostUpdated(data);
        if (hostParsed) {
            gameStore.setHostFromSignaling(hostParsed.hostPeerId, hostParsed.hostUserId, hostParsed.hostSessionId);
        }
        const queueParsed = parseGameRoomQueueUpdate(data);
        if (queueParsed) {
            applyingQueueFromSignaling.value = true;
            gameStore.applySpeakingQueueFromSignaling(queueParsed.speakingQueue);
            // Same dedupe invalidation Mafia does: snapshot replay / post-transfer
            // re-emit replaces local queue state, so the cached "last sent" key no
            // longer reflects what receivers actually have.
            lastSentQueueKey = null;
            void nextTick(() => {
                applyingQueueFromSignaling.value = false;
            });
        }
        const reshuffleParsed = parseGameRoomReshuffle(data);
        if (reshuffleParsed) {
            gameStore.applyGameRoomReshuffleFromSignaling(reshuffleParsed);
        }
        const playersParsed = parseGameRoomPlayersUpdate(data);
        if (playersParsed) {
            applyingPlayersUpdateFromSignaling.value = true;
            gameStore.applyGameRoomPlayersUpdateFromSignaling(playersParsed);
            void nextTick(() => {
                applyingPlayersUpdateFromSignaling.value = false;
            });
        }
        const timerParsed = parseGameRoomTimerStart(data);
        if (timerParsed) {
            gameStore.applyTimerStartFromSignaling(timerParsed);
        }
        if (parseGameRoomTimerStop(data) != null) {
            gameStore.applyTimerStopFromSignaling();
        }
        const presetParsed = parseGameRoomTimerPresetSelect(data);
        if (presetParsed != null) {
            gameStore.applyTimerPresetSelectFromSignaling(presetParsed);
        }
        const kickParsed = parseGameRoomPlayerKick(data);
        if (kickParsed) {
            gameStore.applyGameRoomKickFromSignaling(kickParsed);
        }
        const reviveParsed = parseGameRoomPlayerRevive(data);
        if (reviveParsed) {
            gameStore.applyGameRoomReviveFromSignaling(reviveParsed);
        }
        const lifeStateParsed = parseGameRoomPlayerLifeStateSnapshot(data);
        if (lifeStateParsed) {
            gameStore.applyGameRoomPlayerLifeStateSnapshotFromSignaling(lifeStateParsed);
        }
        const forceMuteAllParsed = parseGameRoomForceMuteAll(data);
        if (forceMuteAllParsed) {
            gameStore.setForceMuteAllActiveFromSignaling(forceMuteAllParsed.muted);
        }
    });
    onBeforeUnmount(off);
    // Claim host on WS-open. OBS / view-mode is a hard gate — display-only,
    // never claims host.
    watch([inCall, hostPeerId, hostUserId, hostSessionId, localHostSessionId, localUserId, selfPeerId, wsStatus], () => {
        if (!inCall.value) {
            gameStore.setHostFromSignaling(null, null, null);
            return;
        }
        if (wsStatus.value !== 'open') {
            return;
        }
        if (isViewMode.value) {
            return;
        }
        const sid = selfPeerId.value;
        if (typeof sid !== 'string' || sid.length === 0) {
            return;
        }
        const lu = localUserId.value;
        const ls = localHostSessionId.value;
        if (typeof lu !== 'string' || lu.length === 0 || ls.length === 0) {
            return;
        }
        if (hostUserId.value != null && hostUserId.value !== lu) {
            return;
        }
        sendSignalingMessage({ type: GameRoomWs.claimHost, payload: { sessionId: ls } });
    }, { immediate: true });
    // Debounced speakingQueue → `gameroom:queue-update` broadcast (host only).
    const QUEUE_BROADCAST_DEBOUNCE_MS = 75;
    let queueBroadcastTimer = null;
    let lastSentQueueKey = null;
    function flushQueueBroadcast() {
        queueBroadcastTimer = null;
        if (!inCall.value)
            return;
        if (wsStatus.value !== 'open')
            return;
        if (!isGameRoomHost.value)
            return;
        const snapshot = [...speakingQueue.value];
        const key = snapshot.join(',');
        if (key === lastSentQueueKey)
            return;
        lastSentQueueKey = key;
        sendSignalingMessage({ type: GameRoomWs.queueUpdate, payload: { speakingQueue: snapshot } });
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
        if (!inCall.value)
            return;
        if (wsStatus.value !== 'open')
            return;
        if (!isGameRoomHost.value)
            return;
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
    // OBS reconnect snapshot request on `closed → open` after initial join.
    let lastWsStatus = null;
    watch([wsStatus, isViewMode], ([wsNow, viewNow]) => {
        const prev = lastWsStatus;
        lastWsStatus = wsNow;
        if (!viewNow)
            return;
        if (wsNow !== 'open')
            return;
        if (prev === 'open' || prev == null)
            return;
        sendSignalingMessage({ type: GameRoomWs.requestSnapshot });
    }, { immediate: true });
    // ─── Outbound broadcast watchers ────────────────────────────────────────
    // Each watch drains a store-staged payload through the WS, then clears it.
    // Same retry-on-reconnect semantics as Mafia: if WS is not open we keep
    // the payload and try again on the next reconnect / focus resync. The
    // Mafia `mode-update`, `settings-update`, `page-background-settings`
    // watchers are intentionally NOT mirrored — those payloads do not exist
    // in the generic store.
    watch([reshuffleBroadcastPayload, inCall, wsStatus, isGameRoomHost], ([p, inCallNow, wsNow, isHostNow]) => {
        if (p == null)
            return;
        if (!inCallNow || wsNow !== 'open' || !isHostNow)
            return;
        sendSignalingMessage({ type: GameRoomWs.reshuffle, payload: p });
        gameStore.clearReshuffleBroadcastPayload();
    }, { flush: 'post' });
    watch([playersUpdateBroadcastPayload, inCall, wsStatus, isGameRoomHost], ([p, inCallNow, wsNow, isHostNow]) => {
        if (p == null)
            return;
        if (!inCallNow || wsNow !== 'open' || !isHostNow)
            return;
        sendSignalingMessage({ type: GameRoomWs.playersUpdate, payload: p });
        gameStore.clearPlayersUpdateBroadcastPayload();
    }, { flush: 'post' });
    watch(timerStartBroadcastPayload, (p) => {
        if (p == null)
            return;
        if (!inCall.value) {
            gameStore.clearTimerStartBroadcastPayload();
            return;
        }
        if (wsStatus.value !== 'open') {
            gameStore.clearTimerStartBroadcastPayload();
            return;
        }
        if (!isGameRoomHost.value) {
            gameStore.clearTimerStartBroadcastPayload();
            return;
        }
        sendSignalingMessage({ type: GameRoomWs.timerStart, payload: p });
        gameStore.clearTimerStartBroadcastPayload();
    }, { flush: 'post' });
    watch(timerStopBroadcastPayload, (p) => {
        if (p == null)
            return;
        if (!inCall.value) {
            gameStore.clearTimerStopBroadcastPayload();
            return;
        }
        if (wsStatus.value !== 'open') {
            gameStore.clearTimerStopBroadcastPayload();
            return;
        }
        if (!isGameRoomHost.value) {
            gameStore.clearTimerStopBroadcastPayload();
            return;
        }
        sendSignalingMessage({ type: GameRoomWs.timerStop, payload: {} });
        gameStore.clearTimerStopBroadcastPayload();
    }, { flush: 'post' });
    watch(timerPresetSelectBroadcastPayload, (durationMs) => {
        if (durationMs == null)
            return;
        if (!inCall.value) {
            gameStore.clearTimerPresetSelectBroadcastPayload();
            return;
        }
        if (wsStatus.value !== 'open') {
            gameStore.clearTimerPresetSelectBroadcastPayload();
            return;
        }
        if (!isGameRoomHost.value) {
            gameStore.clearTimerPresetSelectBroadcastPayload();
            return;
        }
        sendSignalingMessage({
            type: GameRoomWs.timerPresetSelect,
            payload: { durationMs },
        });
        gameStore.clearTimerPresetSelectBroadcastPayload();
    }, { flush: 'post' });
    watch(kickBroadcastPayload, (p) => {
        if (p == null)
            return;
        if (!inCall.value) {
            gameStore.clearKickBroadcastPayload();
            return;
        }
        if (wsStatus.value !== 'open') {
            gameStore.clearKickBroadcastPayload();
            return;
        }
        if (!isGameRoomHost.value) {
            gameStore.clearKickBroadcastPayload();
            return;
        }
        sendSignalingMessage({ type: GameRoomWs.playerKick, payload: p });
        gameStore.clearKickBroadcastPayload();
    }, { flush: 'post' });
    watch(reviveBroadcastPayload, (p) => {
        if (p == null)
            return;
        if (!inCall.value) {
            gameStore.clearReviveBroadcastPayload();
            return;
        }
        if (wsStatus.value !== 'open') {
            gameStore.clearReviveBroadcastPayload();
            return;
        }
        if (!isGameRoomHost.value) {
            gameStore.clearReviveBroadcastPayload();
            return;
        }
        sendSignalingMessage({ type: GameRoomWs.playerRevive, payload: p });
        gameStore.clearReviveBroadcastPayload();
    }, { flush: 'post' });
}
