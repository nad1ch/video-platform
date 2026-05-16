import { onUnmounted, watch } from 'vue';
/**
 * Block 27 — toggles the `sa-call-route` class on `<html>` while the
 * current route is a call route, with cleanup on unmount.
 *
 * Both `CallPage.vue` and `GameTemplateCallPage.vue` carried a
 * byte-identical inline declaration:
 *
 *   const CALL_ROUTE_HTML_CLASS = 'sa-call-route'
 *   watch(() => isCallAppRoute.value, (onCallShell) => {
 *     if (typeof document === 'undefined') return
 *     document.documentElement.classList.toggle(CALL_ROUTE_HTML_CLASS, onCallShell)
 *   }, { immediate: true })
 *
 * …plus a matching `document.documentElement.classList.remove(...)` in
 * `onUnmounted`. The shared `CallPage.css` rule (`html.sa-call-route { … }`)
 * stays untouched.
 *
 * Pure: no stores / protocols / route prefixes. Safe to consume from any
 * page that owns an `isCallAppRoute` ref.
 */
export const CALL_ROUTE_HTML_CLASS = 'sa-call-route';
export function useCallRouteHtmlClass(isCallAppRoute) {
    watch(() => isCallAppRoute.value, (onCallShell) => {
        if (typeof document === 'undefined')
            return;
        document.documentElement.classList.toggle(CALL_ROUTE_HTML_CLASS, onCallShell);
    }, { immediate: true });
    onUnmounted(() => {
        if (typeof document === 'undefined')
            return;
        document.documentElement.classList.remove(CALL_ROUTE_HTML_CLASS);
    });
}
