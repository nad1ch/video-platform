/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, onMounted, ref } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import AppFullPageLoader from '@/components/ui/AppFullPageLoader.vue';
import BillingToastSurface from '@/components/billing/BillingToastSurface.vue';
import { useAuth } from '@/composables/useAuth';
import { useSaTooltips } from '@/composables/useSaTooltips';
import { routeNavLoadingVisible } from '@/routeNavLoading';
import mainCloudSrc from '@/assets/landing/clouds/cloud-wide-volumetric.webp';
import '@/eat-first/styles/motion.css';
const { t } = useI18n();
const route = useRoute();
const initialAppLoading = ref(true);
const routeLoading = computed(() => routeNavLoadingVisible.value);
const pageLoading = computed(() => initialAppLoading.value || routeLoading.value);
function isVisualCloudRoute() {
    if (route.name === 'landing' || route.name === 'home') {
        return true;
    }
    if (typeof window === 'undefined') {
        return false;
    }
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    return path === '/' || path === '/app';
}
function ensureMainCloudPreload() {
    if (typeof document === 'undefined') {
        return;
    }
    if (document.querySelector(`link[rel="preload"][href="${mainCloudSrc}"]`)) {
        return;
    }
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = mainCloudSrc;
    link.type = 'image/webp';
    link.fetchPriority = 'high';
    document.head.append(link);
}
function waitForMainCloud() {
    if (typeof window === 'undefined') {
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        const img = new Image();
        let done = false;
        const finish = () => {
            if (done) {
                return;
            }
            done = true;
            resolve();
        };
        img.onload = finish;
        img.onerror = finish;
        img.decoding = 'async';
        img.fetchPriority = 'high';
        img.src = mainCloudSrc;
        window.setTimeout(finish, 2500);
    });
}
if (isVisualCloudRoute()) {
    ensureMainCloudPreload();
}
useSaTooltips();
onMounted(async () => {
    try {
        /**
         * Kick off auth refresh without blocking the initial paint. Private
         * routes are protected by `router.beforeEach` (`ensureAuthLoaded`),
         * and the full-page loader stays visible while `routeNavLoading` is
         * still true — so we can't reveal private UI early just because the
         * loader's `initialAppLoading` flag flipped. Pinning the loader on a
         * slow `/api/auth/me` was the dominant LCP regression on `/app`.
         */
        void useAuth().refresh();
        if (isVisualCloudRoute()) {
            await waitForMainCloud();
        }
    }
    finally {
        initialAppLoading.value = false;
    }
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-root" },
});
/** @type {__VLS_StyleScopedClasses['app-root']} */ ;
const __VLS_0 = AppFullPageLoader;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    visible: (__VLS_ctx.pageLoading),
    'aria-label': (__VLS_ctx.t('app.routeLoadingAria')),
    label: (__VLS_ctx.initialAppLoading ? __VLS_ctx.t('loader.default') : ''),
}));
const __VLS_2 = __VLS_1({
    visible: (__VLS_ctx.pageLoading),
    'aria-label': (__VLS_ctx.t('app.routeLoadingAria')),
    label: (__VLS_ctx.initialAppLoading ? __VLS_ctx.t('loader.default') : ''),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
/** @ts-ignore @type { | typeof __VLS_components.RouterView} */
RouterView;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({}));
const __VLS_7 = __VLS_6({}, ...__VLS_functionalComponentArgsRest(__VLS_6));
const __VLS_10 = BillingToastSurface;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({}));
const __VLS_12 = __VLS_11({}, ...__VLS_functionalComponentArgsRest(__VLS_11));
// @ts-ignore
[pageLoading, t, t, initialAppLoading,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
