/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { createLogger } from '@/utils/logger';
import { isMediaDebugEnabled, registerVideoDebugReader, } from '@/utils/mediaDebugRuntime';
import { emitDiagnosticEvent } from '@/diagnostics';
const streamVideoLog = createLogger('stream-video');
const props = withDefaults(defineProps(), {
    muted: false,
    fill: false,
    fillCover: false,
    reportVideoUi: true,
    playbackSuppressed: false,
    peerId: null,
});
const emit = defineEmits();
const el = ref(null);
/**
 * Media-driven: mount `<video>` when there is a **live** video track. Inbound WebRTC `muted` / `enabled`
 * can lag RTP — do not gate on them. `playRev` keeps this in sync when tracks change without stream ref churn.
 */
const hasUsableVideoTrack = computed(() => {
    void props.playRev;
    void props.videoPresentation;
    const s = props.stream;
    if (!s) {
        return false;
    }
    if (props.videoPresentation === 'none') {
        return false;
    }
    const tracks = s.getVideoTracks();
    if (tracks.length === 0) {
        return false;
    }
    return tracks.some((t) => t.readyState === 'live');
});
function cleanupVideoElement(v) {
    clearPlaybackFpsThrottle();
    if (!v) {
        return;
    }
    try {
        v.pause();
    }
    catch {
        /* ignore */
    }
    try {
        v.srcObject = null;
    }
    catch {
        /* ignore */
    }
}
function isAbortError(err) {
    return (typeof err === 'object' &&
        err !== null &&
        'name' in err &&
        err.name === 'AbortError');
}
async function playIgnoringAbort(v) {
    try {
        await v.play();
    }
    catch (err) {
        if (isAbortError(err)) {
            streamVideoLog.debug('play aborted (element detached or replaced)', err);
            return;
        }
        streamVideoLog.warn('play failed', err);
        // Best-effort diagnostics fanout. Per-peer 10s throttle lives in
        // the emitter; never throws into the playback path.
        try {
            emitDiagnosticEvent({
                level: 'warn',
                area: 'playback',
                type: 'video_play_failed',
                message: err instanceof Error ? `${err.name}: ${err.message || ''}`.trim() : 'video play failed',
                context: {
                    peerId: props.peerId ?? null,
                    presentation: props.videoPresentation ?? null,
                },
                error: err,
                override: { peerId: props.peerId ?? null },
            });
        }
        catch {
            /* never throw from diagnostics */
        }
    }
}
/** Pause or play without detaching `srcObject` (WebRTC / replaceTrack safe). */
async function applyPlaybackSuppression(v) {
    if (props.playbackSuppressed) {
        try {
            v.pause();
        }
        catch {
            /* ignore */
        }
        return;
    }
    await playIgnoringAbort(v);
}
const PLAYBACK_FPS_THROTTLE_MIN = 12;
const PLAYBACK_FPS_THROTTLE_MAX_EXCLUSIVE = 25;
const LOCAL_WAITING_FPS_STALL_MS = 1500;
const LOCAL_WAITING_FPS_RELATIVE = 0.85;
const CAN_USE_PLAYBACK_RVFC = typeof HTMLVideoElement !== 'undefined' &&
    typeof HTMLVideoElement.prototype.requestVideoFrameCallback === 'function';
