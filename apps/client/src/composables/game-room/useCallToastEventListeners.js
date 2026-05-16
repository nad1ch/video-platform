import { onMounted, onUnmounted } from 'vue';
/**
 * Block 27 — registers window event listeners that push prefixed toasts
 * onto the shared `callToasts` ring. Extracted from `CallPage.vue` and
 * `GameTemplateCallPage.vue`, which carried three / two near-identical
 * handler functions plus matching `window.addEventListener` /
 * `removeEventListener` pairs:
 *
 *   - Mafia OBS-URL-copied  (`mafia-obs-…`,    text from i18n)
 *   - EatFirst OBS-URL-copied (`eat-first-obs-…`, route-gated)
 *   - Mafia / GameRoom Settings (`mafia-settings-…` / `gameroom-settings-…`,
 *     kind `'leave'`, optional `event.detail.text` override)
 *   - GameRoom OBS-URL-copied (`gameroom-obs-…`)
 *
 * Each handler followed an identical "push toast with route-specific id
 * prefix + auto-dismiss after 4200 ms" pattern. The id-prefix shape
 * (`<prefix>-<Date.now()>`) is preserved 1:1 from the pages because it
 * is the existing observable shape (Block 25 intentionally did NOT route
 * these through `pushCallToast`'s random-suffix id).
 *
 * The composable is store-free / protocol-free. The route-specific
 * event names + i18n callbacks are supplied as inputs.
 */
const DEFAULT_TOAST_TTL_MS = 4200;
export function useCallToastEventListeners(options) {
    const { callToasts, events } = options;
    // One bound handler per descriptor so the matching `removeEventListener`
    // can pass the same function reference.
    const boundHandlers = [];
    for (const descriptor of events) {
        const kind = descriptor.kind ?? 'join';
        const ttlMs = descriptor.ttlMs ?? DEFAULT_TOAST_TTL_MS;
        const handler = (event) => {
            const text = descriptor.getText(event);
            if (text == null) {
                return;
            }
            const id = `${descriptor.idPrefix}-${Date.now()}`;
            callToasts.value = [...callToasts.value, { id, text, kind }];
            window.setTimeout(() => {
                callToasts.value = callToasts.value.filter((x) => x.id !== id);
            }, ttlMs);
        };
        boundHandlers.push({ eventName: descriptor.eventName, handler });
    }
    onMounted(() => {
        for (const { eventName, handler } of boundHandlers) {
            window.addEventListener(eventName, handler);
        }
    });
    onUnmounted(() => {
        for (const { eventName, handler } of boundHandlers) {
            window.removeEventListener(eventName, handler);
        }
    });
}
