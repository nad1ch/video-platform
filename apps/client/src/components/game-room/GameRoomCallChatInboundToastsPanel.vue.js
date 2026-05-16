/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { useI18n } from 'vue-i18n';
const __VLS_props = defineProps();
const emit = defineEmits();
const { t } = useI18n();
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
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "call-page__chat-toasts" },
    role: "region",
    'aria-label': (__VLS_ctx.t('callPage.chatInboundToastAria')),
});
/** @type {__VLS_StyleScopedClasses['call-page__chat-toasts']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.TransitionGroup | typeof __VLS_components.TransitionGroup} */
TransitionGroup;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    name: "call-chat-toast",
    tag: "div",
    ...{ class: "call-page__chat-toasts-stack" },
    'aria-live': "polite",
}));
const __VLS_2 = __VLS_1({
    name: "call-chat-toast",
    tag: "div",
    ...{ class: "call-page__chat-toasts-stack" },
    'aria-live': "polite",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['call-page__chat-toasts-stack']} */ ;
const { default: __VLS_5 } = __VLS_3.slots;
for (const [row] of __VLS_vFor((__VLS_ctx.toasts))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (row.toastId),
        ...{ class: "call-page__chat-toast" },
        role: "article",
    });
    /** @type {__VLS_StyleScopedClasses['call-page__chat-toast']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.emit('open', row.toastId);
                // @ts-ignore
                [t, toasts, emit,];
            } },
        type: "button",
        ...{ class: "call-page__chat-toast-main" },
        'aria-label': (__VLS_ctx.t('callPage.chatInboundToastOpenChat')),
    });
    /** @type {__VLS_StyleScopedClasses['call-page__chat-toast-main']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "call-page__chat-toast-title" },
    });
    /** @type {__VLS_StyleScopedClasses['call-page__chat-toast-title']} */ ;
    (row.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "call-page__chat-toast-preview" },
    });
    /** @type {__VLS_StyleScopedClasses['call-page__chat-toast-preview']} */ ;
    (row.preview);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.emit('dismiss', row.toastId);
                // @ts-ignore
                [t, emit,];
            } },
        type: "button",
        ...{ class: "call-page__chat-toast-dismiss" },
        'aria-label': (__VLS_ctx.t('callPage.chatInboundToastDismiss')),
    });
    /** @type {__VLS_StyleScopedClasses['call-page__chat-toast-dismiss']} */ ;
    // @ts-ignore
    [t,];
}
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
