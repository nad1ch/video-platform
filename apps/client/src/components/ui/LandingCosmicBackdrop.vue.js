/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref } from 'vue';
import { useLandingCosmicParallax } from '@/composables/useLandingCosmicParallax';
import { landingCosmicGlows, landingCosmicSparkleDots } from '@/utils/landingCosmicDecor';
const canvasEl = ref(null);
useLandingCosmicParallax(canvasEl);
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['lcb-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['lcb-glow']} */ ;
/** @type {__VLS_StyleScopedClasses['lcb-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['lcb-bg']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "landing-cosmic-backdrop" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['landing-cosmic-backdrop']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "canvasEl",
    ...{ class: "lcb-canvas" },
});
/** @type {__VLS_StyleScopedClasses['lcb-canvas']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalDirective(__VLS_directives.vOnce, {})(null, { ...__VLS_directiveBindingRestFields, }, null, null);
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ class: "lcb-bg" },
});
/** @type {__VLS_StyleScopedClasses['lcb-bg']} */ ;
for (const [dot, index] of __VLS_vFor((__VLS_ctx.landingCosmicSparkleDots))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        key: (`lcb-dot-${index}`),
        ...{ class: "lcb-dot" },
        ...{ class: (`lcb-dot--ph${dot.phase}`) },
        ...{ style: (dot.style) },
    });
    /** @type {__VLS_StyleScopedClasses['lcb-dot']} */ ;
    // @ts-ignore
    [landingCosmicSparkleDots,];
}
for (const [glow, index] of __VLS_vFor((__VLS_ctx.landingCosmicGlows))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        key: (`lcb-glow-${index}`),
        ...{ class: "lcb-glow" },
        ...{ style: (glow.style) },
    });
    /** @type {__VLS_StyleScopedClasses['lcb-glow']} */ ;
    // @ts-ignore
    [landingCosmicGlows,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
