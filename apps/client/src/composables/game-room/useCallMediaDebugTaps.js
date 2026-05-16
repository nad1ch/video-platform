import { onBeforeUnmount, onMounted, onUnmounted, watch } from 'vue';
import { installMediaDebugGlobal, isMediaDebugEnabled, recordMediaDebugSignalingIncoming, recordMediaDebugWsTransition, setMediaDebugEnvInfo, startMediaDebugRafProbe, startMediaDebugTimerDriftProbe, } from '@/utils/mediaDebugRuntime';
export function useCallMediaDebugTaps(options) {
    const { wsStatus, subscribeSignalingMessage, requestForcedProducerResync, envInfo } = options;
    // Diagnostics-only WS lifecycle counter. Reads the existing `wsStatus` ref;
    // no call-core change required. Records open/close/error counts and
    // detects `closed → open` (i.e. WS reconnect) transitions for the
    // `?mediaDebug=1` panel + `__MEDIA_DEBUG__.wsStats()` console accessor.
    let lastObservedWsStatus = null;
    watch(() => wsStatus.value, (next) => {
        const nextStr = typeof next === 'string' ? next : String(next);
        if (lastObservedWsStatus === nextStr)
            return;
        recordMediaDebugWsTransition(lastObservedWsStatus, nextStr);
        lastObservedWsStatus = nextStr;
    }, { immediate: true });
    // Diagnostics-only counting subscriber. Does NOT apply state — every other
    // `subscribeSignalingMessage` registration handles real apply paths. This
    // one increments per-type counters so post-incident analysis can correlate
    // flicker / blackout reports with WS message bursts. Cost: one switch +
    // counter per inbound message.
    const offMediaDebugSignalingCounter = subscribeSignalingMessage((data) => {
        if (!data || typeof data !== 'object')
            return;
        const type = data.type;
        if (typeof type !== 'string')
            return;
        if (type === 'producer-sync') {
            const payload = data.payload;
            const syncReason = payload && typeof payload.syncReason === 'string' ? payload.syncReason : undefined;
            recordMediaDebugSignalingIncoming(type, { syncReason });
            return;
        }
        recordMediaDebugSignalingIncoming(type);
    });
    onBeforeUnmount(offMediaDebugSignalingCounter);
    let detachMediaDebugGlobal = null;
    let detachMediaDebugTimerDriftProbe = null;
    let detachMediaDebugRafProbe = null;
    onMounted(() => {
        // Always-on timer-drift probe — diagnostic only, no media side effects.
        // Surfaces OBS browser-source / hidden-tab throttling that would otherwise
        // silently break the StreamVideo currentTime stall watchdog and the
        // StreamAudio AudioContext heartbeat. Cost is one setInterval at 2 s per
        // call route; result accessible via `__MEDIA_DEBUG__.timerDrift()` and
        // surfaced in the `?mediaDebug=1` panel.
        detachMediaDebugTimerDriftProbe = startMediaDebugTimerDriftProbe();
        // Companion rAF probe. setInterval and rAF are throttled differently in
        // some Chromium versions; the rAF probe surfaces render-loop pressure
        // (long frames, low FPS) that the timer-drift probe cannot. Pure counter
        // updates per frame; no DOM access in the callback.
        detachMediaDebugRafProbe = startMediaDebugRafProbe();
        // Stamp env info ONCE at mount. Live `documentVisibilityState` is
        // included by the reader, so no need to track it reactively.
        setMediaDebugEnvInfo(envInfo());
        if (isMediaDebugEnabled()) {
            detachMediaDebugGlobal = installMediaDebugGlobal({
                forceSoftResync: () => {
                    try {
                        requestForcedProducerResync();
                    }
                    catch (err) {
                        console.warn('[mediaDebug] forceSoftResync failed', err);
                    }
                },
            });
        }
    });
    onUnmounted(() => {
        detachMediaDebugTimerDriftProbe?.();
        detachMediaDebugTimerDriftProbe = null;
        detachMediaDebugRafProbe?.();
        detachMediaDebugRafProbe = null;
        detachMediaDebugGlobal?.();
        detachMediaDebugGlobal = null;
    });
}
