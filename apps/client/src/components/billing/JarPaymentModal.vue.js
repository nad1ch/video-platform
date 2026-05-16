/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
const props = withDefaults(defineProps(), {
    request: null,
    error: null,
    isPolling: false,
    durationLabel: null,
    expiresAtFormatted: null,
    activeUntilFormatted: null,
});
const emit = defineEmits();
const showCloseButton = computed(() => props.kind !== 'creating');
const isSuccess = computed(() => props.kind === 'auto_matched' || props.kind === 'approved');
const isReview = computed(() => props.kind === 'needs_review');
const isRejected = computed(() => props.kind === 'rejected');
const isExpired = computed(() => props.kind === 'expired');
const isErrorState = computed(() => props.kind === 'error');
const isPayable = computed(() => props.kind === 'awaiting_payment' || props.kind === 'submitting_check' || props.kind === 'checking');
function onBackdropClick() {
    if (props.isBusy)
        return;
    emit('close');
}
function onKey(e) {
    if (!props.open)
        return;
    if (e.key === 'Escape' && showCloseButton.value && !props.isBusy) {
        emit('close');
    }
}
watch(() => props.open, (open) => {
    if (typeof document === 'undefined')
        return;
    document.body.style.overflow = open ? 'hidden' : '';
}, { immediate: true });
onMounted(() => {
    document.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKey);
    if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
    }
});
const __VLS_defaults = {
    request: null,
    error: null,
    isPolling: false,
    durationLabel: null,
    expiresAtFormatted: null,
    activeUntilFormatted: null,
};
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
/** @type {__VLS_StyleScopedClasses['jar-modal__close']} */ ;
/** @type {__VLS_StyleScopedClasses['jar-modal__steps']} */ ;
/** @type {__VLS_StyleScopedClasses['jar-modal__btn']} */ ;
/** @type {__VLS_StyleScopedClasses['jar-modal__btn']} */ ;
/** @type {__VLS_StyleScopedClasses['jar-modal__btn--primary']} */ ;
/** @type {__VLS_StyleScopedClasses['jar-modal__state']} */ ;
/** @type {__VLS_StyleScopedClasses['jar-modal__state-title']} */ ;
/** @type {__VLS_StyleScopedClasses['jar-modal__state-title']} */ ;
/** @type {__VLS_StyleScopedClasses['jar-modal__state-title']} */ ;
/** @type {__VLS_StyleScopedClasses['jar-modal__state-title']} */ ;
/** @type {__VLS_StyleScopedClasses['jar-modal__state-title']} */ ;
/** @type {__VLS_StyleScopedClasses['jar-modal__spinner']} */ ;
if (__VLS_ctx.open) {
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (__VLS_ctx.onBackdropClick) },
        ...{ class: "jar-modal" },
        role: "dialog",
        'aria-modal': "true",
        'aria-labelledby': "jar-modal-title",
    });
    /** @type {__VLS_StyleScopedClasses['jar-modal']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jar-modal__shell" },
    });
    /** @type {__VLS_StyleScopedClasses['jar-modal__shell']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
        ...{ class: "jar-modal__header" },
    });
    /** @type {__VLS_StyleScopedClasses['jar-modal__header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        id: "jar-modal-title",
        ...{ class: "jar-modal__title" },
    });
    /** @type {__VLS_StyleScopedClasses['jar-modal__title']} */ ;
    if (__VLS_ctx.showCloseButton) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.open))
                        return;
                    if (!(__VLS_ctx.showCloseButton))
                        return;
                    __VLS_ctx.emit('close');
                    // @ts-ignore
                    [open, onBackdropClick, showCloseButton, emit,];
                } },
            type: "button",
            ...{ class: "jar-modal__close" },
            disabled: (__VLS_ctx.isBusy),
            'aria-label': "Закрити",
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__close']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jar-modal__body" },
    });
    /** @type {__VLS_StyleScopedClasses['jar-modal__body']} */ ;
    if (__VLS_ctx.kind === 'creating') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jar-modal__state" },
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__state']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
            ...{ class: "jar-modal__spinner" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__spinner']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    }
    else if (__VLS_ctx.isPayable) {
        if (__VLS_ctx.request) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "jar-modal__price" },
            });
            /** @type {__VLS_StyleScopedClasses['jar-modal__price']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
            (__VLS_ctx.request.amountUah);
            (__VLS_ctx.request.currency);
            if (__VLS_ctx.durationLabel) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                (__VLS_ctx.durationLabel);
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.ol, __VLS_intrinsics.ol)({
            ...{ class: "jar-modal__steps" },
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__steps']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "jar-modal__hint" },
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__hint']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jar-modal__actions" },
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__actions']} */ ;
        if (__VLS_ctx.request?.jarUrl) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
                ...{ class: "jar-modal__btn jar-modal__btn--primary" },
                href: (__VLS_ctx.request.jarUrl),
                target: "_blank",
                rel: "noopener noreferrer",
            });
            /** @type {__VLS_StyleScopedClasses['jar-modal__btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['jar-modal__btn--primary']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.open))
                        return;
                    if (!!(__VLS_ctx.kind === 'creating'))
                        return;
                    if (!(__VLS_ctx.isPayable))
                        return;
                    __VLS_ctx.emit('mark-paid');
                    // @ts-ignore
                    [emit, isBusy, kind, isPayable, request, request, request, request, request, durationLabel, durationLabel,];
                } },
            type: "button",
            ...{ class: "jar-modal__btn" },
            disabled: (__VLS_ctx.isBusy || (__VLS_ctx.kind === 'checking' && __VLS_ctx.isPolling)),
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__btn']} */ ;
        if (__VLS_ctx.kind === 'submitting_check' || (__VLS_ctx.kind === 'checking' && __VLS_ctx.isPolling)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                ...{ class: "jar-modal__spinner jar-modal__spinner--inline" },
                'aria-hidden': "true",
            });
            /** @type {__VLS_StyleScopedClasses['jar-modal__spinner']} */ ;
            /** @type {__VLS_StyleScopedClasses['jar-modal__spinner--inline']} */ ;
        }
        (__VLS_ctx.kind === 'submitting_check'
            ? 'Перевіряємо…'
            : __VLS_ctx.kind === 'checking' && __VLS_ctx.isPolling
                ? 'Перевіряємо платіж…'
                : __VLS_ctx.kind === 'checking'
                    ? 'Перевірити ще раз'
                    : 'Я оплатив, перевірити платіж');
        if (__VLS_ctx.expiresAtFormatted) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "jar-modal__expiry" },
            });
            /** @type {__VLS_StyleScopedClasses['jar-modal__expiry']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
            (__VLS_ctx.expiresAtFormatted);
        }
        if (__VLS_ctx.kind === 'checking' && __VLS_ctx.isPolling) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "jar-modal__notice" },
            });
            /** @type {__VLS_StyleScopedClasses['jar-modal__notice']} */ ;
        }
        else if (__VLS_ctx.kind === 'checking') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "jar-modal__notice" },
            });
            /** @type {__VLS_StyleScopedClasses['jar-modal__notice']} */ ;
        }
    }
    else if (__VLS_ctx.isReview) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jar-modal__state jar-modal__state--review" },
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__state']} */ ;
        /** @type {__VLS_StyleScopedClasses['jar-modal__state--review']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "jar-modal__state-title" },
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__state-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jar-modal__actions" },
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__actions']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.open))
                        return;
                    if (!!(__VLS_ctx.kind === 'creating'))
                        return;
                    if (!!(__VLS_ctx.isPayable))
                        return;
                    if (!(__VLS_ctx.isReview))
                        return;
                    __VLS_ctx.emit('close');
                    // @ts-ignore
                    [emit, isBusy, kind, kind, kind, kind, kind, kind, kind, kind, isPolling, isPolling, isPolling, isPolling, expiresAtFormatted, expiresAtFormatted, isReview,];
                } },
            type: "button",
            ...{ class: "jar-modal__btn" },
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__btn']} */ ;
    }
    else if (__VLS_ctx.isSuccess) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jar-modal__state jar-modal__state--success" },
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__state']} */ ;
        /** @type {__VLS_StyleScopedClasses['jar-modal__state--success']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "jar-modal__state-title" },
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__state-title']} */ ;
        if (__VLS_ctx.activeUntilFormatted) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
            (__VLS_ctx.activeUntilFormatted);
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jar-modal__actions" },
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__actions']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.open))
                        return;
                    if (!!(__VLS_ctx.kind === 'creating'))
                        return;
                    if (!!(__VLS_ctx.isPayable))
                        return;
                    if (!!(__VLS_ctx.isReview))
                        return;
                    if (!(__VLS_ctx.isSuccess))
                        return;
                    __VLS_ctx.emit('go-pro');
                    // @ts-ignore
                    [emit, isSuccess, activeUntilFormatted, activeUntilFormatted,];
                } },
            type: "button",
            ...{ class: "jar-modal__btn jar-modal__btn--primary" },
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['jar-modal__btn--primary']} */ ;
    }
    else if (__VLS_ctx.isRejected) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jar-modal__state jar-modal__state--rejected" },
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__state']} */ ;
        /** @type {__VLS_StyleScopedClasses['jar-modal__state--rejected']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "jar-modal__state-title" },
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__state-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jar-modal__actions" },
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__actions']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.open))
                        return;
                    if (!!(__VLS_ctx.kind === 'creating'))
                        return;
                    if (!!(__VLS_ctx.isPayable))
                        return;
                    if (!!(__VLS_ctx.isReview))
                        return;
                    if (!!(__VLS_ctx.isSuccess))
                        return;
                    if (!(__VLS_ctx.isRejected))
                        return;
                    __VLS_ctx.emit('close');
                    // @ts-ignore
                    [emit, isRejected,];
                } },
            type: "button",
            ...{ class: "jar-modal__btn" },
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__btn']} */ ;
    }
    else if (__VLS_ctx.isExpired) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jar-modal__state jar-modal__state--expired" },
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__state']} */ ;
        /** @type {__VLS_StyleScopedClasses['jar-modal__state--expired']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "jar-modal__state-title" },
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__state-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jar-modal__actions" },
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__actions']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.open))
                        return;
                    if (!!(__VLS_ctx.kind === 'creating'))
                        return;
                    if (!!(__VLS_ctx.isPayable))
                        return;
                    if (!!(__VLS_ctx.isReview))
                        return;
                    if (!!(__VLS_ctx.isSuccess))
                        return;
                    if (!!(__VLS_ctx.isRejected))
                        return;
                    if (!(__VLS_ctx.isExpired))
                        return;
                    __VLS_ctx.emit('retry-create');
                    // @ts-ignore
                    [emit, isExpired,];
                } },
            type: "button",
            ...{ class: "jar-modal__btn jar-modal__btn--primary" },
            disabled: (__VLS_ctx.isBusy),
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['jar-modal__btn--primary']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.open))
                        return;
                    if (!!(__VLS_ctx.kind === 'creating'))
                        return;
                    if (!!(__VLS_ctx.isPayable))
                        return;
                    if (!!(__VLS_ctx.isReview))
                        return;
                    if (!!(__VLS_ctx.isSuccess))
                        return;
                    if (!!(__VLS_ctx.isRejected))
                        return;
                    if (!(__VLS_ctx.isExpired))
                        return;
                    __VLS_ctx.emit('close');
                    // @ts-ignore
                    [emit, isBusy,];
                } },
            type: "button",
            ...{ class: "jar-modal__btn" },
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__btn']} */ ;
    }
    else if (__VLS_ctx.isErrorState) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jar-modal__state jar-modal__state--error" },
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__state']} */ ;
        /** @type {__VLS_StyleScopedClasses['jar-modal__state--error']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "jar-modal__state-title" },
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__state-title']} */ ;
        if (__VLS_ctx.error?.jarMisconfigured) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        }
        else if (__VLS_ctx.error?.code === 'UNAUTHORIZED') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
            (__VLS_ctx.error?.message || 'Невідома помилка. Спробуйте пізніше.');
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jar-modal__actions" },
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__actions']} */ ;
        if (!__VLS_ctx.error?.jarMisconfigured && __VLS_ctx.error?.code !== 'UNAUTHORIZED') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.open))
                            return;
                        if (!!(__VLS_ctx.kind === 'creating'))
                            return;
                        if (!!(__VLS_ctx.isPayable))
                            return;
                        if (!!(__VLS_ctx.isReview))
                            return;
                        if (!!(__VLS_ctx.isSuccess))
                            return;
                        if (!!(__VLS_ctx.isRejected))
                            return;
                        if (!!(__VLS_ctx.isExpired))
                            return;
                        if (!(__VLS_ctx.isErrorState))
                            return;
                        if (!(!__VLS_ctx.error?.jarMisconfigured && __VLS_ctx.error?.code !== 'UNAUTHORIZED'))
                            return;
                        __VLS_ctx.emit('retry-create');
                        // @ts-ignore
                        [emit, isErrorState, error, error, error, error, error,];
                    } },
                type: "button",
                ...{ class: "jar-modal__btn jar-modal__btn--primary" },
                disabled: (__VLS_ctx.isBusy),
            });
            /** @type {__VLS_StyleScopedClasses['jar-modal__btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['jar-modal__btn--primary']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.open))
                        return;
                    if (!!(__VLS_ctx.kind === 'creating'))
                        return;
                    if (!!(__VLS_ctx.isPayable))
                        return;
                    if (!!(__VLS_ctx.isReview))
                        return;
                    if (!!(__VLS_ctx.isSuccess))
                        return;
                    if (!!(__VLS_ctx.isRejected))
                        return;
                    if (!!(__VLS_ctx.isExpired))
                        return;
                    if (!(__VLS_ctx.isErrorState))
                        return;
                    __VLS_ctx.emit('close');
                    // @ts-ignore
                    [emit, isBusy,];
                } },
            type: "button",
            ...{ class: "jar-modal__btn" },
        });
        /** @type {__VLS_StyleScopedClasses['jar-modal__btn']} */ ;
    }
    // @ts-ignore
    [];
    var __VLS_3;
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
