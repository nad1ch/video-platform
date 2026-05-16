/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { STREAMER_TWITCH_URL } from '@/eat-first/constants/brand.js';
import AppLandingFooterActions from './AppLandingFooterActions.vue';
const __VLS_props = defineProps();
const emit = defineEmits();
const { t } = useI18n();
const eggOpen = ref(false);
const stickIn = ref(false);
function onDocumentKeydown(event) {
    if (event.key === 'Escape') {
        closeEgg();
    }
}
function toggleStick(event) {
    event.stopPropagation();
    stickIn.value = !stickIn.value;
}
function closeEgg() {
    eggOpen.value = false;
}
function updateLocale(value) {
    emit('update:locale', value);
}
onMounted(() => {
    document.addEventListener('keydown', onDocumentKeydown);
});
onUnmounted(() => {
    document.removeEventListener('keydown', onDocumentKeydown);
});
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
/** @type {__VLS_StyleScopedClasses['app-landing-footer__brand']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer__copy-symbol']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer__brand']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer__copy-symbol']} */ ;
/** @type {__VLS_StyleScopedClasses['footer-egg-close']} */ ;
/** @type {__VLS_StyleScopedClasses['footer-egg-scene']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer__rights']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.footer, __VLS_intrinsics.footer)({
    ...{ class: "app-landing-footer" },
});
/** @type {__VLS_StyleScopedClasses['app-landing-footer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-landing-footer__rights" },
});
/** @type {__VLS_StyleScopedClasses['app-landing-footer__rights']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ class: "app-landing-footer__brand" },
    href: (__VLS_ctx.STREAMER_TWITCH_URL),
    target: "_blank",
    rel: "noopener noreferrer",
    'aria-label': (__VLS_ctx.t('app.twitchAria', { nick: __VLS_ctx.brandName })),
});
/** @type {__VLS_StyleScopedClasses['app-landing-footer__brand']} */ ;
(__VLS_ctx.brandName);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "app-landing-footer__copy" },
});
/** @type {__VLS_StyleScopedClasses['app-landing-footer__copy']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.eggOpen = true;
            // @ts-ignore
            [STREAMER_TWITCH_URL, t, brandName, brandName, eggOpen,];
        } },
    type: "button",
    ...{ class: "app-landing-footer__copy-symbol" },
    'aria-label': (__VLS_ctx.t('app.footerEggTriggerAria')),
});
/** @type {__VLS_StyleScopedClasses['app-landing-footer__copy-symbol']} */ ;
(__VLS_ctx.t('app.footerCopyrightSymbol'));
(__VLS_ctx.t('app.footerRights', { year: __VLS_ctx.year }));
const __VLS_0 = AppLandingFooterActions;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ 'onUpdate:locale': {} },
    feedbackHref: (__VLS_ctx.feedbackHref),
    locale: (__VLS_ctx.locale),
    localeOptions: (__VLS_ctx.localeOptions),
}));
const __VLS_2 = __VLS_1({
    ...{ 'onUpdate:locale': {} },
    feedbackHref: (__VLS_ctx.feedbackHref),
    locale: (__VLS_ctx.locale),
    localeOptions: (__VLS_ctx.localeOptions),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
const __VLS_6 = ({ 'update:locale': {} },
    { 'onUpdate:locale': (__VLS_ctx.updateLocale) });
var __VLS_3;
var __VLS_4;
let __VLS_7;
/** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
    to: "body",
}));
const __VLS_9 = __VLS_8({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
const { default: __VLS_12 } = __VLS_10.slots;
if (__VLS_ctx.eggOpen) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (__VLS_ctx.closeEgg) },
        ...{ class: "footer-egg-backdrop" },
        role: "presentation",
    });
    /** @type {__VLS_StyleScopedClasses['footer-egg-backdrop']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "footer-egg-modal" },
        role: "dialog",
        'aria-modal': "true",
        'aria-label': (__VLS_ctx.t('app.footerEggTriggerAria')),
    });
    /** @type {__VLS_StyleScopedClasses['footer-egg-modal']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeEgg) },
        type: "button",
        ...{ class: "footer-egg-close" },
        'aria-label': (__VLS_ctx.t('app.footerEggClose')),
    });
    /** @type {__VLS_StyleScopedClasses['footer-egg-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (__VLS_ctx.toggleStick) },
        ...{ onKeydown: (__VLS_ctx.toggleStick) },
        ...{ onKeydown: (__VLS_ctx.toggleStick) },
        ...{ class: "footer-egg-scene" },
        role: "button",
        tabindex: "0",
        'aria-label': (__VLS_ctx.t('app.footerEggHint')),
    });
    /** @type {__VLS_StyleScopedClasses['footer-egg-scene']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "footer-egg-perspective" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['footer-egg-perspective']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "footer-egg-world" },
    });
    /** @type {__VLS_StyleScopedClasses['footer-egg-world']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "footer-egg-stick" },
        ...{ class: ({ 'footer-egg-stick--in': __VLS_ctx.stickIn }) },
    });
    /** @type {__VLS_StyleScopedClasses['footer-egg-stick']} */ ;
    /** @type {__VLS_StyleScopedClasses['footer-egg-stick--in']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "footer-egg-donut" },
    });
    /** @type {__VLS_StyleScopedClasses['footer-egg-donut']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "footer-egg-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['footer-egg-hint']} */ ;
    (__VLS_ctx.t('app.footerEggHint'));
}
// @ts-ignore
[t, t, t, t, t, t, t, eggOpen, year, feedbackHref, locale, localeOptions, updateLocale, closeEgg, closeEgg, toggleStick, toggleStick, toggleStick, stickIn,];
var __VLS_10;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
