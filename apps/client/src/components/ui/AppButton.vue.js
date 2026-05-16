/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
const __VLS_props = withDefaults(defineProps(), { variant: 'secondary', type: 'button', disabled: false, title: undefined });
const __VLS_defaults = { variant: 'secondary', type: 'button', disabled: false, title: undefined };
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['app-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['app-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['app-btn--primary']} */ ;
/** @type {__VLS_StyleScopedClasses['app-btn--ghost']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    type: (__VLS_ctx.type),
    ...{ class: "app-btn" },
    ...{ class: (`app-btn--${__VLS_ctx.variant}`) },
    disabled: (__VLS_ctx.disabled),
    title: (__VLS_ctx.title),
});
/** @type {__VLS_StyleScopedClasses['app-btn']} */ ;
var __VLS_0 = {};
// @ts-ignore
var __VLS_1 = __VLS_0;
// @ts-ignore
[type, variant, disabled, title,];
const __VLS_base = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
const __VLS_export = {};
export default {};
