/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { onUnmounted, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { dismissToast, resetBillingNotifierState, startBillingNotifier, stopBillingNotifier, useBillingNotifications, } from '@/composables/useBillingNotifications';
/**
 * Singleton toast surface for billing events. Mounted once at the App
 * root, so toasts appear on whichever page the user is currently on
 * (after admin approve/reject/cancel, after auto-match, after expiry).
 *
 * Polling is auth-gated: it starts only after the user is signed in and
 * stops on logout (so we never hammer `subscription/me` from landing or
 * auth pages, and so a logged-out tab cannot accidentally surface another
 * user's toasts on a shared device).
 */
const { isAuthenticated } = useAuth();
const { toasts } = useBillingNotifications();
watch(isAuthenticated, (authed, wasAuthed) => {
    if (authed) {
        startBillingNotifier();
    }
    else {
        stopBillingNotifier();
        if (wasAuthed) {
            resetBillingNotifierState();
        }
    }
}, { immediate: true });
onUnmounted(() => {
    stopBillingNotifier();
});
function trackBy(toast) {
    return toast.id;
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['billing-toast__dismiss']} */ ;
/** @type {__VLS_StyleScopedClasses['billing-toast-enter-active']} */ ;
/** @type {__VLS_StyleScopedClasses['billing-toast-leave-active']} */ ;
/** @type {__VLS_StyleScopedClasses['billing-toast-enter-from']} */ ;
/** @type {__VLS_StyleScopedClasses['billing-toast-leave-to']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "billing-toasts" },
    role: "region",
    'aria-live': "polite",
    'aria-label': "Billing notifications",
});
/** @type {__VLS_StyleScopedClasses['billing-toasts']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.transitionGroup | typeof __VLS_components.TransitionGroup | typeof __VLS_components['transition-group'] | typeof __VLS_components.transitionGroup | typeof __VLS_components.TransitionGroup | typeof __VLS_components['transition-group']} */
transitionGroup;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    name: "billing-toast",
    tag: "div",
    ...{ class: "billing-toasts__inner" },
}));
const __VLS_2 = __VLS_1({
    name: "billing-toast",
    tag: "div",
    ...{ class: "billing-toasts__inner" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['billing-toasts__inner']} */ ;
const { default: __VLS_5 } = __VLS_3.slots;
for (const [toast] of __VLS_vFor((__VLS_ctx.toasts))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (__VLS_ctx.trackBy(toast)),
        ...{ class: "billing-toast" },
        ...{ class: (`billing-toast--${toast.kind}`) },
        role: "status",
    });
    /** @type {__VLS_StyleScopedClasses['billing-toast']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "billing-toast__body" },
    });
    /** @type {__VLS_StyleScopedClasses['billing-toast__body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "billing-toast__title" },
    });
    /** @type {__VLS_StyleScopedClasses['billing-toast__title']} */ ;
    (toast.title);
    if (toast.message) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "billing-toast__message" },
        });
        /** @type {__VLS_StyleScopedClasses['billing-toast__message']} */ ;
        (toast.message);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.dismissToast(toast.id);
                // @ts-ignore
                [toasts, trackBy, dismissToast,];
            } },
        type: "button",
        ...{ class: "billing-toast__dismiss" },
        'aria-label': "Закрити",
    });
    /** @type {__VLS_StyleScopedClasses['billing-toast__dismiss']} */ ;
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
