/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { nextTick, ref, watch } from 'vue';
const props = defineProps({
    open: { type: Boolean, default: false },
    title: { type: String, default: '' },
    message: { type: String, default: '' },
    confirmLabel: { type: String, default: '' },
    cancelLabel: { type: String, default: '' },
    confirmDisabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update:open', 'confirm', 'close']);
const panelRef = ref(null);
const titleId = `confirm-dlg-title-${Math.random().toString(36).slice(2, 9)}`;
const descId = `confirm-dlg-desc-${Math.random().toString(36).slice(2, 9)}`;
function close() {
    emit('close');
    emit('update:open', false);
}
function onConfirm() {
    emit('confirm');
    emit('update:open', false);
}
watch(() => props.open, (v) => {
    if (typeof document === 'undefined')
        return;
    if (v) {
        document.body.style.overflow = 'hidden';
        nextTick(() => panelRef.value?.focus());
    }
    else {
        document.body.style.overflow = '';
    }
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
/** @type {__VLS_StyleScopedClasses['confirm-dialog__btn--ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['confirm-dialog__btn--primary']} */ ;
/** @type {__VLS_StyleScopedClasses['confirm-dialog__btn']} */ ;
/** @type {__VLS_StyleScopedClasses['confirm-dialog__btn']} */ ;
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
if (__VLS_ctx.open) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onKeydown: (__VLS_ctx.close) },
        ...{ class: "confirm-dialog" },
        role: "presentation",
    });
    /** @type {__VLS_StyleScopedClasses['confirm-dialog']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.close) },
        type: "button",
        ...{ class: "confirm-dialog__backdrop" },
        'aria-label': (__VLS_ctx.cancelLabel),
    });
    /** @type {__VLS_StyleScopedClasses['confirm-dialog__backdrop']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ref: "panelRef",
        ...{ class: "confirm-dialog__panel" },
        role: "dialog",
        'aria-modal': "true",
        'aria-labelledby': (__VLS_ctx.titleId),
        'aria-describedby': (__VLS_ctx.descId),
        tabindex: "-1",
    });
    /** @type {__VLS_StyleScopedClasses['confirm-dialog__panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        id: (__VLS_ctx.titleId),
        ...{ class: "confirm-dialog__title" },
    });
    /** @type {__VLS_StyleScopedClasses['confirm-dialog__title']} */ ;
    (__VLS_ctx.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        id: (__VLS_ctx.descId),
        ...{ class: "confirm-dialog__message" },
    });
    /** @type {__VLS_StyleScopedClasses['confirm-dialog__message']} */ ;
    (__VLS_ctx.message);
    if (__VLS_ctx.$slots.extra) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "confirm-dialog__extra" },
        });
        /** @type {__VLS_StyleScopedClasses['confirm-dialog__extra']} */ ;
        var __VLS_6 = {};
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "confirm-dialog__actions" },
    });
    /** @type {__VLS_StyleScopedClasses['confirm-dialog__actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.close) },
        type: "button",
        ...{ class: "confirm-dialog__btn confirm-dialog__btn--ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['confirm-dialog__btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['confirm-dialog__btn--ghost']} */ ;
    (__VLS_ctx.cancelLabel);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.onConfirm) },
        type: "button",
        ...{ class: "confirm-dialog__btn confirm-dialog__btn--primary" },
        disabled: (__VLS_ctx.confirmDisabled),
    });
    /** @type {__VLS_StyleScopedClasses['confirm-dialog__btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['confirm-dialog__btn--primary']} */ ;
    (__VLS_ctx.confirmLabel);
}
// @ts-ignore
[open, close, close, close, cancelLabel, cancelLabel, titleId, titleId, descId, descId, title, message, $slots, onConfirm, confirmDisabled, confirmLabel,];
var __VLS_3;
// @ts-ignore
var __VLS_7 = __VLS_6;
// @ts-ignore
[];
const __VLS_base = (await import('vue')).defineComponent({
    emits: {},
    props: {
        open: { type: Boolean, default: false },
        title: { type: String, default: '' },
        message: { type: String, default: '' },
        confirmLabel: { type: String, default: '' },
        cancelLabel: { type: String, default: '' },
        confirmDisabled: { type: Boolean, default: false },
    },
});
const __VLS_export = {};
export default {};
