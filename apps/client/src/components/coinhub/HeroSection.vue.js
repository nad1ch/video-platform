/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed } from 'vue';
import '@/styles/coinhub-design-system.css';
const PARTICLE_COUNT = 20;
const props = withDefaults(defineProps(), { backgroundPath: 'assets/hero-3200x1000.png' });
const sectionStyle = computed(() => {
    const base = import.meta.env.BASE_URL || '/';
    const root = base.endsWith('/') ? base : `${base}/`;
    return {
        '--hero-poster': `url('${root}${props.backgroundPath}')`,
    };
});
function particleMotionStyle(i) {
    const n = i + 1;
    const left = 6 + ((n * 37) % 86);
    const top = 10 + ((n * 29) % 78);
    const durationS = 5 + (n % 4);
    const delayS = (n * 0.31) % 2.4;
    return {
        left: `${left}%`,
        top: `${top}%`,
        animationDuration: `${durationS}s`,
        animationDelay: `${delayS.toFixed(2)}s`,
    };
}
const __VLS_defaults = { backgroundPath: 'assets/hero-3200x1000.png' };
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['hero']} */ ;
/** @type {__VLS_StyleScopedClasses['hero']} */ ;
/** @type {__VLS_StyleScopedClasses['hero__particles']} */ ;
/** @type {__VLS_StyleScopedClasses['hero']} */ ;
/** @type {__VLS_StyleScopedClasses['hero']} */ ;
/** @type {__VLS_StyleScopedClasses['hero__particles']} */ ;
/** @type {__VLS_StyleScopedClasses['hero__content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "hero-wrapper" },
});
/** @type {__VLS_StyleScopedClasses['hero-wrapper']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "hero w-full min-w-0" },
    ...{ style: (__VLS_ctx.sectionStyle) },
});
/** @type {__VLS_StyleScopedClasses['hero']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "hero__particles" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['hero__particles']} */ ;
for (const [i] of __VLS_vFor((__VLS_ctx.PARTICLE_COUNT))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        key: (i),
        ...{ class: "hero__particle" },
        ...{ style: (__VLS_ctx.particleMotionStyle(i - 1)) },
    });
    /** @type {__VLS_StyleScopedClasses['hero__particle']} */ ;
    // @ts-ignore
    [sectionStyle, PARTICLE_COUNT, particleMotionStyle,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "hero__content" },
});
/** @type {__VLS_StyleScopedClasses['hero__content']} */ ;
var __VLS_0 = {};
// @ts-ignore
var __VLS_1 = __VLS_0;
// @ts-ignore
[];
const __VLS_base = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
const __VLS_export = {};
export default {};
