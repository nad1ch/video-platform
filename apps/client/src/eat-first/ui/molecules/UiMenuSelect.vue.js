/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, onMounted, onUnmounted, ref } from 'vue';
const props = defineProps({
    modelValue: { type: String, required: true },
    options: { type: Array, required: true },
    ariaLabel: { type: String, required: true },
    disabled: { type: Boolean, default: false },
    variant: { type: String, default: 'block' },
});
const emit = defineEmits(['update:modelValue', 'change']);
const open = ref(false);
const rootEl = ref(null);
const displayLabel = computed(() => {
    const row = props.options.find((o) => o.value === props.modelValue);
    return row?.label ?? props.modelValue;
});
function toggle() {
    if (props.disabled)
        return;
    open.value = !open.value;
}
function pick(value) {
    if (props.disabled || value === props.modelValue) {
        open.value = false;
        return;
    }
    emit('update:modelValue', value);
    emit('change', value);
    open.value = false;
}
function onDocPointerDown(ev) {
    if (!open.value || !rootEl.value)
        return;
    if (!rootEl.value.contains(ev.target))
        open.value = false;
}
function onGlobalKeydown(ev) {
    if (ev.key === 'Escape')
        open.value = false;
}
onMounted(() => {
    document.addEventListener('pointerdown', onDocPointerDown, true);
    document.addEventListener('keydown', onGlobalKeydown);
});
onUnmounted(() => {
    document.removeEventListener('pointerdown', onDocPointerDown, true);
    document.removeEventListener('keydown', onGlobalKeydown);
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
/** @type {__VLS_StyleScopedClasses['ui-menu-select']} */ ;
/** @type {__VLS_StyleScopedClasses['ui-menu-select--header']} */ ;
/** @type {__VLS_StyleScopedClasses['ui-menu-select__trigger']} */ ;
/** @type {__VLS_StyleScopedClasses['ui-menu-select__trigger']} */ ;
/** @type {__VLS_StyleScopedClasses['ui-menu-select__trigger']} */ ;
/** @type {__VLS_StyleScopedClasses['ui-menu-select--open']} */ ;
/** @type {__VLS_StyleScopedClasses['ui-menu-select__chev']} */ ;
/** @type {__VLS_StyleScopedClasses['ui-menu-select--header']} */ ;
/** @type {__VLS_StyleScopedClasses['ui-menu-select__list']} */ ;
/** @type {__VLS_StyleScopedClasses['ui-menu-select__opt']} */ ;
/** @type {__VLS_StyleScopedClasses['ui-menu-select__opt']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "rootEl",
    ...{ class: "ui-menu-select" },
    ...{ class: ({ 'ui-menu-select--open': __VLS_ctx.open, 'ui-menu-select--header': __VLS_ctx.variant === 'header' }) },
});
/** @type {__VLS_StyleScopedClasses['ui-menu-select']} */ ;
/** @type {__VLS_StyleScopedClasses['ui-menu-select--open']} */ ;
/** @type {__VLS_StyleScopedClasses['ui-menu-select--header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.toggle) },
    type: "button",
    ...{ class: "ui-menu-select__trigger" },
    ...{ class: ({ 'ui-menu-select__trigger--header': __VLS_ctx.variant === 'header' }) },
    disabled: (__VLS_ctx.disabled),
    'aria-label': (__VLS_ctx.ariaLabel),
    'aria-expanded': (__VLS_ctx.open),
    'aria-haspopup': "listbox",
});
/** @type {__VLS_StyleScopedClasses['ui-menu-select__trigger']} */ ;
/** @type {__VLS_StyleScopedClasses['ui-menu-select__trigger--header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "ui-menu-select__value" },
});
/** @type {__VLS_StyleScopedClasses['ui-menu-select__value']} */ ;
(__VLS_ctx.displayLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "ui-menu-select__chev" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['ui-menu-select__chev']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
Transition;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    name: "ui-menu-select-pop",
}));
const __VLS_2 = __VLS_1({
    name: "ui-menu-select-pop",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
if (__VLS_ctx.open) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "ui-menu-select__list sa-scrollbar" },
        role: "listbox",
        'aria-label': (__VLS_ctx.ariaLabel),
    });
    /** @type {__VLS_StyleScopedClasses['ui-menu-select__list']} */ ;
    /** @type {__VLS_StyleScopedClasses['sa-scrollbar']} */ ;
    for (const [opt] of __VLS_vFor((__VLS_ctx.options))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.open))
                        return;
                    __VLS_ctx.pick(opt.value);
                    // @ts-ignore
                    [open, open, open, variant, variant, toggle, disabled, ariaLabel, ariaLabel, displayLabel, options, pick,];
                } },
            key: (opt.value),
            role: "option",
            ...{ class: "ui-menu-select__opt" },
            ...{ class: ({ 'ui-menu-select__opt--active': opt.value === __VLS_ctx.modelValue }) },
            'aria-selected': (opt.value === __VLS_ctx.modelValue),
        });
        /** @type {__VLS_StyleScopedClasses['ui-menu-select__opt']} */ ;
        /** @type {__VLS_StyleScopedClasses['ui-menu-select__opt--active']} */ ;
        (opt.label);
        // @ts-ignore
        [modelValue, modelValue,];
    }
}
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    emits: {},
    props: {
        modelValue: { type: String, required: true },
        options: { type: Array, required: true },
        ariaLabel: { type: String, required: true },
        disabled: { type: Boolean, default: false },
        variant: { type: String, default: 'block' },
    },
});
export default {};
