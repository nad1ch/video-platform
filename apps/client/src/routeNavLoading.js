import { ref } from 'vue';
import { isNavigationFailure } from 'vue-router';
export const routeNavLoadingDepth = ref(0);
export const routeNavLoadingVisible = ref(false);
const ROUTE_LOADER_SHOW_DELAY_MS = 120;
const ROUTE_LOADER_MIN_VISIBLE_MS = 180;
let showTimer;
let hideTimer;
let shownAt = 0;
function nowMs() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
function clearRouteLoaderTimer(timer) {
    if (timer) {
        clearTimeout(timer);
    }
    return undefined;
}
function syncRouteNavLoadingVisible() {
    if (routeNavLoadingDepth.value > 0) {
        hideTimer = clearRouteLoaderTimer(hideTimer);
        if (routeNavLoadingVisible.value || showTimer) {
            return;
        }
        showTimer = setTimeout(() => {
            showTimer = undefined;
            if (routeNavLoadingDepth.value <= 0) {
                return;
            }
            shownAt = nowMs();
            routeNavLoadingVisible.value = true;
        }, ROUTE_LOADER_SHOW_DELAY_MS);
        return;
    }
    showTimer = clearRouteLoaderTimer(showTimer);
    if (!routeNavLoadingVisible.value) {
        return;
    }
    const remaining = Math.max(0, ROUTE_LOADER_MIN_VISIBLE_MS - (nowMs() - shownAt));
    hideTimer = clearRouteLoaderTimer(hideTimer);
    hideTimer = setTimeout(() => {
        hideTimer = undefined;
        if (routeNavLoadingDepth.value > 0) {
            syncRouteNavLoadingVisible();
            return;
        }
        routeNavLoadingVisible.value = false;
    }, remaining);
}
export function bumpRouteNavLoading() {
    routeNavLoadingDepth.value += 1;
    syncRouteNavLoadingVisible();
}
export function releaseRouteNavLoading() {
    routeNavLoadingDepth.value = Math.max(0, routeNavLoadingDepth.value - 1);
    syncRouteNavLoadingVisible();
}
function releaseRouteNavLoadingAfterPaint() {
    if (typeof window === 'undefined') {
        releaseRouteNavLoading();
        return;
    }
    window.requestAnimationFrame(() => {
        releaseRouteNavLoading();
    });
}
export function installRouteNavLoadingGuards(router) {
    router.beforeEach(() => {
        bumpRouteNavLoading();
    });
    router.afterEach(releaseRouteNavLoadingAfterPaint);
    router.onError(() => {
        releaseRouteNavLoading();
    });
    const { push, replace } = router;
    router.push = function routeNavLoadingPush(to) {
        return push.call(router, to).catch((err) => {
            if (isNavigationFailure(err)) {
                releaseRouteNavLoading();
            }
            return Promise.reject(err);
        });
    };
    router.replace = function routeNavLoadingReplace(to) {
        return replace.call(router, to).catch((err) => {
            if (isNavigationFailure(err)) {
                releaseRouteNavLoading();
            }
            return Promise.reject(err);
        });
    };
}
