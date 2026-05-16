/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue';
import AppContainer from '@/components/ui/AppContainer.vue';
// Payment modal is hidden behind the "Buy Pro" CTA; lazy so the
// `/app/billing` first paint does not pay for the modal chunk.
const JarPaymentModal = defineAsyncComponent(() => import('@/components/billing/JarPaymentModal.vue'));
import { useProSubscription } from '@/composables/useProSubscription';
import { useJarBillingFlow } from '@/composables/useJarBillingFlow';
import { refreshBillingConfig, useBillingConfig } from '@/composables/useBillingConfig';
import { updateBillingEmail } from '@/services/billingApi';
import { subscriptionState } from '@/composables/useProSubscription';
import '@/styles/coinhub-design-system.css';
const { subscription, isProActive, expiresAt, refreshSubscription, billingEmail: subscriptionBillingEmail, } = useProSubscription();
const flow = useJarBillingFlow();
const billingConfig = useBillingConfig();
const modalOpen = ref(false);
const billingEmailDraft = ref('');
const billingEmailSaving = ref(false);
const billingEmailError = ref(null);
watch(subscriptionBillingEmail, (next, prev) => {
    if (next !== prev && billingEmailDraft.value.length === 0) {
        billingEmailDraft.value = next ?? '';
    }
}, { immediate: true });
const isBillingEmailDirty = computed(() => {
    const draft = billingEmailDraft.value.trim().toLowerCase();
    const current = (subscriptionBillingEmail.value ?? '').toLowerCase();
    return draft !== current;
});
async function onSaveBillingEmail() {
    if (billingEmailSaving.value)
        return;
    if (!isBillingEmailDirty.value)
        return;
    billingEmailSaving.value = true;
    billingEmailError.value = null;
    try {
        const r = await updateBillingEmail(billingEmailDraft.value.trim());
        if (!r.ok) {
            billingEmailError.value =
                r.code === 'INVALID_EMAIL'
                    ? 'Невірний формат пошти.'
                    : `Не вдалося зберегти: ${r.message}`;
            return;
        }
        subscriptionState.value = r.data;
    }
    finally {
        billingEmailSaving.value = false;
    }
}
const FEATURES = [
    'безлімітні кімнати відеодзвінків',
    'доступ до OBS оверлеїв',
    'доступ до всіх ігор',
    'розширений набір ігрових інструментів стрімера',
    'пріоритетна підтримка',
];
const OLD_PRICE_LABEL = '599';
const subscriptionExpiresAtFormatted = computed(() => formatDate(expiresAt.value));
const requestExpiresAtFormatted = computed(() => formatDateTime(flow.request.value?.expiresAt ?? null));
function formatDate(iso) {
    if (!iso)
        return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return null;
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' });
}
function formatDateTime(iso) {
    if (!iso)
        return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return null;
    return d.toLocaleString(undefined, {
        day: '2-digit',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
    });
}
const priceAmount = computed(() => billingConfig.config.value?.amountUah ?? null);
const priceDurationLabel = computed(() => {
    const days = billingConfig.config.value?.durationDays;
    if (!days)
        return null;
    if (days === 30)
        return 'місяць';
    return `${days} днів`;
});
const isPricingReady = computed(() => billingConfig.isReady.value);
const isPricingUnavailable = computed(() => !billingConfig.loading.value && !billingConfig.isReady.value);
const isJarConfigured = computed(() => billingConfig.jarConfigured.value);
const isCtaDisabled = computed(() => modalOpen.value || flow.isBusy.value || !isPricingReady.value || !isJarConfigured.value);
async function openCheckout() {
    if (isCtaDisabled.value)
        return;
    if (modalOpen.value)
        return;
    modalOpen.value = true;
    await flow.startCheckout();
}
async function onMarkPaid() {
    await flow.markPaid();
}
async function onRetryCreate() {
    flow.reset();
    await flow.startCheckout();
}
function onClose() {
    modalOpen.value = false;
    flow.stopPolling();
    if (flow.isTerminal.value) {
        flow.reset();
    }
}
function onGoPro() {
    modalOpen.value = false;
    flow.reset();
    void refreshSubscription();
}
onMounted(() => {
    // Subscription state is kept fresh by the global `BillingToastSurface`
    // notifier (immediate tick on auth, then every 20s + on visibility).
    // No need to fire a duplicate `subscription/me` from this page on mount.
    void refreshBillingConfig();
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['billing-page__status-crown']} */ ;
/** @type {__VLS_StyleScopedClasses['billing-email-card__input']} */ ;
/** @type {__VLS_StyleScopedClasses['billing-email-card__input']} */ ;
/** @type {__VLS_StyleScopedClasses['billing-email-card__input']} */ ;
/** @type {__VLS_StyleScopedClasses['pro-card--clickable']} */ ;
/** @type {__VLS_StyleScopedClasses['pro-card--clickable']} */ ;
/** @type {__VLS_StyleScopedClasses['pro-card']} */ ;
/** @type {__VLS_StyleScopedClasses['pro-card']} */ ;
/** @type {__VLS_StyleScopedClasses['pro-card--clickable']} */ ;
/** @type {__VLS_StyleScopedClasses['pro-card--clickable']} */ ;
/** @type {__VLS_StyleScopedClasses['pro-card__title-crown']} */ ;
/** @type {__VLS_StyleScopedClasses['pro-card__feat-crown']} */ ;
/** @type {__VLS_StyleScopedClasses['pro-card__title']} */ ;
/** @type {__VLS_StyleScopedClasses['pro-card__title-crown']} */ ;
/** @type {__VLS_StyleScopedClasses['pro-card__inner']} */ ;
/** @type {__VLS_StyleScopedClasses['billing-email-card']} */ ;
const __VLS_0 = AppContainer || AppContainer;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "billing-page" },
});
/** @type {__VLS_StyleScopedClasses['billing-page']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "billing-page__subtitle" },
});
/** @type {__VLS_StyleScopedClasses['billing-page__subtitle']} */ ;
if (__VLS_ctx.isProActive) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "billing-page__status billing-page__status--active" },
        role: "status",
    });
    /** @type {__VLS_StyleScopedClasses['billing-page__status']} */ ;
    /** @type {__VLS_StyleScopedClasses['billing-page__status--active']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "billing-page__status-crown" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['billing-page__status-crown']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        viewBox: "0 0 24 18",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M2 4.5L6 9l6-7 6 7 4-4.5L20 16H4L2 4.5z",
        stroke: "currentColor",
        'stroke-width': "1.6",
        'stroke-linejoin': "round",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.subscriptionExpiresAtFormatted ? ` · до ${__VLS_ctx.subscriptionExpiresAtFormatted}` : '');
}
else if (__VLS_ctx.subscription && __VLS_ctx.subscription.status === 'expired') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "billing-page__status billing-page__status--lapsed" },
        role: "status",
    });
    /** @type {__VLS_StyleScopedClasses['billing-page__status']} */ ;
    /** @type {__VLS_StyleScopedClasses['billing-page__status--lapsed']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.subscriptionExpiresAtFormatted ? ` · ${__VLS_ctx.subscriptionExpiresAtFormatted}` : '');
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "billing-email-card" },
    'aria-labelledby': "billing-email-title",
});
/** @type {__VLS_StyleScopedClasses['billing-email-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    id: "billing-email-title",
    ...{ class: "billing-email-card__title" },
});
/** @type {__VLS_StyleScopedClasses['billing-email-card__title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
    ...{ onSubmit: (__VLS_ctx.onSaveBillingEmail) },
    ...{ class: "billing-email-card__form" },
});
/** @type {__VLS_StyleScopedClasses['billing-email-card__form']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onBlur: (__VLS_ctx.onSaveBillingEmail) },
    type: "email",
    inputmode: "email",
    autocomplete: "email",
    spellcheck: "false",
    ...{ class: "billing-email-card__input" },
    placeholder: "example@gmail.com...",
    disabled: (__VLS_ctx.billingEmailSaving),
    'aria-label': "Email для сповіщення",
    maxlength: "254",
});
(__VLS_ctx.billingEmailDraft);
/** @type {__VLS_StyleScopedClasses['billing-email-card__input']} */ ;
if (__VLS_ctx.billingEmailError) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "billing-email-card__msg" },
    });
    /** @type {__VLS_StyleScopedClasses['billing-email-card__msg']} */ ;
    (__VLS_ctx.billingEmailError);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ onClick: (__VLS_ctx.openCheckout) },
    ...{ onKeydown: (__VLS_ctx.openCheckout) },
    ...{ onKeydown: (__VLS_ctx.openCheckout) },
    ...{ class: "pro-card" },
    ...{ class: ({ 'pro-card--clickable': !__VLS_ctx.isCtaDisabled }) },
    role: "button",
    tabindex: "0",
    'aria-disabled': (__VLS_ctx.isCtaDisabled || undefined),
});
/** @type {__VLS_StyleScopedClasses['pro-card']} */ ;
/** @type {__VLS_StyleScopedClasses['pro-card--clickable']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pro-card__inner" },
});
/** @type {__VLS_StyleScopedClasses['pro-card__inner']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "pro-card__title" },
});
/** @type {__VLS_StyleScopedClasses['pro-card__title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "pro-card__title-text" },
});
/** @type {__VLS_StyleScopedClasses['pro-card__title-text']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "pro-card__title-crown" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['pro-card__title-crown']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    viewBox: "0 0 64 48",
    xmlns: "http://www.w3.org/2000/svg",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.defs, __VLS_intrinsics.defs)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.linearGradient, __VLS_intrinsics.linearGradient)({
    id: "proCrownGrad",
    x1: "0",
    y1: "0",
    x2: "1",
    y2: "1",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.stop)({
    offset: "0%",
    'stop-color': "#fff7ed",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.stop)({
    offset: "40%",
    'stop-color': "#fde68a",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.stop)({
    offset: "100%",
    'stop-color': "#f59e0b",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M4 12 L16 26 L32 4 L48 26 L60 12 L54 44 L10 44 Z",
    fill: "url(#proCrownGrad)",
    stroke: "#f59e0b",
    'stroke-width': "2",
    'stroke-linejoin': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "32",
    cy: "22",
    r: "2.6",
    fill: "#7c2d12",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "14",
    cy: "30",
    r: "2",
    fill: "#7c2d12",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "50",
    cy: "30",
    r: "2",
    fill: "#7c2d12",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pro-card__price" },
});
/** @type {__VLS_StyleScopedClasses['pro-card__price']} */ ;
if (__VLS_ctx.priceAmount) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "pro-card__price-old" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['pro-card__price-old']} */ ;
    (__VLS_ctx.OLD_PRICE_LABEL);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "pro-card__price-row" },
});
/** @type {__VLS_StyleScopedClasses['pro-card__price-row']} */ ;
if (__VLS_ctx.priceAmount) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "pro-card__price-currency" },
    });
    /** @type {__VLS_StyleScopedClasses['pro-card__price-currency']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "pro-card__price-amount" },
    });
    /** @type {__VLS_StyleScopedClasses['pro-card__price-amount']} */ ;
    (__VLS_ctx.priceAmount);
    if (__VLS_ctx.priceDurationLabel) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pro-card__price-duration" },
        });
        /** @type {__VLS_StyleScopedClasses['pro-card__price-duration']} */ ;
        (__VLS_ctx.priceDurationLabel);
    }
}
else if (__VLS_ctx.isPricingUnavailable) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "pro-card__price-unavailable" },
    });
    /** @type {__VLS_StyleScopedClasses['pro-card__price-unavailable']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "pro-card__price-loading" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['pro-card__price-loading']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
    ...{ class: "pro-card__feats" },
    role: "list",
});
/** @type {__VLS_StyleScopedClasses['pro-card__feats']} */ ;
for (const [f] of __VLS_vFor((__VLS_ctx.FEATURES))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
        key: (f),
        ...{ class: "pro-card__feat" },
    });
    /** @type {__VLS_StyleScopedClasses['pro-card__feat']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "pro-card__feat-crown" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['pro-card__feat-crown']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        viewBox: "0 0 24 18",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M2 4.5L6 9l6-7 6 7 4-4.5L20 16H4L2 4.5z",
        stroke: "currentColor",
        'stroke-width': "1.6",
        'stroke-linejoin': "round",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "pro-card__feat-text" },
    });
    /** @type {__VLS_StyleScopedClasses['pro-card__feat-text']} */ ;
    (f);
    // @ts-ignore
    [isProActive, subscriptionExpiresAtFormatted, subscriptionExpiresAtFormatted, subscriptionExpiresAtFormatted, subscriptionExpiresAtFormatted, subscription, subscription, onSaveBillingEmail, onSaveBillingEmail, billingEmailSaving, billingEmailDraft, billingEmailError, billingEmailError, openCheckout, openCheckout, openCheckout, isCtaDisabled, isCtaDisabled, priceAmount, priceAmount, priceAmount, OLD_PRICE_LABEL, priceDurationLabel, priceDurationLabel, isPricingUnavailable, FEATURES,];
}
if (!__VLS_ctx.isJarConfigured && __VLS_ctx.isPricingReady) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "pro-card__hint pro-card__hint--warn" },
    });
    /** @type {__VLS_StyleScopedClasses['pro-card__hint']} */ ;
    /** @type {__VLS_StyleScopedClasses['pro-card__hint--warn']} */ ;
}
if (__VLS_ctx.modalOpen) {
    let __VLS_7;
    /** @ts-ignore @type { | typeof __VLS_components.JarPaymentModal} */
    JarPaymentModal;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
        ...{ 'onClose': {} },
        ...{ 'onMarkPaid': {} },
        ...{ 'onRetryCreate': {} },
        ...{ 'onGoPro': {} },
        open: (__VLS_ctx.modalOpen),
        kind: (__VLS_ctx.flow.kind.value),
        request: (__VLS_ctx.flow.request.value),
        error: (__VLS_ctx.flow.error.value),
        isBusy: (__VLS_ctx.flow.isBusy.value),
        isPolling: (__VLS_ctx.flow.isPolling.value),
        durationLabel: (__VLS_ctx.billingConfig.durationLabel.value),
        expiresAtFormatted: (__VLS_ctx.requestExpiresAtFormatted),
        activeUntilFormatted: (__VLS_ctx.subscriptionExpiresAtFormatted),
    }));
    const __VLS_9 = __VLS_8({
        ...{ 'onClose': {} },
        ...{ 'onMarkPaid': {} },
        ...{ 'onRetryCreate': {} },
        ...{ 'onGoPro': {} },
        open: (__VLS_ctx.modalOpen),
        kind: (__VLS_ctx.flow.kind.value),
        request: (__VLS_ctx.flow.request.value),
        error: (__VLS_ctx.flow.error.value),
        isBusy: (__VLS_ctx.flow.isBusy.value),
        isPolling: (__VLS_ctx.flow.isPolling.value),
        durationLabel: (__VLS_ctx.billingConfig.durationLabel.value),
        expiresAtFormatted: (__VLS_ctx.requestExpiresAtFormatted),
        activeUntilFormatted: (__VLS_ctx.subscriptionExpiresAtFormatted),
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    let __VLS_12;
    const __VLS_13 = ({ close: {} },
        { onClose: (__VLS_ctx.onClose) });
    const __VLS_14 = ({ markPaid: {} },
        { onMarkPaid: (__VLS_ctx.onMarkPaid) });
    const __VLS_15 = ({ retryCreate: {} },
        { onRetryCreate: (__VLS_ctx.onRetryCreate) });
    const __VLS_16 = ({ goPro: {} },
        { onGoPro: (__VLS_ctx.onGoPro) });
    var __VLS_10;
    var __VLS_11;
}
// @ts-ignore
[subscriptionExpiresAtFormatted, isJarConfigured, isPricingReady, modalOpen, modalOpen, flow, flow, flow, flow, flow, billingConfig, requestExpiresAtFormatted, onClose, onMarkPaid, onRetryCreate, onGoPro,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
