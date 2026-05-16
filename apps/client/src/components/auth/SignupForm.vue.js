/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import AppButton from '@/components/ui/AppButton.vue';
import { useAuth } from '@/composables/useAuth';
import { safeOAuthRedirectPath } from '@/utils/safeOAuthRedirectPath';
const props = defineProps();
const { t } = useI18n();
const router = useRouter();
const { registerWithEmail, refresh } = useAuth();
const email = ref('');
const password = ref('');
const submitting = ref(false);
const feedback = ref(null);
async function onSubmit(e) {
    e.preventDefault();
    feedback.value = null;
    if (password.value.length < 6) {
        feedback.value = 'err_val';
        return;
    }
    submitting.value = true;
    try {
        const r = await registerWithEmail(email.value, password.value);
        if (r.ok) {
            await refresh({ force: true });
            const target = safeOAuthRedirectPath(props.redirectPath);
            await router.replace(target);
            return;
        }
        if (r.error === 'email_taken') {
            feedback.value = 'email_taken';
            return;
        }
        if (r.error === 'validation') {
            feedback.value = 'err_val';
            return;
        }
        if (r.error === 'account_link_required') {
            feedback.value = 'account_link_required';
            return;
        }
        feedback.value = 'err_srv';
    }
    finally {
        submitting.value = false;
    }
}
const __VLS_ctx = {
    ...{},
    ...{},
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
});
(__VLS_ctx.email);
/** @type {__VLS_StyleScopedClasses['auth-page-input']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "auth-page-label" },
});
/** @type {__VLS_StyleScopedClasses['auth-page-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "auth-page-label-text" },
});
/** @type {__VLS_StyleScopedClasses['auth-page-label-text']} */ ;
(__VLS_ctx.t('app.authPasswordLabel'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "auth-page-input" },
    type: "password",
    name: "password",
    minlength: "6",
    autocomplete: "new-password",
    placeholder: (__VLS_ctx.t('app.authPasswordPlaceholder')),
    disabled: (__VLS_ctx.submitting),
});
(__VLS_ctx.password);
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
(__VLS_ctx.submitting ? '…' : __VLS_ctx.t('app.authSignupSubmit'));
// @ts-ignore
[onSubmit, t, t, t, t, t, submitting, submitting, submitting, submitting, email, password,];
var __VLS_3;
if (__VLS_ctx.feedback === 'err_val') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "auth-page-feedback auth-page-feedback--err" },
        role: "alert",
    });
    /** @type {__VLS_StyleScopedClasses['auth-page-feedback']} */ ;
    /** @type {__VLS_StyleScopedClasses['auth-page-feedback--err']} */ ;
    (__VLS_ctx.t('app.authEmailErrorValidation'));
}
else if (__VLS_ctx.feedback === 'email_taken') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "auth-page-feedback auth-page-feedback--err" },
        role: "alert",
    });
    /** @type {__VLS_StyleScopedClasses['auth-page-feedback']} */ ;
    /** @type {__VLS_StyleScopedClasses['auth-page-feedback--err']} */ ;
    (__VLS_ctx.t('app.authSignupEmailTaken'));
}
else if (__VLS_ctx.feedback === 'account_link_required') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "auth-page-feedback auth-page-feedback--err" },
        role: "alert",
    });
    /** @type {__VLS_StyleScopedClasses['auth-page-feedback']} */ ;
    /** @type {__VLS_StyleScopedClasses['auth-page-feedback--err']} */ ;
    (__VLS_ctx.t('app.authEmailAccountLinkRequired'));
}
else if (__VLS_ctx.feedback === 'err_srv') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "auth-page-feedback auth-page-feedback--err" },
        role: "alert",
    });
    /** @type {__VLS_StyleScopedClasses['auth-page-feedback']} */ ;
    /** @type {__VLS_StyleScopedClasses['auth-page-feedback--err']} */ ;
    (__VLS_ctx.t('app.authEmailServerError'));
}
// @ts-ignore
[t, t, t, t, feedback, feedback, feedback, feedback,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
