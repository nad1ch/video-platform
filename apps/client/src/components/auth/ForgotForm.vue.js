/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';
import AppButton from '@/components/ui/AppButton.vue';
import { useAuth } from '@/composables/useAuth';
import { replaceAuthQuery } from '@/utils/authRouteQuery';
const { t, locale } = useI18n();
const router = useRouter();
const route = useRoute();
const { sendPasswordReset } = useAuth();
const email = ref('');
const submitting = ref(false);
const feedback = ref(null);
async function onSubmit(e) {
    e.preventDefault();
    feedback.value = null;
    submitting.value = true;
    try {
        const result = await sendPasswordReset(email.value, locale.value);
        if (result.ok) {
            void router.replace({ path: '/auth', query: replaceAuthQuery(route, 'forgot-success') });
            return;
        }
        feedback.value = result.error;
    }
    finally {
        submitting.value = false;
    }
}
function backToLogin() {
    void router.replace({ path: '/auth', query: replaceAuthQuery(route, 'login') });
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
    ...{ onSubmit: (__VLS_ctx.onSubmit) },
    ...{ class: "auth-page-stack" },
});
/** @type {__VLS_StyleScopedClasses['auth-page-stack']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "auth-page-lead" },
});
/** @type {__VLS_StyleScopedClasses['auth-page-lead']} */ ;
(__VLS_ctx.t('app.authForgotLead'));
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "auth-page-label" },
});
/** @type {__VLS_StyleScopedClasses['auth-page-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "auth-page-label-text" },
});
/** @type {__VLS_StyleScopedClasses['auth-page-label-text']} */ ;
(__VLS_ctx.t('app.authEmailLabel'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "auth-page-input" },
    type: "email",
    name: "email",
    autocomplete: "email",
    placeholder: (__VLS_ctx.t('app.authEmailPlaceholder')),
    disabled: (__VLS_ctx.submitting),
    required: true,
});
(__VLS_ctx.email);
/** @type {__VLS_StyleScopedClasses['auth-page-input']} */ ;
const __VLS_0 = AppButton || AppButton;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    variant: "ghost",
    type: "submit",
    ...{ class: "auth-page-submit" },
    disabled: (__VLS_ctx.submitting),
}));
const __VLS_2 = __VLS_1({
    variant: "ghost",
    type: "submit",
    ...{ class: "auth-page-submit" },
    disabled: (__VLS_ctx.submitting),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['auth-page-submit']} */ ;
const { default: __VLS_5 } = __VLS_3.slots;
(__VLS_ctx.submitting ? '...' : __VLS_ctx.t('app.authForgotSubmit'));
// @ts-ignore
[onSubmit, t, t, t, t, submitting, submitting, submitting, email,];
var __VLS_3;
if (__VLS_ctx.feedback === 'validation') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "auth-page-feedback auth-page-feedback--err" },
        role: "alert",
    });
    /** @type {__VLS_StyleScopedClasses['auth-page-feedback']} */ ;
    /** @type {__VLS_StyleScopedClasses['auth-page-feedback--err']} */ ;
    (__VLS_ctx.t('app.authEmailErrorValidation'));
}
else if (__VLS_ctx.feedback === 'server') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "auth-page-feedback auth-page-feedback--err" },
        role: "alert",
    });
    /** @type {__VLS_StyleScopedClasses['auth-page-feedback']} */ ;
    /** @type {__VLS_StyleScopedClasses['auth-page-feedback--err']} */ ;
    (__VLS_ctx.t('app.authEmailServerError'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.backToLogin) },
    type: "button",
    ...{ class: "auth-page-link auth-page-link--block" },
});
/** @type {__VLS_StyleScopedClasses['auth-page-link']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page-link--block']} */ ;
(__VLS_ctx.t('app.authBackToSignIn'));
// @ts-ignore
[t, t, t, feedback, feedback, backToLogin,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
