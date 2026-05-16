/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { eatViewFromRoute } from '@/eat-first';
import { STREAMER_NICK } from '@/eat-first/constants/brand.js';
import { useAuth } from '@/composables/useAuth';
const defaultNadleStreamer = (typeof import.meta.env.VITE_DEFAULT_STREAMER === 'string' && import.meta.env.VITE_DEFAULT_STREAMER.trim()) ||
    STREAMER_NICK;
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { isAdmin } = useAuth();
const showHomeLink = computed(() => route.name !== 'home');
const showEatBack = computed(() => route.path.startsWith('/app/eat') && eatViewFromRoute(route) !== 'call');
function goEatBack() {
    if (!showEatBack.value)
        return;
    router.back();
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['stream-nav__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-nav__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-nav__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-nav__trailing']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-nav__link']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-nav__link']} */ ;
/** @type {__VLS_StyleScopedClasses['router-link-active']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-nav__link']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-nav__link']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-nav']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-nav__leading']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-nav__links']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-nav__trailing-spacer']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-nav__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-nav__icon--btn']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-nav__svg']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-nav__link']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
    ...{ class: "stream-nav" },
    'aria-label': (__VLS_ctx.t('app.navAria')),
});
/** @type {__VLS_StyleScopedClasses['stream-nav']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stream-nav__leading" },
});
/** @type {__VLS_StyleScopedClasses['stream-nav__leading']} */ ;
if (__VLS_ctx.showHomeLink) {
    let __VLS_0;
    /** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
    RouterLink;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ class: "stream-nav__icon" },
        to: ({ name: 'home' }),
        'aria-label': (__VLS_ctx.t('app.navHome')),
        title: (__VLS_ctx.t('app.navHome')),
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: "stream-nav__icon" },
        to: ({ name: 'home' }),
        'aria-label': (__VLS_ctx.t('app.navHome')),
        title: (__VLS_ctx.t('app.navHome')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    /** @type {__VLS_StyleScopedClasses['stream-nav__icon']} */ ;
    const { default: __VLS_5 } = __VLS_3.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        ...{ class: "stream-nav__svg" },
        xmlns: "http://www.w3.org/2000/svg",
        fill: "none",
        viewBox: "0 0 24 24",
        'stroke-width': "1.75",
        stroke: "currentColor",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['stream-nav__svg']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25",
    });
    // @ts-ignore
    [t, t, t, showHomeLink,];
    var __VLS_3;
}
if (__VLS_ctx.showEatBack) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.goEatBack) },
        type: "button",
        ...{ class: "stream-nav__icon stream-nav__icon--btn" },
        'aria-label': (__VLS_ctx.t('app.navBack')),
        title: (__VLS_ctx.t('app.navBack')),
    });
    /** @type {__VLS_StyleScopedClasses['stream-nav__icon']} */ ;
    /** @type {__VLS_StyleScopedClasses['stream-nav__icon--btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        ...{ class: "stream-nav__svg" },
        xmlns: "http://www.w3.org/2000/svg",
        fill: "none",
        viewBox: "0 0 24 24",
        'stroke-width': "1.75",
        stroke: "currentColor",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['stream-nav__svg']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18",
    });
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stream-nav__links" },
});
/** @type {__VLS_StyleScopedClasses['stream-nav__links']} */ ;
let __VLS_6;
/** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
RouterLink;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
    ...{ class: "stream-nav__link" },
    to: ({ name: 'nadle-streamer', params: { streamer: __VLS_ctx.defaultNadleStreamer } }),
}));
const __VLS_8 = __VLS_7({
    ...{ class: "stream-nav__link" },
    to: ({ name: 'nadle-streamer', params: { streamer: __VLS_ctx.defaultNadleStreamer } }),
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
/** @type {__VLS_StyleScopedClasses['stream-nav__link']} */ ;
const { default: __VLS_11 } = __VLS_9.slots;
(__VLS_ctx.t('app.navNadle'));
// @ts-ignore
[t, t, t, showEatBack, goEatBack, defaultNadleStreamer,];
var __VLS_9;
let __VLS_12;
/** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
RouterLink;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
    ...{ class: "stream-nav__link" },
    to: ({ name: 'nadraw-show', params: { streamer: __VLS_ctx.defaultNadleStreamer } }),
    title: (__VLS_ctx.t('routes.nadrawShow')),
    'aria-label': (__VLS_ctx.t('routes.nadrawShow')),
}));
const __VLS_14 = __VLS_13({
    ...{ class: "stream-nav__link" },
    to: ({ name: 'nadraw-show', params: { streamer: __VLS_ctx.defaultNadleStreamer } }),
    title: (__VLS_ctx.t('routes.nadrawShow')),
    'aria-label': (__VLS_ctx.t('routes.nadrawShow')),
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
/** @type {__VLS_StyleScopedClasses['stream-nav__link']} */ ;
const { default: __VLS_17 } = __VLS_15.slots;
(__VLS_ctx.t('app.navNadrawShow'));
// @ts-ignore
[t, t, t, defaultNadleStreamer,];
var __VLS_15;
let __VLS_18;
/** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
RouterLink;
// @ts-ignore
const __VLS_19 = __VLS_asFunctionalComponent1(__VLS_18, new __VLS_18({
    ...{ class: "stream-nav__link" },
    to: ({ name: 'eat' }),
    title: (__VLS_ctx.t('game.title')),
    'aria-label': (__VLS_ctx.t('game.title')),
}));
const __VLS_20 = __VLS_19({
    ...{ class: "stream-nav__link" },
    to: ({ name: 'eat' }),
    title: (__VLS_ctx.t('game.title')),
    'aria-label': (__VLS_ctx.t('game.title')),
}, ...__VLS_functionalComponentArgsRest(__VLS_19));
/** @type {__VLS_StyleScopedClasses['stream-nav__link']} */ ;
const { default: __VLS_23 } = __VLS_21.slots;
(__VLS_ctx.t('app.navEat'));
// @ts-ignore
[t, t, t,];
var __VLS_21;
let __VLS_24;
/** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
RouterLink;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent1(__VLS_24, new __VLS_24({
    ...{ class: "stream-nav__link" },
    to: ({ name: 'call' }),
    title: (__VLS_ctx.t('app.navCallTitle')),
    'aria-label': (__VLS_ctx.t('app.navCallTitle')),
}));
const __VLS_26 = __VLS_25({
    ...{ class: "stream-nav__link" },
    to: ({ name: 'call' }),
    title: (__VLS_ctx.t('app.navCallTitle')),
    'aria-label': (__VLS_ctx.t('app.navCallTitle')),
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
/** @type {__VLS_StyleScopedClasses['stream-nav__link']} */ ;
const { default: __VLS_29 } = __VLS_27.slots;
(__VLS_ctx.t('app.navCall'));
// @ts-ignore
[t, t, t,];
var __VLS_27;
let __VLS_30;
/** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
RouterLink;
// @ts-ignore
const __VLS_31 = __VLS_asFunctionalComponent1(__VLS_30, new __VLS_30({
    ...{ class: "stream-nav__link" },
    to: ({ name: 'mafia' }),
    title: (__VLS_ctx.t('routes.mafia')),
    'aria-label': (__VLS_ctx.t('routes.mafia')),
}));
const __VLS_32 = __VLS_31({
    ...{ class: "stream-nav__link" },
    to: ({ name: 'mafia' }),
    title: (__VLS_ctx.t('routes.mafia')),
    'aria-label': (__VLS_ctx.t('routes.mafia')),
}, ...__VLS_functionalComponentArgsRest(__VLS_31));
/** @type {__VLS_StyleScopedClasses['stream-nav__link']} */ ;
const { default: __VLS_35 } = __VLS_33.slots;
(__VLS_ctx.t('app.navMafia'));
// @ts-ignore
[t, t, t,];
var __VLS_33;
let __VLS_36;
/** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
RouterLink;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent1(__VLS_36, new __VLS_36({
    ...{ class: "stream-nav__link" },
    to: ({ name: 'coin-hub' }),
    title: (__VLS_ctx.t('routes.coinHub')),
    'aria-label': (__VLS_ctx.t('app.navCoinHub')),
}));
const __VLS_38 = __VLS_37({
    ...{ class: "stream-nav__link" },
    to: ({ name: 'coin-hub' }),
    title: (__VLS_ctx.t('routes.coinHub')),
    'aria-label': (__VLS_ctx.t('app.navCoinHub')),
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
/** @type {__VLS_StyleScopedClasses['stream-nav__link']} */ ;
const { default: __VLS_41 } = __VLS_39.slots;
(__VLS_ctx.t('app.navCoinHub'));
// @ts-ignore
[t, t, t,];
var __VLS_39;
if (__VLS_ctx.isAdmin) {
    let __VLS_42;
    /** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
    RouterLink;
    // @ts-ignore
    const __VLS_43 = __VLS_asFunctionalComponent1(__VLS_42, new __VLS_42({
        ...{ class: "stream-nav__link" },
        ...{ class: ({ 'router-link-active stream-nav__link--active': __VLS_ctx.route.path.startsWith('/app/admin') }) },
        to: ({ name: 'admin-users' }),
        title: (__VLS_ctx.t('routes.admin')),
        'aria-label': (__VLS_ctx.t('routes.admin')),
    }));
    const __VLS_44 = __VLS_43({
        ...{ class: "stream-nav__link" },
        ...{ class: ({ 'router-link-active stream-nav__link--active': __VLS_ctx.route.path.startsWith('/app/admin') }) },
        to: ({ name: 'admin-users' }),
        title: (__VLS_ctx.t('routes.admin')),
        'aria-label': (__VLS_ctx.t('routes.admin')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_43));
    /** @type {__VLS_StyleScopedClasses['stream-nav__link']} */ ;
    /** @type {__VLS_StyleScopedClasses['router-link-active']} */ ;
    /** @type {__VLS_StyleScopedClasses['stream-nav__link--active']} */ ;
    const { default: __VLS_47 } = __VLS_45.slots;
    (__VLS_ctx.t('routes.admin'));
    // @ts-ignore
    [t, t, t, isAdmin, route,];
    var __VLS_45;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stream-nav__trailing" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['stream-nav__trailing']} */ ;
if (__VLS_ctx.showHomeLink || __VLS_ctx.showEatBack) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        ...{ class: "stream-nav__trailing-spacer" },
    });
    /** @type {__VLS_StyleScopedClasses['stream-nav__trailing-spacer']} */ ;
}
// @ts-ignore
[showHomeLink, showEatBack,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
