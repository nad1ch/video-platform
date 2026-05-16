/**
 * Tiny in-memory registry of per-tile media element snapshots used by the
 * dev `?mediaDebug=1` panel and the `window.__MEDIA_DEBUG__` console helpers.
 *
 * Always safe to populate: the registry is just a `Map`. The diagnostics panel
 * is gated by `?mediaDebug=1` AND `import.meta.env.DEV` in the consumer, so
 * production users never see anything. The console helpers are also gated.
 *
 * No mediasoup state lives here. No Vue reactivity (deliberately) — we want
 * the registry to be lock-free and not pin component refs across teardown.
 */
const audioReaders = new Map();
const videoReaders = new Map();
let mediaDebugQueryFlag = null;
function readMediaDebugQueryFlag() {
    if (mediaDebugQueryFlag !== null) {
        return mediaDebugQueryFlag;
    }
    if (typeof window === 'undefined') {
        mediaDebugQueryFlag = false;
        return false;
    }
    try {
        const q = new URLSearchParams(window.location.search).get('mediaDebug');
        mediaDebugQueryFlag = q === '1' || q === 'true';
    }
    catch {
        mediaDebugQueryFlag = false;
    }
    return mediaDebugQueryFlag;
}
export function isMediaDebugEnabled() {
    return readMediaDebugQueryFlag();
}
export function registerAudioDebugReader(peerId, reader) {
    audioReaders.set(peerId, reader);
    return () => {
        if (audioReaders.get(peerId) === reader) {
            audioReaders.delete(peerId);
        }
    };
}
export function registerVideoDebugReader(peerId, reader) {
    videoReaders.set(peerId, reader);
    return () => {
        if (videoReaders.get(peerId) === reader) {
            videoReaders.delete(peerId);
        }
    };
}
export function dumpAudioDebug() {
    const out = {};
    for (const [peerId, reader] of audioReaders) {
        try {
            out[peerId] = reader();
        }
        catch {
            /* drop unreadable entries */
        }
    }
    return out;
}
export function dumpVideoDebug() {
    const out = {};
    for (const [peerId, reader] of videoReaders) {
        try {
            out[peerId] = reader();
        }
        catch {
            /* drop unreadable entries */
        }
    }
    return out;
}
export function dumpAllDebug() {
    return { audio: dumpAudioDebug(), video: dumpVideoDebug() };
}
const TIMER_DRIFT_INTERVAL_MS = 2000;
const TIMER_DRIFT_THROTTLED_DELTA_MS = 8000;
const TIMER_DRIFT_WARN_THROTTLE_MS = 60_000;
const timerDrift = {
    running: false,
    lastTickAt: 0,
    lastDeltaMs: 0,
    maxDeltaMs: 0,
    throttledTickCount: 0,
    lastThrottledAt: 0,
};
let timerDriftInterval = null;
let timerDriftLastWarnAt = 0;
function tickTimerDrift() {
    const now = Date.now();
    if (timerDrift.lastTickAt === 0) {
        timerDrift.lastTickAt = now;
        return;
    }
    const delta = now - timerDrift.lastTickAt;
    timerDrift.lastTickAt = now;
    timerDrift.lastDeltaMs = delta;
    if (delta > timerDrift.maxDeltaMs) {
        timerDrift.maxDeltaMs = delta;
    }
    if (delta > TIMER_DRIFT_THROTTLED_DELTA_MS) {
        timerDrift.throttledTickCount += 1;
        timerDrift.lastThrottledAt = now;
        if (now - timerDriftLastWarnAt > TIMER_DRIFT_WARN_THROTTLE_MS) {
            timerDriftLastWarnAt = now;
            console.warn('[media-debug] timer drift detected (likely OBS/hidden-tab throttling)', {
                deltaMs: delta,
                expectedMs: TIMER_DRIFT_INTERVAL_MS,
                throttledTickCount: timerDrift.throttledTickCount,
            });
        }
    }
}
/**
 * Install the timer-drift probe. Idempotent. Always-on while the call route
 * is mounted; cost is one setInterval at {@link TIMER_DRIFT_INTERVAL_MS}.
 * Diagnostic-only: no media side effects, no recovery actions taken.
 */
