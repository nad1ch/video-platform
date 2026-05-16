/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, useSlots } from 'vue';
const __VLS_props = withDefaults(defineProps(), { title: '' });
const slots = useSlots();
const hasCenterSlot = computed(() => Boolean(slots.center));
const __VLS_defaults = { title: '' };
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "app-shell-header" },
    ...{ class: (__VLS_ctx.headerClass) },
});
/** @type {__VLS_StyleScopedClasses['app-shell-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-shell-header__top" },
    ...{ class: ({ 'app-shell-header__top--has-center': __VLS_ctx.hasCenterSlot }) },
});
/** @type {__VLS_StyleScopedClasses['app-shell-header__top']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-header__top--has-center']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-shell-header__start" },
});
/** @type {__VLS_StyleScopedClasses['app-shell-header__start']} */ ;
var __VLS_0 = {};
if (!__VLS_ctx.hasCenterSlot) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "app-shell-brand" },
    });
    /** @type {__VLS_StyleScopedClasses['app-shell-brand']} */ ;
    var __VLS_2 = {};
    (__VLS_ctx.title);
}
if (__VLS_ctx.hasCenterSlot) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "app-shell-header__center" },
    });
    /** @type {__VLS_StyleScopedClasses['app-shell-header__center']} */ ;
    var __VLS_4 = {};
}
var __VLS_6 = {};
var __VLS_8 = {};
// @ts-ignore
var __VLS_1 = __VLS_0, __VLS_3 = __VLS_2, __VLS_5 = __VLS_4, __VLS_7 = __VLS_6, __VLS_9 = __VLS_8;
// @ts-ignore
[headerClass, hasCenterSlot, hasCenterSlot, hasCenterSlot, title,];
const __VLS_base = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
const __VLS_export = {};
export default {};