let playbackFpsPacingGen = 0;
let playbackFpsThrottleInterval = null;
let playbackFpsThrottlePlayTimer = null;
let playbackFpsThrottleBoundEl = null;
let rvfcHandle = null;
let rvfcBoundVideo = null;
let rvfcSkipPlayTimer = null;
let localWaitingStallUntil = 0;
let localWaitingRestoreTimer = null;
let remotePlaybackStallActive = false;
function notifyRemotePlaybackStall(stalling) {
    if (props.reportVideoUi) {
        return;
    }
    const id = typeof props.remotePlaybackStallPeerId === 'string' ? props.remotePlaybackStallPeerId.trim() : '';
    if (!id) {
        return;
    }
    if (stalling) {
        if (!remotePlaybackStallActive) {
            remotePlaybackStallActive = true;
            emit('remotePlaybackStall', { peerId: id, stalling: true });
        }
        return;
    }
    if (remotePlaybackStallActive) {
        remotePlaybackStallActive = false;
        emit('remotePlaybackStall', { peerId: id, stalling: false });
    }
}
function clearWaitingStallState() {
    notifyRemotePlaybackStall(false);
    localWaitingStallUntil = 0;
    if (localWaitingRestoreTimer !== null) {
        clearTimeout(localWaitingRestoreTimer);
        localWaitingRestoreTimer = null;
    }
}
function getEffectivePlaybackFpsCap() {
    const cap = props.targetPlaybackFps;
    if (typeof cap !== 'number' ||
        !Number.isFinite(cap) ||
        cap < PLAYBACK_FPS_THROTTLE_MIN ||
        cap >= PLAYBACK_FPS_THROTTLE_MAX_EXCLUSIVE) {
        return undefined;
    }
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (localWaitingStallUntil > 0 && now < localWaitingStallUntil) {
        return Math.max(PLAYBACK_FPS_THROTTLE_MIN, Math.round(cap * LOCAL_WAITING_FPS_RELATIVE));
    }
    return cap;
}
function cancelRvfcIfAny() {
    const v = rvfcBoundVideo;
    if (v != null && rvfcHandle !== null && typeof v.cancelVideoFrameCallback === 'function') {
        try {
            v.cancelVideoFrameCallback(rvfcHandle);
        }
        catch {
            /* ignore */
        }
    }
    rvfcHandle = null;
    rvfcBoundVideo = null;
    if (rvfcSkipPlayTimer !== null) {
        clearTimeout(rvfcSkipPlayTimer);
        rvfcSkipPlayTimer = null;
    }
}
function clearPlaybackFpsThrottle() {
    playbackFpsPacingGen += 1;
    cancelRvfcIfAny();
    if (playbackFpsThrottleInterval !== null) {
        clearInterval(playbackFpsThrottleInterval);
        playbackFpsThrottleInterval = null;
    }
    if (playbackFpsThrottlePlayTimer !== null) {
        clearTimeout(playbackFpsThrottlePlayTimer);
        playbackFpsThrottlePlayTimer = null;
    }
    playbackFpsThrottleBoundEl = null;
}
/**
 * Phase 4: decode-aligned pacing via requestVideoFrameCallback (Chrome/Edge/Firefox).
 * Skips presentation beats by pausing only when frames arrive faster than target FPS.
 */
function startRvfcPlaybackFpsThrottle(v, token) {
    rvfcBoundVideo = v;
    let lastAcceptedMs = 0;
    const scheduleNextFrame = () => {
        if (token !== playbackFpsPacingGen || v !== el.value) {
            return;
        }
        if (props.playbackSuppressed) {
            return;
        }
        const eff = getEffectivePlaybackFpsCap();
        if (eff === undefined ||
            eff < PLAYBACK_FPS_THROTTLE_MIN ||
            eff >= PLAYBACK_FPS_THROTTLE_MAX_EXCLUSIVE) {
            clearPlaybackFpsThrottle();
            return;
        }
        const id = v.requestVideoFrameCallback(() => {
            if (token !== playbackFpsPacingGen || v !== el.value) {
                return;
            }
            rvfcHandle = null;
            if (props.playbackSuppressed) {
                return;
            }
            const effective = getEffectivePlaybackFpsCap();
            if (effective === undefined ||
                effective < PLAYBACK_FPS_THROTTLE_MIN ||
                effective >= PLAYBACK_FPS_THROTTLE_MAX_EXCLUSIVE) {
                clearPlaybackFpsThrottle();
                return;
            }
            const t = typeof performance !== 'undefined' ? performance.now() : 0;
            const minDelta = 1000 / effective;
            if (lastAcceptedMs === 0 || t - lastAcceptedMs >= minDelta) {
                lastAcceptedMs = t;
                scheduleNextFrame();
            }
            else {
                const wait = Math.min(72, Math.max(8, minDelta - (t - lastAcceptedMs)));
                try {
                    v.pause();
                }
                catch {
                    /* ignore */
                }
                if (rvfcSkipPlayTimer !== null) {
                    clearTimeout(rvfcSkipPlayTimer);
                }
                rvfcSkipPlayTimer = window.setTimeout(() => {
                    rvfcSkipPlayTimer = null;
                    if (token !== playbackFpsPacingGen || v !== el.value) {
                        return;
                    }
                    void playIgnoringAbort(v).finally(() => {
                        if (token !== playbackFpsPacingGen || v !== el.value) {
                            return;
                        }
                        scheduleNextFrame();
                    });
                }, wait);
            }
        });
        rvfcHandle = id;
    };
    scheduleNextFrame();
}
/**
 * Legacy fallback: fixed-interval pause/play pulse (Safari / no RVFC).
 */
