/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { dumpAudioDebug, dumpVideoDebug, MEDIA_DEBUG_RAF_LONG_FRAME_DELTA_MS, MEDIA_DEBUG_TIMER_DRIFT_INTERVAL_MS, MEDIA_DEBUG_TIMER_DRIFT_THROTTLED_DELTA_MS, readMediaDebugEnvInfo, readMediaDebugRafStats, readMediaDebugResyncStats, readMediaDebugSignalingStats, readMediaDebugTimerDrift, readMediaDebugWsStats, } from '@/utils/mediaDebugRuntime';
/**
 * Dev-only floating overlay surfacing per-peer media element + track state.
 * Mounted only when `?mediaDebug=1` is set. Polls the registry every 1s; rows
 * are flat strings so the panel stays cheap even with 12+ tiles.
 *
 * No reactivity into Vue stores; no WS calls; no mediasoup access. Read-only.
 */
const POLL_MS = 1000;
const audioRows = ref([]);
const videoRows = ref([]);
const drift = ref(readMediaDebugTimerDrift());
const resync = ref(readMediaDebugResyncStats());
const raf = ref(readMediaDebugRafStats());
const ws = ref(readMediaDebugWsStats());
const sigStats = ref(readMediaDebugSignalingStats());
const env = ref(readMediaDebugEnvInfo());
const collapsed = ref(false);
let timer = null;
function refresh() {
    const a = dumpAudioDebug();
    const v = dumpVideoDebug();
    audioRows.value = Object.entries(a).map(([peerId, snap]) => ({ peerId, ...snap }));
    videoRows.value = Object.entries(v).map(([peerId, snap]) => ({ peerId, ...snap }));
    drift.value = readMediaDebugTimerDrift();
    resync.value = readMediaDebugResyncStats();
    raf.value = readMediaDebugRafStats();
    ws.value = readMediaDebugWsStats();
    sigStats.value = readMediaDebugSignalingStats();
    env.value = readMediaDebugEnvInfo();
}
function fmtAge(ts) {
    if (ts <= 0)
        return '—';
    const ago = Math.max(0, Date.now() - ts);
    if (ago < 60_000)
        return `${Math.round(ago / 1000)}s ago`;
    if (ago < 3_600_000)
        return `${Math.round(ago / 60_000)}m ago`;
    return `${Math.round(ago / 3_600_000)}h ago`;
}
onMounted(() => {
    refresh();
    timer = setInterval(refresh, POLL_MS);
});
onBeforeUnmount(() => {
    if (timer != null) {
        clearInterval(timer);
        timer = null;
    }
});
const audioCount = computed(() => audioRows.value.length);
const videoCount = computed(() => videoRows.value.length);
const audioElPaused = computed(() => audioRows.value.filter((r) => r.hasSrcObject && !r.usingWebAudio && r.paused && !r.muted).length);
const audioStalled = computed(() => audioRows.value.filter((r) => r.audioStalled).length);
const videoStalled = computed(() => videoRows.value.filter((r) => r.stalled).length);
const driftSuspected = computed(() => drift.value.lastDeltaMs > MEDIA_DEBUG_TIMER_DRIFT_THROTTLED_DELTA_MS);
const driftSeen = computed(() => drift.value.throttledTickCount > 0);
const tilesWithoutVideoCount = computed(() => videoRows.value.filter((r) => r.videoWidth <= 0 || r.videoHeight <= 0).length);
const liveVideoTrackCount = computed(() => videoRows.value.filter((r) => r.trackReadyState === 'live' && !r.trackMuted).length);
const rafFpsLow = computed(() => raf.value.totalFrameCount > 0 && raf.value.approxFps > 0 && raf.value.approxFps < 25);
const rafLongFrames = computed(() => raf.value.longFrameCount > 0);
function shortPeer(id) {
    return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}
