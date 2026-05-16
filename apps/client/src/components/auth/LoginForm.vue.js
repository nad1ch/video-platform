/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';
import AppButton from '@/components/ui/AppButton.vue';
import { useAuth } from '@/composables/useAuth';
import { safeOAuthRedirectPath } from '@/utils/safeOAuthRedirectPath';
import { replaceAuthQuery } from '@/utils/authRouteQuery';
const props = defineProps();
const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const { loginOrRegisterWithEmail, refresh } = useAuth();
const email = ref('');
const password = ref('');
const showPassword = ref(false);
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
        const r = await loginOrRegisterWithEmail(email.value, password.value);
        if (r.ok) {
            await refresh({ force: true });
            const target = safeOAuthRedirectPath(props.redirectPath);
            await router.replace(target);
            return;
        }
        if (r.error === 'wrong_password') {
            feedback.value = 'err_pw';
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
function goForgot() {
    router.replace({ path: '/auth', query: replaceAuthQuery(route, 'forgot') });
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
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "auth-page-field-group" },
});
/** @type {__VLS_StyleScopedClasses['auth-page-field-group']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "auth-page-label" },
});
/** @type {__VLS_StyleScopedClasses['auth-page-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "auth-page-label-text" },
    for: "auth-login-password",
});
/** @type {__VLS_StyleScopedClasses['auth-page-label-text']} */ ;
(__VLS_ctx.t('app.authPasswordLabel'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "auth-page-password-control" },
});
/** @type {__VLS_StyleScopedClasses['auth-page-password-control']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    id: "auth-login-password",
    ...{ class: "auth-page-input auth-page-input--with-action" },
    type: (__VLS_ctx.showPassword ? 'text' : 'password'),
    name: "password",
    minlength: "6",
    autocomplete: "current-password",
    placeholder: (__VLS_ctx.t('app.authPasswordPlaceholder')),
    disabled: (__VLS_ctx.submitting),
});
(__VLS_ctx.password);
/** @type {__VLS_StyleScopedClasses['auth-page-input']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page-input--with-action']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showPassword = !__VLS_ctx.showPassword;
            // @ts-ignore
            [onSubmit, t, t, t, t, submitting, submitting, email, showPassword, showPassword, showPassword, password,];
        } },
    type: "button",
    ...{ class: "auth-page-password-toggle" },
    'aria-label': (__VLS_ctx.showPassword ? __VLS_ctx.t('app.authPasswordHide') : __VLS_ctx.t('app.authPasswordShow')),
    title: (__VLS_ctx.showPassword ? __VLS_ctx.t('app.authPasswordHide') : __VLS_ctx.t('app.authPasswordShow')),
    'aria-pressed': (__VLS_ctx.showPassword),
    disabled: (__VLS_ctx.submitting),
});
/** @type {__VLS_StyleScopedClasses['auth-page-password-toggle']} */ ;
if (__VLS_ctx.showPassword) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        ...{ class: "auth-page-password-toggle__icon" },
        xmlns: "http://www.w3.org/2000/svg",
        fill: "none",
        viewBox: "0 0 24 24",
        'stroke-width': "1.7",
        stroke: "currentColor",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['auth-page-password-toggle__icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M3 3l18 18",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M10.58 10.58a2 2 0 0 0 2.83 2.83",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M9.88 4.24A9.83 9.83 0 0 1 12 4c5 0 8.5 4.5 9.5 8a11.86 11.86 0 0 1-2.2 3.7",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M6.6 6.6A11.86 11.86 0 0 0 2.5 12c1 3.5 4.5 8 9.5 8a9.83 9.83 0 0 0 4.3-.99",
    });
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        ...{ class: "auth-page-password-toggle__icon" },
        xmlns: "http://www.w3.org/2000/svg",
        fill: "none",
        viewBox: "0 0 24 24",
        'stroke-width': "1.7",
        stroke: "currentColor",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['auth-page-password-toggle__icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M2.5 12c1-3.5 4.5-8 9.5-8s8.5 4.5 9.5 8c-1 3.5-4.5 8-9.5 8s-8.5-4.5-9.5-8Z",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "12",
        cy: "12",
        r: "2.5",
    });
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "auth-page-forgot-row" },
});
/** @type {__VLS_StyleScopedClasses['auth-page-forgot-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.goForgot) },
    type: "button",
    ...{ class: "auth-page-link" },
});
/** @type {__VLS_StyleScopedClasses['auth-page-link']} */ ;
(__VLS_ctx.t('app.authForgotPasswordLink'));
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
(__VLS_ctx.submitting ? '…' : __VLS_ctx.t('app.authLoginSubmit'));
// @ts-ignore
[t, t, t, t, t, t, submitting, submitting, submitting, showPassword, showPassword, showPassword, showPassword, goForgot,];
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
else if (__VLS_ctx.feedback === 'err_pw') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "auth-page-feedback auth-page-feedback--err" },
        role: "alert",
    });
    /** @type {__VLS_StyleScopedClasses['auth-page-feedback']} */ ;
    /** @type {__VLS_StyleScopedClasses['auth-page-feedback--err']} */ ;
    (__VLS_ctx.t('app.authEmailWrongPassword'));
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