function startPulsePlaybackFpsThrottle(v, token) {
    playbackFpsThrottleBoundEl = v;
    const cap = getEffectivePlaybackFpsCap();
    if (cap === undefined) {
        return;
    }
    const period = Math.max(55, Math.floor(1000 / cap));
    playbackFpsThrottleInterval = window.setInterval(() => {
        if (token !== playbackFpsPacingGen) {
            clearPlaybackFpsThrottle();
            return;
        }
        const bound = playbackFpsThrottleBoundEl;
        if (!bound || bound !== el.value) {
            clearPlaybackFpsThrottle();
            return;
        }
        const effective = getEffectivePlaybackFpsCap();
        if (props.playbackSuppressed ||
            effective === undefined ||
            effective < PLAYBACK_FPS_THROTTLE_MIN ||
            effective >= PLAYBACK_FPS_THROTTLE_MAX_EXCLUSIVE) {
            clearPlaybackFpsThrottle();
            return;
        }
        const activePeriod = Math.max(55, Math.floor(1000 / effective));
        const activePulse = Math.min(50, Math.max(12, Math.floor(activePeriod * 0.28)));
        try {
            bound.pause();
        }
        catch {
            /* ignore */
        }
        if (playbackFpsThrottlePlayTimer !== null) {
            clearTimeout(playbackFpsThrottlePlayTimer);
        }
        playbackFpsThrottlePlayTimer = window.setTimeout(() => {
            playbackFpsThrottlePlayTimer = null;
            void playIgnoringAbort(bound);
        }, activePulse);
    }, period);
}
function syncPlaybackFpsThrottle(v) {
    clearPlaybackFpsThrottle();
    if (props.reportVideoUi) {
        return;
    }
    if (props.playbackSuppressed) {
        return;
    }
    const cap = getEffectivePlaybackFpsCap();
    if (cap === undefined || cap < PLAYBACK_FPS_THROTTLE_MIN || cap >= PLAYBACK_FPS_THROTTLE_MAX_EXCLUSIVE) {
        return;
    }
    const token = playbackFpsPacingGen;
    if (CAN_USE_PLAYBACK_RVFC) {
        startRvfcPlaybackFpsThrottle(v, token);
    }
    else {
        startPulsePlaybackFpsThrottle(v, token);
    }
}
/**
 * Skip heavy work only when stream ref, video track id, and playRev are unchanged — then `play()` (+ UI emit).
 * When `playRev` bumps (e.g. track unmute / source change) on the **same** `MediaStream`, do not clear
 * `srcObject` (that aborts `play()` and fights mediasoup `replaceTrack`); refresh listeners and `play()` only.
 */
