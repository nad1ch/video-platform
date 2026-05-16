/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
const __VLS_props = defineProps();
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['game-room-page-shell']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "game-room-page-shell" },
    ...{ class: ([
            __VLS_ctx.routeClass,
            {
                [`${__VLS_ctx.routeClass}--view-mode`]: __VLS_ctx.isViewMode,
                [`${__VLS_ctx.routeClass}--stream-view`]: __VLS_ctx.isViewMode,
            },
        ]) },
});
/** @type {__VLS_StyleScopedClasses['game-room-page-shell']} */ ;
if (__VLS_ctx.signalingWarningVisible) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "game-room-page-shell__signaling-warning" },
        role: "alert",
    });
    /** @type {__VLS_StyleScopedClasses['game-room-page-shell__signaling-warning']} */ ;
    (__VLS_ctx.signalingWarningText);
}
var __VLS_0 = {};
var __VLS_2 = {};
var __VLS_4 = {};
var __VLS_6 = {};
// @ts-ignore
var __VLS_1 = __VLS_0, __VLS_3 = __VLS_2, __VLS_5 = __VLS_4, __VLS_7 = __VLS_6;
// @ts-ignore
[routeClass, routeClass, routeClass, isViewMode, isViewMode, signalingWarningVisible, signalingWarningText,];
const __VLS_base = (await import('vue')).defineComponent({
    __typeProps: {},
});
const __VLS_export = {};
export default {};
