/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { BRAND_LOGO_DARK_SVG, BRAND_LOGO_LIGHT_SVG, STREAMER_NICK, STREAMER_TWITCH_URL, } from '@/eat-first/constants/brand.js';
import { useTheme } from '@/eat-first/state/useTheme.js';
const __VLS_props = defineProps();
const route = useRoute();
const { t } = useI18n();
const twitchChannelAria = computed(() => t('app.twitchAria', { nick: STREAMER_NICK }));
const footerLineKey = computed(() => route.meta.footerContext === 'eat' ? 'app.footerLineEat' : 'app.footerLineStream');
const eggOpen = ref(false);
const stickIn = ref(false);
function toggleStick(ev) {
    ev.stopPropagation();
    stickIn.value = !stickIn.value;
}
function closeEgg() {
    eggOpen.value = false;
}
function onDocKeydown(ev) {
    if (ev.key === 'Escape' && eggOpen.value) {
        ev.preventDefault();
        closeEgg();
    }
}
watch(eggOpen, (open) => {
    if (typeof document === 'undefined')
        return;
    if (open) {
        stickIn.value = false;
        document.addEventListener('keydown', onDocKeydown);
    }
    else {
        document.removeEventListener('keydown', onDocKeydown);
    }
});
onUnmounted(() => {
    if (typeof document !== 'undefined')
        document.removeEventListener('keydown', onDocKeydown);
});
const { theme } = useTheme();
const footerPrimaryLogo = computed(() => (theme.value === 'dark' ? BRAND_LOGO_LIGHT_SVG : BRAND_LOGO_DARK_SVG));
const footerFallbackLogo = computed(() => (theme.value === 'dark' ? BRAND_LOGO_DARK_SVG : BRAND_LOGO_LIGHT_SVG));
const footerLogoSrc = ref(footerPrimaryLogo.value);
watch(footerPrimaryLogo, (next) => {
    footerLogoSrc.value = next;
});
function onFooterLogoError() {
    if (footerLogoSrc.value === footerPrimaryLogo.value) {
        footerLogoSrc.value = footerFallbackLogo.value;
        return;
    }
    footerLogoSrc.value = '';
}
function footerInitial() {
    const s = String(STREAMER_NICK ?? 'N').trim();
    return (s[0] ?? 'N').toUpperCase();
}
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['app-site-footer__copy-symbol']} */ ;
/** @type {__VLS_StyleScopedClasses['app-site-footer__copy-symbol']} */ ;
/** @type {__VLS_StyleScopedClasses['footer-egg-close']} */ ;
/** @type {__VLS_StyleScopedClasses['footer-egg-scene']} */ ;
/** @type {__VLS_StyleScopedClasses['footer-egg-stick']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.footer, __VLS_intrinsics.footer)({
    ...{ class: "app-site-footer" },
});
/** @type {__VLS_StyleScopedClasses['app-site-footer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-site-footer__inner" },
});
/** @type {__VLS_StyleScopedClasses['app-site-footer__inner']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ class: "app-site-footer__brand-link" },
    href: (__VLS_ctx.STREAMER_TWITCH_URL),
    target: "_blank",
    rel: "noopener noreferrer",
    'aria-label': (__VLS_ctx.twitchChannelAria),
});
/** @type {__VLS_StyleScopedClasses['app-site-footer__brand-link']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-site-footer__logo-wrap" },
});
/** @type {__VLS_StyleScopedClasses['app-site-footer__logo-wrap']} */ ;
if (__VLS_ctx.footerLogoSrc) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        ...{ onError: (__VLS_ctx.onFooterLogoError) },
        ...{ class: "app-site-footer__logo" },
        src: (__VLS_ctx.footerLogoSrc),
        width: "44",
        height: "44",
        alt: "",
        decoding: "async",
        fetchpriority: "low",
    });
    /** @type {__VLS_StyleScopedClasses['app-site-footer__logo']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "app-site-footer__logo-fallback" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['app-site-footer__logo-fallback']} */ ;
    (__VLS_ctx.footerInitial());
}
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "app-site-footer__nick" },
});
/** @type {__VLS_StyleScopedClasses['app-site-footer__nick']} */ ;
(__VLS_ctx.STREAMER_NICK);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-site-footer__meta" },
});
/** @type {__VLS_StyleScopedClasses['app-site-footer__meta']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "app-site-footer__copy" },
});
/** @type {__VLS_StyleScopedClasses['app-site-footer__copy']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.eggOpen = true;
            // @ts-ignore
            [STREAMER_TWITCH_URL, twitchChannelAria, footerLogoSrc, footerLogoSrc, onFooterLogoError, footerInitial, STREAMER_NICK, eggOpen,];
        } },
    type: "button",
    ...{ class: "app-site-footer__copy-symbol" },
    'aria-label': (__VLS_ctx.t('app.footerEggTriggerAria')),
});
/** @type {__VLS_StyleScopedClasses['app-site-footer__copy-symbol']} */ ;
(__VLS_ctx.t('app.footerCopyrightSymbol'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "app-site-footer__copy-rest" },
});
/** @type {__VLS_StyleScopedClasses['app-site-footer__copy-rest']} */ ;
(__VLS_ctx.t(__VLS_ctx.footerLineKey, { year: __VLS_ctx.year, nick: __VLS_ctx.STREAMER_NICK }));
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    to: "body",
}));
const __VLS_2 = __VLS_1({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
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
[STREAMER_NICK, eggOpen, t, t, t, t, t, t, t, footerLineKey, year, closeEgg, closeEgg, toggleStick, toggleStick, toggleStick, stickIn,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
