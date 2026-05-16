/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
/**
 * Shared elimination-mark SVG renderer used by `ParticipantTile.vue` for
 * the placeholder shown when a tile is dead and video is off. Pure
 * presentational — no store/composable/runtime dependency. Both
 * production Mafia and Game Template render through this component.
 *
 * Originally extracted from the now-removed `MafiaEliminationMark.vue`
 * (see git history at commit `74876d1` for the verbatim presentational
 * copy and the rationale for the neutral relocation).
 */
import { computed } from 'vue';
const props = withDefaults(defineProps(), {});
const iconSrc = computed(() => {
    const value = props.iconSrc;
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : '';
});
const __VLS_defaults = {};
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
if (__VLS_ctx.iconSrc) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        ...{ class: "game-elimination-mark game-elimination-mark--asset" },
        src: (__VLS_ctx.iconSrc),
        alt: "",
        'aria-hidden': "true",
        decoding: "async",
        loading: "lazy",
        draggable: "false",
    });
    /** @type {__VLS_StyleScopedClasses['game-elimination-mark']} */ ;
    /** @type {__VLS_StyleScopedClasses['game-elimination-mark--asset']} */ ;
}
else if (props.kind === 'skull') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        ...{ class: "game-elimination-mark" },
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 64 64",
        fill: "none",
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['game-elimination-mark']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        ...{ class: "m-bg" },
        cx: "32",
        cy: "32",
        r: "28",
    });
    /** @type {__VLS_StyleScopedClasses['m-bg']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.g, __VLS_intrinsics.g)({
        ...{ class: "m-stroke" },
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
    });
    /** @type {__VLS_StyleScopedClasses['m-stroke']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.ellipse)({
        cx: "32",
        cy: "30",
        rx: "10",
        ry: "12",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M25 40h14",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        ...{ class: "m-socket" },
        cx: "25.5",
        cy: "29",
        r: "2.2",
    });
    /** @type {__VLS_StyleScopedClasses['m-socket']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        ...{ class: "m-socket" },
        cx: "38.5",
        cy: "29",
        r: "2.2",
    });
    /** @type {__VLS_StyleScopedClasses['m-socket']} */ ;
}
else if (props.kind === 'ghost') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        ...{ class: "game-elimination-mark" },
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 64 64",
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['game-elimination-mark']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        ...{ class: "m-bg" },
        cx: "32",
        cy: "32",
        r: "28",
    });
    /** @type {__VLS_StyleScopedClasses['m-bg']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        ...{ class: "m-fill" },
        d: "M20 28A12 8 0 0 1 44 28L44 36C40 32 32 40 32 40S24 32 20 36Z",
    });
    /** @type {__VLS_StyleScopedClasses['m-fill']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        ...{ class: "m-void" },
        cx: "25",
        cy: "27",
        r: "2.3",
    });
    /** @type {__VLS_StyleScopedClasses['m-void']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        ...{ class: "m-void" },
        cx: "39",
        cy: "27",
        r: "2.3",
    });
    /** @type {__VLS_StyleScopedClasses['m-void']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        ...{ class: "game-elimination-mark" },
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 64 64",
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['game-elimination-mark']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        ...{ class: "m-bg" },
        cx: "32",
        cy: "32",
        r: "28",
    });
    /** @type {__VLS_StyleScopedClasses['m-bg']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        ...{ class: "m-fill" },
        d: "M28 12h8v16h16v8H36v16h-8V36H12v-8h16V12Z",
    });
    /** @type {__VLS_StyleScopedClasses['m-fill']} */ ;
}
// @ts-ignore
[iconSrc, iconSrc,];
const __VLS_export = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
