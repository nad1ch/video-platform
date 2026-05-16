/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
const __VLS_props = defineProps({
    label: { type: String, required: true },
    icon: { type: String, required: true },
});
const emit = defineEmits(['click']);
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
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('click');
            // @ts-ignore
            [emit,];
        } },
    type: "button",
    ...{ class: "theme-toggle" },
    title: (__VLS_ctx.label),
    'aria-label': (__VLS_ctx.label),
});
/** @type {__VLS_StyleScopedClasses['theme-toggle']} */ ;
(__VLS_ctx.icon);
// @ts-ignore
[label, label, icon,];
const __VLS_export = (await import('vue')).defineComponent({
    emits: {},
    props: {
        label: { type: String, required: true },
        icon: { type: String, required: true },
    },
});
export default {};