let lastBoundVideoTrackId;
let lastBoundPlayRev;
let detachUiListeners = null;
let detachInboundVideoListeners = null;
let detachLocalVideoEndedListener = null;
let bindStreamGeneration = 0;
function clearLocalVideoEndedListener() {
    detachLocalVideoEndedListener?.();
    detachLocalVideoEndedListener = null;
}
function clearInboundVideoTrackListeners() {
    detachInboundVideoListeners?.();
    detachInboundVideoListeners = null;
}
function detachVideoUi() {
    detachUiListeners?.();
    detachUiListeners = null;
}
function attachInboundVideoTrackListeners() {
    clearInboundVideoTrackListeners();
    const v = el.value;
    if (!v || props.reportVideoUi) {
        return;
    }
    const onWaiting = () => {
        if (props.playbackSuppressed) {
            return;
        }
        notifyRemotePlaybackStall(true);
        const cap = props.targetPlaybackFps;
        const capOk = typeof cap === 'number' &&
            Number.isFinite(cap) &&
            cap >= PLAYBACK_FPS_THROTTLE_MIN &&
            cap < PLAYBACK_FPS_THROTTLE_MAX_EXCLUSIVE;
        const now = typeof performance !== 'undefined' ? performance.now() : 0;
        localWaitingStallUntil = capOk ? now + LOCAL_WAITING_FPS_STALL_MS : 0;
        if (localWaitingRestoreTimer !== null) {
            clearTimeout(localWaitingRestoreTimer);
        }
        if (capOk) {
            syncPlaybackFpsThrottle(v);
        }
        localWaitingRestoreTimer = window.setTimeout(() => {
            localWaitingRestoreTimer = null;
            localWaitingStallUntil = 0;
            notifyRemotePlaybackStall(false);
            const cur = el.value;
            if (cur === v && !props.playbackSuppressed && hasUsableVideoTrack.value) {
                syncPlaybackFpsThrottle(cur);
            }
        }, LOCAL_WAITING_FPS_STALL_MS);
    };
    v.addEventListener('waiting', onWaiting);
    detachInboundVideoListeners = () => {
        v.removeEventListener('waiting', onWaiting);
        clearWaitingStallState();
        detachInboundVideoListeners = null;
    };
}
function attachVideoUiListeners(v) {
    if (!props.reportVideoUi) {
        return;
    }
    detachVideoUi();
    const notify = () => {
        emit('videoUi', {
            readyState: v.readyState,
            videoWidth: v.videoWidth,
            videoHeight: v.videoHeight,
        });
    };
    notify();
    const on = () => {
        notify();
    };
    v.addEventListener('loadedmetadata', on);
    v.addEventListener('loadeddata', on);
    v.addEventListener('canplay', on);
    v.addEventListener('playing', on);
    v.addEventListener('waiting', on);
    v.addEventListener('stalled', on);
    v.addEventListener('emptied', on);
    detachUiListeners = () => {
        v.removeEventListener('loadedmetadata', on);
        v.removeEventListener('loadeddata', on);
        v.removeEventListener('canplay', on);
        v.removeEventListener('playing', on);
        v.removeEventListener('waiting', on);
        v.removeEventListener('stalled', on);
        v.removeEventListener('emptied', on);
        detachUiListeners = null;
    };
}
async function bindStream() {
    const generation = ++bindStreamGeneration;
    await nextTick();
    if (generation !== bindStreamGeneration) {
        return;
    }
    if (!hasUsableVideoTrack.value) {
        return;
    }
    const v = el.value;
    const s = props.stream;
    if (!v) {
        return;
    }
    clearInboundVideoTrackListeners();
    clearLocalVideoEndedListener();
    if (!s || s.getVideoTracks().length === 0) {
        lastBoundVideoTrackId = undefined;
        lastBoundPlayRev = undefined;
        detachVideoUi();
        cleanupVideoElement(v);
        if (props.reportVideoUi) {
            emit('videoUi', { readyState: -1, videoWidth: 0, videoHeight: 0 });
        }
        return;
    }
    const vid = s.getVideoTracks()[0];
    const tid = vid?.id;
    const rev = props.playRev ?? 0;
    const samePlayRev = lastBoundPlayRev !== undefined && rev === lastBoundPlayRev;
    const sameStreamAndTrack = v.srcObject === s && tid !== undefined && tid === lastBoundVideoTrackId && samePlayRev;
    if (sameStreamAndTrack) {
        v.muted = Boolean(props.muted);
        await applyPlaybackSuppression(v);
        if (generation !== bindStreamGeneration) {
            return;
        }
        syncPlaybackFpsThrottle(v);
        if (props.reportVideoUi) {
            emit('videoUi', {
                readyState: v.readyState,
                videoWidth: v.videoWidth,
                videoHeight: v.videoHeight,
            });
        }
        attachInboundVideoTrackListeners();
        return;
    }
    lastBoundVideoTrackId = tid;
    lastBoundPlayRev = rev;
    detachVideoUi();
    if (import.meta.env.DEV && props.reportVideoUi) {
        streamVideoLog.debug('bindStream attach', {
            trackId: tid,
            fillCover: props.fillCover,
        });
    }
    if (v.srcObject !== s) {
        cleanupVideoElement(v);
        v.srcObject = s;
    }
    v.muted = Boolean(props.muted);
    if (props.reportVideoUi) {
        attachVideoUiListeners(v);
    }
    await applyPlaybackSuppression(v);
    if (generation !== bindStreamGeneration) {
        return;
    }
    syncPlaybackFpsThrottle(v);
    if (!props.reportVideoUi && vid) {
        clearLocalVideoEndedListener();
        const onEnded = () => {
            void bindStream();
        };
        vid.addEventListener('ended', onEnded);
        detachLocalVideoEndedListener = () => {
            vid.removeEventListener('ended', onEnded);
            detachLocalVideoEndedListener = null;
        };
    }
    attachInboundVideoTrackListeners();
}
/**
 * When the inbound track is gone: pause and clear `srcObject` so a future
 * `play()` cannot race a stale binding. The element is now v-show-gated
 * rather than v-if-gated, so it stays in the DOM (PERF2: element identity
 * preserved across cam toggle / Mafia force-camera-off / showVideo flips).
 */
