/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, ref, watch } from 'vue';
import { createLogger } from '@/utils/logger';
import { BRAND_LOGO_DARK_SVG, BRAND_LOGO_LIGHT_SVG, STREAMER_NICK, STREAMER_TWITCH_URL, } from '../../constants/brand.js';
import { useTheme } from '../../state/useTheme.js';
const brandLinkLog = createLogger('streamer-brand-link');
const props = defineProps({
    ariaLabel: { type: String, required: true },
    logoSize: { type: Number, default: 32 },
    showNick: { type: Boolean, default: false },
});
const logoBoxStyle = () => ({
    width: `${props.logoSize}px`,
    height: `${props.logoSize}px`,
    maxWidth: `${props.logoSize}px`,
    maxHeight: `${props.logoSize}px`,
});
const { theme } = useTheme();
const primaryLogo = computed(() => (theme.value === 'dark' ? BRAND_LOGO_LIGHT_SVG : BRAND_LOGO_DARK_SVG));
const fallbackLogo = computed(() => (theme.value === 'dark' ? BRAND_LOGO_DARK_SVG : BRAND_LOGO_LIGHT_SVG));
const imgSrc = ref(primaryLogo.value);
watch(primaryLogo, (next) => {
    imgSrc.value = next;
});
function onLogoError(ev) {
    const el = ev.target;
    const src = el instanceof HTMLImageElement ? el.currentSrc || el.src : '';
    brandLinkLog.warn('logo image failed to load:', src || '(unknown src)');
    if (imgSrc.value === primaryLogo.value) {
        imgSrc.value = fallbackLogo.value;
        return;
    }
    imgSrc.value = '';
}
function initialNick() {
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
/** @type {__VLS_StyleScopedClasses['app-shell-mini-brand--icon-only']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mini-brand--icon-only']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mini-brand__fallback']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ class: "app-shell-mini-brand" },
    ...{ class: ({ 'app-shell-mini-brand--icon-only': !props.showNick }) },
    href: (__VLS_ctx.STREAMER_TWITCH_URL),
    target: "_blank",
    rel: "noopener noreferrer",
    'aria-label': (__VLS_ctx.ariaLabel),
});
/** @type {__VLS_StyleScopedClasses['app-shell-mini-brand']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mini-brand--icon-only']} */ ;
if (__VLS_ctx.imgSrc) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "app-shell-mini-brand__picture" },
    });
    /** @type {__VLS_StyleScopedClasses['app-shell-mini-brand__picture']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        ...{ onError: (__VLS_ctx.onLogoError) },
        ...{ class: "app-shell-mini-brand__logo" },
        src: (__VLS_ctx.imgSrc),
        width: (props.logoSize),
        height: (props.logoSize),
        ...{ style: (__VLS_ctx.logoBoxStyle()) },
        alt: "",
        decoding: "async",
        fetchpriority: "low",
    });
    /** @type {__VLS_StyleScopedClasses['app-shell-mini-brand__logo']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "app-shell-mini-brand__fallback" },
        ...{ style: (__VLS_ctx.logoBoxStyle()) },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['app-shell-mini-brand__fallback']} */ ;
    (__VLS_ctx.initialNick());
}
if (props.showNick) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "app-shell-mini-brand__nick" },
    });
    /** @type {__VLS_StyleScopedClasses['app-shell-mini-brand__nick']} */ ;
    (__VLS_ctx.STREAMER_NICK);
}
// @ts-ignore
[STREAMER_TWITCH_URL, ariaLabel, imgSrc, imgSrc, onLogoError, logoBoxStyle, logoBoxStyle, initialNick, STREAMER_NICK,];
const __VLS_export = (await import('vue')).defineComponent({
    props: {
        ariaLabel: { type: String, required: true },
        logoSize: { type: Number, default: 32 },
        showNick: { type: Boolean, default: false },
    },
});
export default {};