export function startMediaDebugTimerDriftProbe() {
    if (typeof window === 'undefined') {
        return () => { };
    }
    if (timerDriftInterval !== null) {
        return stopMediaDebugTimerDriftProbe;
    }
    timerDrift.running = true;
    timerDrift.lastTickAt = 0;
    timerDrift.lastDeltaMs = 0;
    timerDrift.maxDeltaMs = 0;
    timerDrift.throttledTickCount = 0;
    timerDrift.lastThrottledAt = 0;
    timerDriftLastWarnAt = 0;
    timerDriftInterval = setInterval(tickTimerDrift, TIMER_DRIFT_INTERVAL_MS);
    return stopMediaDebugTimerDriftProbe;
}
export function stopMediaDebugTimerDriftProbe() {
    if (timerDriftInterval === null) {
        return;
    }
    clearInterval(timerDriftInterval);
    timerDriftInterval = null;
    timerDrift.running = false;
}
export function readMediaDebugTimerDrift() {
    return { ...timerDrift };
}
export const MEDIA_DEBUG_TIMER_DRIFT_INTERVAL_MS = TIMER_DRIFT_INTERVAL_MS;
export const MEDIA_DEBUG_TIMER_DRIFT_THROTTLED_DELTA_MS = TIMER_DRIFT_THROTTLED_DELTA_MS;
const resyncStats = {
    softResyncCount: 0,
    lastSoftResyncAt: 0,
    lastSoftResyncKind: null,
    hardResyncCount: 0,
    lastHardResyncAt: 0,
    lastHardResyncKind: null,
    hardResyncSkippedCount: 0,
    lastHardResyncSkippedAt: 0,
    lastHardResyncSkippedKind: null,
};
export function recordMediaDebugSoftResync(kind) {
    resyncStats.softResyncCount += 1;
    resyncStats.lastSoftResyncAt = Date.now();
    resyncStats.lastSoftResyncKind = kind;
}
export function recordMediaDebugHardResync(kind) {
    resyncStats.hardResyncCount += 1;
    resyncStats.lastHardResyncAt = Date.now();
    resyncStats.lastHardResyncKind = kind;
}
export function recordMediaDebugHardResyncSkipped(kind) {
    resyncStats.hardResyncSkippedCount += 1;
    resyncStats.lastHardResyncSkippedAt = Date.now();
    resyncStats.lastHardResyncSkippedKind = kind;
}
export function readMediaDebugResyncStats() {
    return { ...resyncStats };
}
const RAF_LONG_FRAME_DELTA_MS = 100;
const RAF_FPS_WINDOW_MS = 1000;
const rafStats = {
    running: false,
    approxFps: 0,
    maxFrameDeltaMs: 0,
    longFrameCount: 0,
    lastFrameAt: 0,
    totalFrameCount: 0,
};
let rafProbeRunning = false;
let rafWindowFrameCount = 0;
let rafWindowStartedAt = 0;
/**
 * Handle of the currently-pending `requestAnimationFrame` callback. Tracked
 * so {@link stopMediaDebugRafProbe} can `cancelAnimationFrame` an in-flight
 * tick — without this, a route unmount + remount inside one frame
 * (~16 ms, e.g. very fast Vue route swap) could leave a stale tick queued
 * that survives the unmount, sees `rafProbeRunning = true` again after the
 * fresh start, and schedules a second concurrent chain. The handle-based
 * cancel makes start/stop deterministic across re-entry.
 */