watch(hasUsableVideoTrack, (ok) => {
    if (!ok) {
        cleanupVideoElement(el.value);
        clearInboundVideoTrackListeners();
        clearLocalVideoEndedListener();
        detachVideoUi();
        if (props.reportVideoUi) {
            emit('videoUi', { readyState: -1, videoWidth: 0, videoHeight: 0 });
        }
        lastBoundVideoTrackId = undefined;
        lastBoundPlayRev = undefined;
    }
}, { flush: 'sync' });
watch(() => [props.stream, props.playRev ?? 0, props.reportVideoUi, hasUsableVideoTrack.value, props.playbackSuppressed], () => {
    if (!hasUsableVideoTrack.value) {
        return;
    }
    void bindStream();
}, { immediate: true, flush: 'post' });
watch(() => [props.targetPlaybackFps ?? null, props.playbackSuppressed, hasUsableVideoTrack.value], () => {
    const v = el.value;
    if (!hasUsableVideoTrack.value || !v) {
        clearPlaybackFpsThrottle();
        return;
    }
    void nextTick(() => {
        if (el.value === v) {
            syncPlaybackFpsThrottle(v);
        }
    });
}, { flush: 'post' });
watch(() => props.muted, () => {
    const v = el.value;
    if (v) {
        v.muted = Boolean(props.muted);
    }
}, { flush: 'post' });
function onDocumentVisibleTryPlay() {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') {
        return;
    }
    // Re-bind after bfcache / tab sleep so `srcObject` and track attachment stay in sync (Chrome).
    void bindStream();
}
/**
 * Frame-decode stall watchdog (remote tiles only).
 *
 * The element-level `waiting` event fires on buffer underrun, but a key-frame
 * loss or a paused-by-server consumer can leave `currentTime` frozen with
 * `readyState >= 2`, no `waiting` event, and the track still `live`. We
 * sample every {@link STALL_SAMPLE_MS} and emit `videoStall` once when the
 * gap exceeds {@link STALL_THRESHOLD_MS}. Re-arms only after `currentTime`
 * advances again, so a single stall produces at most one event.
 *
 * Conditions to even sample:
 *   - This is a remote tile (`reportVideoUi === false`).
 *   - A peerId is provided (`props.peerId`).
 *   - There is a usable video track and dimensions are present.
 *   - Playback is not intentionally suppressed (off-screen / hidden tile).
 */
const STALL_SAMPLE_MS = 2000;
const STALL_THRESHOLD_MS = 6000;
const STALL_MIN_DELTA = 0.05;
let stallTimer = null;
let lastStallSampleCurrentTime = -1;
let lastStallSampleAt = 0;
let stallFiredAt = 0;
let stallCurrentlyDetected = false;
/**
 * Tracks the inbound video track id between samples so we can reset the
 * watchdog state when the track is replaced (camera ↔ screen-share switch,
 * publisher camera unplug/replug, any `replaceTrack` flow). Without this,
 * `lastStallSampleCurrentTime` from the old track can be larger than the
 * new track's initial `currentTime`, producing a negative delta that
 * masquerades as "no advance" and emits a false stall after 6 s.
 */
