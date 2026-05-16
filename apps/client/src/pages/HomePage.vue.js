/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, defineAsyncComponent, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import AppEconomySection from '@/pages/app/components/AppEconomySection.vue';
import AppGamesSection from '@/pages/app/components/AppGamesSection.vue';
import AppVideoCallSection from '@/pages/app/components/AppVideoCallSection.vue';
// Beta-access modal is gated behind `?betaAccess=…` query — lazy so the
// modal chunk (and its assets) does not ship with the initial `/app` paint.
const BetaAccessModal = defineAsyncComponent(() => import('@/pages/app/components/BetaAccessModal.vue'));
// WebP is universally supported by every browser we target; the PNG twins
// were dead weight in the bundle (every game card paired a ~10 KB PNG with
// a smaller WebP that the `<picture>` always preferred).
import eatFirstImage from '@/assets/landing/eat-first.webp';
import mafiaImage from '@/assets/landing/mafia.webp';
import nadleImage from '@/assets/landing/nadle.webp';
import nadrawImage from '@/assets/landing/nadraw-phone.webp';
import checkersMarkImage from '@/assets/landing/checkers-mark.svg';
import durakCardImage from '@/assets/landing/durak-card.svg';
import { useAuth } from '@/composables/useAuth';
import { STREAMER_NICK } from '@/eat-first/constants/brand.js';
import { loadCheckersPage, loadEatFirstPage, loadMafiaPage, loadNadleStreamPage } from '@/routerRouteLoaders';
import { prefetchRoute } from '@/utils/routePrefetch';
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuth();
const defaultNadleStreamer = (typeof import.meta.env.VITE_DEFAULT_STREAMER === 'string' && import.meta.env.VITE_DEFAULT_STREAMER.trim()) ||
    STREAMER_NICK;