let rafProbeHandle = null;
function tickRafProbe(now) {
    rafProbeHandle = null;
    if (!rafProbeRunning)
        return;
    rafStats.totalFrameCount += 1;
    if (rafStats.lastFrameAt > 0) {
        const delta = now - rafStats.lastFrameAt;
        if (delta > rafStats.maxFrameDeltaMs) {
            rafStats.maxFrameDeltaMs = delta;
        }
        if (delta > RAF_LONG_FRAME_DELTA_MS) {
            rafStats.longFrameCount += 1;
        }
    }
    rafStats.lastFrameAt = now;
    if (rafWindowStartedAt === 0) {
        rafWindowStartedAt = now;
        rafWindowFrameCount = 0;
    }
    else if (now - rafWindowStartedAt >= RAF_FPS_WINDOW_MS) {
        rafStats.approxFps = Math.round((rafWindowFrameCount * 1000) / Math.max(1, now - rafWindowStartedAt));
        rafWindowStartedAt = now;
        rafWindowFrameCount = 0;
    }
    else {
        rafWindowFrameCount += 1;
    }
    if (typeof requestAnimationFrame === 'function') {
        rafProbeHandle = requestAnimationFrame(tickRafProbe);
    }
}
export function startMediaDebugRafProbe() {
    if (typeof window === 'undefined' || typeof requestAnimationFrame !== 'function') {
        return () => { };
    }
    if (rafProbeRunning) {
        return stopMediaDebugRafProbe;
    }
    rafProbeRunning = true;
    rafStats.running = true;
    rafStats.approxFps = 0;
    rafStats.maxFrameDeltaMs = 0;
    rafStats.longFrameCount = 0;
    rafStats.lastFrameAt = 0;
    rafStats.totalFrameCount = 0;
    rafWindowFrameCount = 0;
    rafWindowStartedAt = 0;
    rafProbeHandle = requestAnimationFrame(tickRafProbe);
    return stopMediaDebugRafProbe;
}
export function stopMediaDebugRafProbe() {
    rafProbeRunning = false;
    rafStats.running = false;
    if (rafProbeHandle !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafProbeHandle);
        rafProbeHandle = null;
    }
}
export function readMediaDebugRafStats() {
    return { ...rafStats };
}
export const MEDIA_DEBUG_RAF_LONG_FRAME_DELTA_MS = RAF_LONG_FRAME_DELTA_MS;
const wsStats = {
    currentStatus: null,
    lastTransitionAt: 0,
    openCount: 0,
    closeCount: 0,
    errorCount: 0,
    reconnectCount: 0,
};
export function recordMediaDebugWsTransition(prev, next) {
    wsStats.currentStatus = next;
    wsStats.lastTransitionAt = Date.now();
    if (next === 'open') {
        wsStats.openCount += 1;
        if (prev === 'closed' || prev === 'error') {
            wsStats.reconnectCount += 1;
        }
    }
    else if (next === 'closed') {
        wsStats.closeCount += 1;
    }
    else if (next === 'error') {
        wsStats.errorCount += 1;
    }
}
export function readMediaDebugWsStats() {
    return { ...wsStats };
}
const signalingStats = {
    producerSyncCount: 0,
    producerSyncClientRefreshCount: 0,
    newProducerCount: 0,
    producerClosedCount: 0,
    roomStateCount: 0,
    peerJoinedCount: 0,
    peerLeftCount: 0,
    mafiaSnapshotApplyCount: 0,
    otherCount: 0,
    lastTrackedAt: 0,
    lastTrackedType: null,
};
export function recordMediaDebugSignalingIncoming(type, extra) {
    signalingStats.lastTrackedAt = Date.now();
    signalingStats.lastTrackedType = type;
    switch (type) {
        case 'producer-sync':
            signalingStats.producerSyncCount += 1;
            if (extra?.syncReason === 'client-refresh') {
                signalingStats.producerSyncClientRefreshCount += 1;
            }
            return;
        case 'new-producer':
            signalingStats.newProducerCount += 1;
            return;
        case 'producer-closed':
            signalingStats.producerClosedCount += 1;
            return;
        case 'room-state':
            signalingStats.roomStateCount += 1;
            return;
        case 'peer-joined':
            signalingStats.peerJoinedCount += 1;
            return;
        case 'peer-left':
            signalingStats.peerLeftCount += 1;
            return;
        default:
            // Mafia snapshot block messages — surface a single counter for
            // "OBS request-snapshot reply applied" without enumerating every
            // mafia:* type.
            if (type === 'mafia:player-life-state' ||
                type === 'mafia:players-update' ||
                type === 'mafia:reshuffle' ||
                type === 'mafia:audio-mix-update' ||
                type === 'mafia:host-updated' ||
                type === 'mafia:force-mute-all') {
                signalingStats.mafiaSnapshotApplyCount += 1;
                return;
            }
            signalingStats.otherCount += 1;
            return;
    }
}
export function readMediaDebugSignalingStats() {
    return { ...signalingStats };
}
const envInfo = {
    isMafiaView: false,
    isGameRoomView: false,
    isEatFirstView: false,
    isViewMode: false,
    hardwareConcurrency: null,
    deviceMemoryGb: null,
    userAgentLabel: null,
    installedAt: 0,
};
export function setMediaDebugEnvInfo(input) {
    if (typeof input.isMafiaView === 'boolean')
        envInfo.isMafiaView = input.isMafiaView;
    if (typeof input.isGameRoomView === 'boolean')
        envInfo.isGameRoomView = input.isGameRoomView;
    if (typeof input.isEatFirstView === 'boolean')
        envInfo.isEatFirstView = input.isEatFirstView;
    envInfo.isViewMode = envInfo.isMafiaView || envInfo.isGameRoomView || envInfo.isEatFirstView;
    if (envInfo.installedAt === 0 && typeof window !== 'undefined') {
        envInfo.installedAt = Date.now();
        const nav = (typeof navigator !== 'undefined' ? navigator : null);
        envInfo.hardwareConcurrency = nav?.hardwareConcurrency ?? null;
        envInfo.deviceMemoryGb = typeof nav?.deviceMemory === 'number' ? nav.deviceMemory : null;
        const ua = nav?.userAgent ?? '';
        envInfo.userAgentLabel = ua ? ua.slice(0, 200) : null;
    }
}
export function readMediaDebugEnvInfo() {
    const documentVisibilityState = typeof document !== 'undefined' && typeof document.visibilityState === 'string'
        ? document.visibilityState
        : null;
    return { ...envInfo, documentVisibilityState };
}
let globalInstalled = false;
/**
 * Install `window.__MEDIA_DEBUG__`. Idempotent. Only callable when
 * `?mediaDebug=1` is set; otherwise no global is installed. CallPage wires
 * `forceSoftResync` from the call orchestrator at install time so the debug
 * helpers never need to import call-core themselves.
 */
export function installMediaDebugGlobal(opts) {
    if (typeof window === 'undefined') {
        return () => { };
    }
    if (!isMediaDebugEnabled()) {
        return () => { };
    }
    const api = {
        dumpAudio: dumpAudioDebug,
        dumpVideo: dumpVideoDebug,
        dumpAll: dumpAllDebug,
        timerDrift: readMediaDebugTimerDrift,
        resyncStats: readMediaDebugResyncStats,
        rafStats: readMediaDebugRafStats,
        wsStats: readMediaDebugWsStats,
        signalingStats: readMediaDebugSignalingStats,
        envInfo: readMediaDebugEnvInfo,
        forceSoftResync: opts.forceSoftResync,
    };
    window.__MEDIA_DEBUG__ = api;
    globalInstalled = true;
    return () => {
        if (!globalInstalled)
            return;
        delete window.__MEDIA_DEBUG__;
        globalInstalled = false;
    };
}