let lastStallSampleTrackId = null;
function shouldRunStallWatchdog() {
    if (props.reportVideoUi)
        return false;
    const peerId = typeof props.peerId === 'string' ? props.peerId.trim() : '';
    if (peerId.length === 0)
        return false;
    if (props.playbackSuppressed)
        return false;
    if (!hasUsableVideoTrack.value)
        return false;
    return true;
}
function tickStallWatchdog() {
    if (!shouldRunStallWatchdog()) {
        if (lastStallSampleCurrentTime !== -1) {
            lastStallSampleCurrentTime = -1;
            lastStallSampleTrackId = null;
            stallCurrentlyDetected = false;
        }
        return;
    }
    const v = el.value;
    if (!v)
        return;
    if (v.videoWidth <= 0 || v.videoHeight <= 0)
        return;
    const trackId = v.srcObject
        ? v.srcObject.getVideoTracks()[0]?.id ?? null
        : null;
    if (trackId !== lastStallSampleTrackId) {
        lastStallSampleTrackId = trackId;
        lastStallSampleCurrentTime = -1;
        stallCurrentlyDetected = false;
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const ct = v.currentTime;
    if (lastStallSampleCurrentTime === -1) {
        lastStallSampleCurrentTime = ct;
        lastStallSampleAt = now;
        return;
    }
    const delta = ct - lastStallSampleCurrentTime;
    if (delta >= STALL_MIN_DELTA) {
        lastStallSampleCurrentTime = ct;
        lastStallSampleAt = now;
        if (stallCurrentlyDetected) {
            stallCurrentlyDetected = false;
        }
        return;
    }
    if (now - lastStallSampleAt < STALL_THRESHOLD_MS) {
        return;
    }
    if (stallCurrentlyDetected) {
        return;
    }
    if (now - stallFiredAt < STALL_THRESHOLD_MS) {
        return;
    }
    stallCurrentlyDetected = true;
    stallFiredAt = now;
    const peerId = typeof props.peerId === 'string' ? props.peerId.trim() : '';
    if (peerId.length === 0)
        return;
    if (import.meta.env.DEV) {
        streamVideoLog.warn('decode stall detected (currentTime not advancing)', {
            peerId,
            currentTime: ct,
            videoWidth: v.videoWidth,
            videoHeight: v.videoHeight,
            readyState: v.readyState,
        });
    }
    emit('videoStall', { peerId });
}
let detachVideoDebugReader = null;
onMounted(() => {
    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', onDocumentVisibleTryPlay);
    }
    stallTimer = setInterval(tickStallWatchdog, STALL_SAMPLE_MS);
    if (isMediaDebugEnabled()) {
        const peerId = typeof props.peerId === 'string' && props.peerId.length > 0 ? props.peerId : null;
        if (peerId != null) {
            detachVideoDebugReader = registerVideoDebugReader(peerId, () => {
                const v = el.value;
                const track = v?.srcObject ? v.srcObject.getVideoTracks()[0] ?? null : null;
                return {
                    el: v,
                    currentTime: v?.currentTime ?? 0,
                    readyState: v?.readyState ?? 0,
                    videoWidth: v?.videoWidth ?? 0,
                    videoHeight: v?.videoHeight ?? 0,
                    paused: v?.paused ?? true,
                    trackId: track?.id ?? null,
                    trackMuted: track ? track.muted : null,
                    trackEnabled: track ? track.enabled : null,
                    trackReadyState: track ? track.readyState : null,
                    lastSampleCurrentTime: lastStallSampleCurrentTime,
                    lastSampleAt: lastStallSampleAt,
                    stalled: stallCurrentlyDetected,
                    playbackSuppressed: !!props.playbackSuppressed,
                };
            });
        }
    }
});
onUnmounted(() => {
    cleanupVideoElement(el.value);
    detachVideoUi();
    clearInboundVideoTrackListeners();
    clearLocalVideoEndedListener();
    if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onDocumentVisibleTryPlay);
    }
    if (stallTimer != null) {
        clearInterval(stallTimer);
        stallTimer = null;
    }
    detachVideoDebugReader?.();
    detachVideoDebugReader = null;
});
const __VLS_defaults = {
    muted: false,
    fill: false,
    fillCover: false,
    reportVideoUi: true,
    playbackSuppressed: false,
    peerId: null,
};
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['stream-video--fill']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.video)({
    ref: "el",
    ...{ class: "stream-video" },
    ...{ class: ({ 'stream-video--fill': __VLS_ctx.fill, 'stream-video--fill-cover': __VLS_ctx.fill && __VLS_ctx.fillCover }) },
    autoplay: true,
    playsinline: true,
    muted: (__VLS_ctx.muted),
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.hasUsableVideoTrack) }, null, null);
/** @type {__VLS_StyleScopedClasses['stream-video']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-video--fill']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-video--fill-cover']} */ ;
// @ts-ignore
[fill, fill, fillCover, muted, hasUsableVideoTrack,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
