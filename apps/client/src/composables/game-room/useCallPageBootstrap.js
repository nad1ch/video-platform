import { onMounted, onUnmounted } from 'vue';
import { normalizeDisplayName } from 'call-core';
export function useCallPageBootstrap(options) {
    const { session, user, ensureAuthLoaded, stageSize, orderedTiles, callAuthReady } = options;
    onMounted(() => {
        void (async () => {
            await ensureAuthLoaded();
            const authName = normalizeDisplayName(user.value?.displayName);
            const cur = normalizeDisplayName(session.selfDisplayName);
            if (authName && (!cur || cur === 'You')) {
                session.selfDisplayName = authName;
            }
            callAuthReady.value = true;
        })();
        try {
            const q = new URLSearchParams(window.location.search).get('callDebug');
            if (q === '1' || q === 'true') {
                session.setCallDebugOverlay(true);
            }
        }
        catch {
            /* ignore */
        }
        if (import.meta.env.DEV) {
            ;
            globalThis.__CALL_DEBUG__ = {
                stageSize,
                orderedTiles,
            };
        }
    });
    onUnmounted(() => {
        if (import.meta.env.DEV) {
            delete globalThis.__CALL_DEBUG__;
        }
    });
}