const callRoute = { name: 'call' };
const eatFirstRoute = { name: 'eat' };
const mafiaRoute = { name: 'mafia' };
const checkersRoute = { name: 'checkers', params: { roomId: 'lobby' }, query: { defaultMode: 'rated' } };
const economyComingSoonRoute = { name: 'home', query: { comingSoon: 'economy' } };
const nadleRoute = computed(() => ({
    name: 'nadle-streamer',
    params: { streamer: defaultNadleStreamer },
}));
const nadrawRoute = computed(() => ({
    name: 'nadraw-show',
    params: { streamer: defaultNadleStreamer },
}));
const prefetchMafia = () => prefetchRoute(loadMafiaPage);
const prefetchNadle = () => prefetchRoute(loadNadleStreamPage);
const prefetchCheckers = () => prefetchRoute(loadCheckersPage);
const prefetchEatFirst = () => prefetchRoute(loadEatFirstPage);
const gameCards = computed(() => [
    {
        id: 'eat-first',
        title: t('home.gameEatFirst'),
        to: eatFirstRoute,
        image: eatFirstImage,
        ariaLabel: t('home.openEatFirst'),
        tone: 'amber',
        prefetch: prefetchEatFirst,
    },
    {
        id: 'mafia',
        title: t('home.gameMafia'),
        to: mafiaRoute,
        image: mafiaImage,
        ariaLabel: t('home.openMafia'),
        tone: 'slate',
        prefetch: prefetchMafia,
    },
    {
        id: 'nadle',
        title: t('home.gameNadle'),
        to: nadleRoute.value,
        image: nadleImage,
        ariaLabel: t('home.openNadle'),
        tone: 'green',
        prefetch: prefetchNadle,
    },
    {
        id: 'nadraw',
        title: t('home.gameNadraw'),
        to: nadrawRoute.value,
        image: nadrawImage,
        ariaLabel: t('home.openNadraw'),
        tone: 'violet',
    },
    {
        id: 'durak',
        title: t('home.gameDurak'),
        image: durakCardImage,
        ariaLabel: t('home.openDurak'),
        tone: 'slate',
        comingSoon: {
            eyebrow: t('home.comingSoonEyebrow'),
            title: t('home.gameDurak'),
            description: t('home.gameDurakComingSoonDesc'),
            status: t('home.comingSoonStatus'),
        },
    },
    {
        id: 'checkers',
        title: t('home.gameCheckers'),
        to: checkersRoute,
        image: checkersMarkImage,
        ariaLabel: t('home.openCheckers'),
        tone: 'amber',
        prefetch: prefetchCheckers,
    },
]);
const economyComingSoonCards = computed(() => [
    {
        id: 'economy',
        title: t('home.economyComingSoonTitle'),
        image: '',
        ariaLabel: t('home.openEconomyComingSoon'),
        modalVisual: 'economy-slot',
        comingSoon: {
            eyebrow: t('home.comingSoonEyebrow'),
            title: t('home.economyComingSoonTitle'),
            description: t('home.economyComingSoonDesc'),
            status: t('home.comingSoonStatus'),
            variant: 'economy',
        },
    },
]);
const needLoginBanner = computed(() => route.query.needLogin === '1');
const authRedirectTarget = computed(() => {
    const r = route.query.authRedirect;
    return typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : '/app/call';
});
const authLoading = computed(() => !auth.loaded.value);
const comingSoonGameId = computed(() => {
    const value = route.query.comingSoon;
    return typeof value === 'string' ? value : null;
});
const betaAccessModalKind = computed(() => {
    const rawValue = route.query.betaAccess;
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (value === 'video-call' || value === 'call')
        return 'video-call';
    if (value === 'mafia')
        return 'mafia';
    if (value === 'eat-first' || value === 'eat')
        return 'eat-first';
    return null;
});
function clearComingSoonGame() {
    if (!('comingSoon' in route.query))
        return;
    const query = { ...route.query };
    delete query.comingSoon;
    void router.replace({ name: 'home', query });
}
function closeBetaAccessModal() {
    if (!('betaAccess' in route.query))
        return;
    const query = { ...route.query };
    delete query.betaAccess;
    void router.replace({ name: 'home', query });
}
watch(() => route.query.needLogin, (need) => {
    if (need === '1') {
        void router.replace({
            name: 'auth',
            query: {
                redirect: authRedirectTarget.value,
                mode: 'login',
            },
        });
    }
}, { immediate: true });
watch(() => [route.query.needLogin, auth.isAuthenticated.value, route.query.authRedirect], ([need, authed, redir]) => {
    if (need === '1' && authed && typeof redir === 'string' && redir.startsWith('/')) {
        void router.replace(redir);
    }
}, { immediate: true });
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['app-home__feature-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['app-home']} */ ;
/** @type {__VLS_StyleScopedClasses['app-home__main']} */ ;
/** @type {__VLS_StyleScopedClasses['app-home__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['app-home__feature-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['app-home']} */ ;
/** @type {__VLS_StyleScopedClasses['app-home__main']} */ ;
/** @type {__VLS_StyleScopedClasses['app-home__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['app-home__feature-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['app-home__main']} */ ;
/** @type {__VLS_StyleScopedClasses['app-home__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['app-home__feature-stack']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-home" },
    'aria-busy': (__VLS_ctx.authLoading),
});
/** @type {__VLS_StyleScopedClasses['app-home']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-home__shell" },
});
/** @type {__VLS_StyleScopedClasses['app-home__shell']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.main, __VLS_intrinsics.main)({
    ...{ class: "app-home__main" },
});
/** @type {__VLS_StyleScopedClasses['app-home__main']} */ ;
if (__VLS_ctx.needLoginBanner) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "app-home__auth-banner" },
        role: "status",
    });
    /** @type {__VLS_StyleScopedClasses['app-home__auth-banner']} */ ;
    (__VLS_ctx.t('app.authNeedLogin'));
    (__VLS_ctx.t('app.authNeedLoginHeaderHint'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-home__grid" },
});
/** @type {__VLS_StyleScopedClasses['app-home__grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-home__feature-stack" },
});
/** @type {__VLS_StyleScopedClasses['app-home__feature-stack']} */ ;
const __VLS_0 = AppVideoCallSection;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    to: (__VLS_ctx.callRoute),
    authHint: (__VLS_ctx.t('home.openVideoCall')),
}));
const __VLS_2 = __VLS_1({
    to: (__VLS_ctx.callRoute),
    authHint: (__VLS_ctx.t('home.openVideoCall')),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const __VLS_5 = AppEconomySection;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    to: (__VLS_ctx.economyComingSoonRoute),
}));
const __VLS_7 = __VLS_6({
    to: (__VLS_ctx.economyComingSoonRoute),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
const __VLS_10 = AppGamesSection;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    ...{ 'onComingSoonClose': {} },
    items: (__VLS_ctx.gameCards),
    modalItems: (__VLS_ctx.economyComingSoonCards),
    comingSoonItemId: (__VLS_ctx.comingSoonGameId),
}));
const __VLS_12 = __VLS_11({
    ...{ 'onComingSoonClose': {} },
    items: (__VLS_ctx.gameCards),
    modalItems: (__VLS_ctx.economyComingSoonCards),
    comingSoonItemId: (__VLS_ctx.comingSoonGameId),
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
let __VLS_15;
const __VLS_16 = ({ comingSoonClose: {} },
    { onComingSoonClose: (__VLS_ctx.clearComingSoonGame) });
var __VLS_13;
var __VLS_14;
if (__VLS_ctx.betaAccessModalKind) {
    let __VLS_17;
    /** @ts-ignore @type { | typeof __VLS_components.BetaAccessModal} */
    BetaAccessModal;
    // @ts-ignore
    const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({
        ...{ 'onClose': {} },
        open: (true),
        kind: (__VLS_ctx.betaAccessModalKind),
    }));
    const __VLS_19 = __VLS_18({
        ...{ 'onClose': {} },
        open: (true),
        kind: (__VLS_ctx.betaAccessModalKind),
    }, ...__VLS_functionalComponentArgsRest(__VLS_18));
    let __VLS_22;
    const __VLS_23 = ({ close: {} },
        { onClose: (__VLS_ctx.closeBetaAccessModal) });
    var __VLS_20;
    var __VLS_21;
}
// @ts-ignore
[authLoading, needLoginBanner, t, t, t, callRoute, economyComingSoonRoute, gameCards, economyComingSoonCards, comingSoonGameId, clearComingSoonGame, betaAccessModalKind, betaAccessModalKind, closeBetaAccessModal,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