function fmtTrackState(snap) {
    if (snap.trackReadyState == null)
        return '—';
    return `${snap.trackReadyState}${snap.trackMuted ? ' M' : ''}${snap.trackEnabled === false ? ' D' : ''}`;
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['media-debug__section']} */ ;
/** @type {__VLS_StyleScopedClasses['media-debug__section']} */ ;
/** @type {__VLS_StyleScopedClasses['media-debug__section']} */ ;
/** @type {__VLS_StyleScopedClasses['media-debug__section']} */ ;
/** @type {__VLS_StyleScopedClasses['media-debug__section']} */ ;
/** @type {__VLS_StyleScopedClasses['media-debug__foot']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "media-debug" },
    ...{ class: ({ 'media-debug--collapsed': __VLS_ctx.collapsed }) },
    role: "region",
    'aria-label': "Media diagnostics",
});
/** @type {__VLS_StyleScopedClasses['media-debug']} */ ;
/** @type {__VLS_StyleScopedClasses['media-debug--collapsed']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "media-debug__head" },
});
/** @type {__VLS_StyleScopedClasses['media-debug__head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "media-debug__title" },
});
/** @type {__VLS_StyleScopedClasses['media-debug__title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "media-debug__counts" },
});
/** @type {__VLS_StyleScopedClasses['media-debug__counts']} */ ;
(__VLS_ctx.audioCount);
if (__VLS_ctx.audioStalled > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "media-debug__warn" },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__warn']} */ ;
    (__VLS_ctx.audioStalled);
}
else if (__VLS_ctx.audioElPaused > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "media-debug__warn" },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__warn']} */ ;
    (__VLS_ctx.audioElPaused);
}
(__VLS_ctx.videoCount);
if (__VLS_ctx.videoStalled > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "media-debug__warn" },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__warn']} */ ;
    (__VLS_ctx.videoStalled);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.collapsed = !__VLS_ctx.collapsed;
            // @ts-ignore
            [collapsed, collapsed, collapsed, audioCount, audioStalled, audioStalled, audioElPaused, audioElPaused, videoCount, videoStalled, videoStalled,];
        } },
    ...{ class: "media-debug__toggle" },
    type: "button",
});
/** @type {__VLS_StyleScopedClasses['media-debug__toggle']} */ ;
(__VLS_ctx.collapsed ? '▴' : '▾');
if (!__VLS_ctx.collapsed) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "media-debug__body" },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "media-debug__section" },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
    for (const [r] of __VLS_vFor((__VLS_ctx.audioRows))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (r.peerId),
            ...{ class: ({
                    'media-debug__row--warn': r.audioStalled || (r.hasSrcObject && !r.usingWebAudio && r.paused && !r.muted),
                }) },
        });
        /** @type {__VLS_StyleScopedClasses['media-debug__row--warn']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (__VLS_ctx.shortPeer(r.peerId));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: ({ 'media-debug__warn': r.paused && !r.muted }) },
        });
        /** @type {__VLS_StyleScopedClasses['media-debug__warn']} */ ;
        (r.paused ? 'P' : 'p');
        (r.muted ? 'M' : 'm');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (r.volume.toFixed(2));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (__VLS_ctx.fmtTrackState(r));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (r.usingWebAudio ? 'wa' : '—');
        if (r.usingWebAudio) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (r.gainValue?.toFixed(2) ?? '?');
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: ({ 'media-debug__warn': r.audioCtxState === 'suspended' }) },
        });
        /** @type {__VLS_StyleScopedClasses['media-debug__warn']} */ ;
        (r.audioCtxState);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        if (r.audioStalled) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "media-debug__warn" },
            });
            /** @type {__VLS_StyleScopedClasses['media-debug__warn']} */ ;
        }
        else if (r.audioMutedDurationMs > 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "media-debug__warn" },
            });
            /** @type {__VLS_StyleScopedClasses['media-debug__warn']} */ ;
            (Math.round(r.audioMutedDurationMs / 1000));
        }
        else if (!r.audioEnabled) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        }
        // @ts-ignore
        [collapsed, collapsed, audioRows, shortPeer, fmtTrackState,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "media-debug__section" },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
    for (const [r] of __VLS_vFor((__VLS_ctx.videoRows))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (r.peerId),
            ...{ class: ({ 'media-debug__row--warn': r.stalled }) },
        });
        /** @type {__VLS_StyleScopedClasses['media-debug__row--warn']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (__VLS_ctx.shortPeer(r.peerId));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (r.videoWidth);
        (r.videoHeight);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (r.currentTime.toFixed(2));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (r.readyState);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (__VLS_ctx.fmtTrackState(r));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        if (r.stalled) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "media-debug__warn" },
            });
            /** @type {__VLS_StyleScopedClasses['media-debug__warn']} */ ;
        }
        else if (r.playbackSuppressed) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        }
        else if (r.paused) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        }
        // @ts-ignore
        [shortPeer, fmtTrackState, videoRows,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "media-debug__section" },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "media-debug__drift" },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__drift']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: ({ 'media-debug__warn': __VLS_ctx.driftSuspected }) },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__warn']} */ ;
    (__VLS_ctx.drift.lastDeltaMs);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: ({ 'media-debug__warn': __VLS_ctx.driftSeen }) },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__warn']} */ ;
    (__VLS_ctx.drift.maxDeltaMs);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: ({ 'media-debug__warn': __VLS_ctx.driftSeen }) },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__warn']} */ ;
    (__VLS_ctx.drift.throttledTickCount);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "media-debug__drift-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__drift-hint']} */ ;
    (__VLS_ctx.MEDIA_DEBUG_TIMER_DRIFT_INTERVAL_MS);
    if (__VLS_ctx.driftSeen) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "media-debug__warn media-debug__drift-hint" },
        });
        /** @type {__VLS_StyleScopedClasses['media-debug__warn']} */ ;
        /** @type {__VLS_StyleScopedClasses['media-debug__drift-hint']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "media-debug__section" },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "media-debug__drift" },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__drift']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.resync.softResyncCount);
    if (__VLS_ctx.resync.lastSoftResyncAt > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.resync.lastSoftResyncKind);
        (__VLS_ctx.fmtAge(__VLS_ctx.resync.lastSoftResyncAt));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.resync.hardResyncCount);
    if (__VLS_ctx.resync.lastHardResyncAt > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.resync.lastHardResyncKind);
        (__VLS_ctx.fmtAge(__VLS_ctx.resync.lastHardResyncAt));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: ({ 'media-debug__warn': __VLS_ctx.resync.hardResyncSkippedCount > 0 }) },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__warn']} */ ;
    (__VLS_ctx.resync.hardResyncSkippedCount);
    if (__VLS_ctx.resync.lastHardResyncSkippedAt > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.resync.lastHardResyncSkippedKind);
        (__VLS_ctx.fmtAge(__VLS_ctx.resync.lastHardResyncSkippedAt));
    }
    if (__VLS_ctx.resync.hardResyncSkippedCount > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "media-debug__drift-hint" },
        });
        /** @type {__VLS_StyleScopedClasses['media-debug__drift-hint']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "media-debug__section" },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "media-debug__drift" },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__drift']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: ({ 'media-debug__warn': __VLS_ctx.rafFpsLow }) },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__warn']} */ ;
    (__VLS_ctx.raf.approxFps);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: ({ 'media-debug__warn': __VLS_ctx.rafLongFrames }) },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__warn']} */ ;
    (__VLS_ctx.raf.longFrameCount);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.raf.maxFrameDeltaMs);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "media-debug__drift-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__drift-hint']} */ ;
    (__VLS_ctx.MEDIA_DEBUG_RAF_LONG_FRAME_DELTA_MS);
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "media-debug__section" },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "media-debug__drift" },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__drift']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.ws.currentStatus ?? '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.ws.openCount);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.ws.closeCount);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: ({ 'media-debug__warn': __VLS_ctx.ws.errorCount > 0 }) },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__warn']} */ ;
    (__VLS_ctx.ws.errorCount);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: ({ 'media-debug__warn': __VLS_ctx.ws.reconnectCount > 0 }) },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__warn']} */ ;
    (__VLS_ctx.ws.reconnectCount);
    if (__VLS_ctx.ws.lastTransitionAt > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "media-debug__drift-hint" },
        });
        /** @type {__VLS_StyleScopedClasses['media-debug__drift-hint']} */ ;
        (__VLS_ctx.fmtAge(__VLS_ctx.ws.lastTransitionAt));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "media-debug__section" },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "media-debug__drift" },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__drift']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: ({ 'media-debug__warn': __VLS_ctx.sigStats.producerSyncClientRefreshCount > 0 }) },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__warn']} */ ;
    (__VLS_ctx.sigStats.producerSyncCount);
    if (__VLS_ctx.sigStats.producerSyncClientRefreshCount > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.sigStats.producerSyncClientRefreshCount);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.sigStats.newProducerCount);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.sigStats.producerClosedCount);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.sigStats.roomStateCount);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.sigStats.peerJoinedCount);
    (__VLS_ctx.sigStats.peerLeftCount);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.sigStats.mafiaSnapshotApplyCount);
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "media-debug__section" },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "media-debug__drift" },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__drift']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.videoCount);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.liveVideoTrackCount);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: ({ 'media-debug__warn': __VLS_ctx.tilesWithoutVideoCount > 0 && __VLS_ctx.tilesWithoutVideoCount === __VLS_ctx.videoCount }) },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__warn']} */ ;
    (__VLS_ctx.tilesWithoutVideoCount);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.env.isMafiaView ? 'mafia' : __VLS_ctx.env.isGameRoomView ? 'game-room' : __VLS_ctx.env.isEatFirstView ? 'eat-first' : 'no');
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.env.documentVisibilityState ?? '—');
    if (__VLS_ctx.env.hardwareConcurrency != null) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.env.hardwareConcurrency);
    }
    if (__VLS_ctx.env.deviceMemoryGb != null) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.env.deviceMemoryGb);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "media-debug__drift-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__drift-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.footer, __VLS_intrinsics.footer)({
        ...{ class: "media-debug__foot" },
    });
    /** @type {__VLS_StyleScopedClasses['media-debug__foot']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
}
// @ts-ignore
[videoCount, videoCount, driftSuspected, drift, drift, drift, driftSeen, driftSeen, driftSeen, MEDIA_DEBUG_TIMER_DRIFT_INTERVAL_MS, resync, resync, resync, resync, resync, resync, resync, resync, resync, resync, resync, resync, resync, resync, fmtAge, fmtAge, fmtAge, fmtAge, rafFpsLow, raf, raf, raf, rafLongFrames, MEDIA_DEBUG_RAF_LONG_FRAME_DELTA_MS, ws, ws, ws, ws, ws, ws, ws, ws, ws, sigStats, sigStats, sigStats, sigStats, sigStats, sigStats, sigStats, sigStats, sigStats, sigStats, liveVideoTrackCount, tilesWithoutVideoCount, tilesWithoutVideoCount, tilesWithoutVideoCount, env, env, env, env, env, env, env, env,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
