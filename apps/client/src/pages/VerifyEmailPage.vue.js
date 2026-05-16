/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import AppButton from '@/components/ui/AppButton.vue';
import { useAuth } from '@/composables/useAuth';
const route = useRoute();
const auth = useAuth();
const { locale } = useI18n();
const sending = ref(false);
const sent = ref(false);
const error = ref('');
const email = computed(() => auth.user.value?.email ?? '');
const hasEmail = computed(() => email.value.length > 0);
const verificationFailed = computed(() => firstQueryValue(route.query.emailVerification) === 'failed');
const verificationSucceeded = computed(() => firstQueryValue(route.query.emailVerified) === '1');
function firstQueryValue(value) {
    if (Array.isArray(value)) {
        return typeof value[0] === 'string' ? value[0] : '';
    }
    return typeof value === 'string' ? value : '';
}
async function sendEmailVerification() {
    sending.value = true;
    sent.value = false;
    error.value = '';
    try {
        const result = await auth.sendEmailVerification(locale.value);
        if (result.ok) {
            sent.value = true;
            return;
        }
        error.value =
            result.error === 'email_unavailable' && !hasEmail.value
                ? 'This account does not have an email address to verify.'
                : 'Could not send verification email right now.';
    }
    finally {
        sending.value = false;
    }
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['verify-email-card']} */ ;
/** @type {__VLS_StyleScopedClasses['verify-email-card__button']} */ ;
/** @type {__VLS_StyleScopedClasses['verify-email-card__status']} */ ;
/** @type {__VLS_StyleScopedClasses['verify-email-card__status']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "verify-email-page" },
});
/** @type {__VLS_StyleScopedClasses['verify-email-page']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "verify-email-card" },
});
/** @type {__VLS_StyleScopedClasses['verify-email-card']} */ ;
if (__VLS_ctx.verificationSucceeded) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "verify-email-card__status verify-email-card__status--success" },
    });
    /** @type {__VLS_StyleScopedClasses['verify-email-card__status']} */ ;
    /** @type {__VLS_StyleScopedClasses['verify-email-card__status--success']} */ ;
}
else if (__VLS_ctx.verificationFailed) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "verify-email-card__status verify-email-card__status--error" },
    });
    /** @type {__VLS_StyleScopedClasses['verify-email-card__status']} */ ;
    /** @type {__VLS_StyleScopedClasses['verify-email-card__status--error']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({});
if (__VLS_ctx.hasEmail) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "verify-email-card__lead" },
    });
    /** @type {__VLS_StyleScopedClasses['verify-email-card__lead']} */ ;
    (__VLS_ctx.email);
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "verify-email-card__lead" },
    });
    /** @type {__VLS_StyleScopedClasses['verify-email-card__lead']} */ ;
}
if (__VLS_ctx.hasEmail) {
    const __VLS_0 = AppButton || AppButton;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ 'onClick': {} },
        ...{ class: "verify-email-card__button" },
        variant: "primary",
        type: "button",
        disabled: (__VLS_ctx.sending),
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onClick': {} },
        ...{ class: "verify-email-card__button" },
        variant: "primary",
        type: "button",
        disabled: (__VLS_ctx.sending),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = ({ click: {} },
        { onClick: (__VLS_ctx.sendEmailVerification) });
    /** @type {__VLS_StyleScopedClasses['verify-email-card__button']} */ ;
    const { default: __VLS_7 } = __VLS_3.slots;
    (__VLS_ctx.sending ? 'Sending...' : 'Send verification email');
    // @ts-ignore
    [verificationSucceeded, verificationFailed, hasEmail, hasEmail, email, sending, sending, sendEmailVerification,];
    var __VLS_3;
    var __VLS_4;
}
if (__VLS_ctx.sent) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "verify-email-card__status verify-email-card__status--success" },
        role: "status",
    });
    /** @type {__VLS_StyleScopedClasses['verify-email-card__status']} */ ;
    /** @type {__VLS_StyleScopedClasses['verify-email-card__status--success']} */ ;
}
if (__VLS_ctx.error) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "verify-email-card__status verify-email-card__status--error" },
        role: "alert",
    });
    /** @type {__VLS_StyleScopedClasses['verify-email-card__status']} */ ;
    /** @type {__VLS_StyleScopedClasses['verify-email-card__status--error']} */ ;
    (__VLS_ctx.error);
}
// @ts-ignore
[sent, error, error,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
