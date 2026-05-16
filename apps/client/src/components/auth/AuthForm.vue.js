/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import AppButton from '@/components/ui/AppButton.vue';
import { useAuth } from '@/composables/useAuth';
import { safeOAuthRedirectPath } from '@/utils/safeOAuthRedirectPath';
import { parseAuthMode } from '@/utils/parseAuthMode';
import { replaceAuthQuery } from '@/utils/authRouteQuery';
import LoginForm from '@/components/auth/LoginForm.vue';
import ForgotForm from '@/components/auth/ForgotForm.vue';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm.vue';
const props = defineProps();
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { loginWithTwitch, loginWithGoogle } = useAuth();
const mode = computed(() => {
    const m = route.query.mode;
    const s = Array.isArray(m) ? m[0] : m;
    return parseAuthMode(s);
});
const redirectForOAuth = computed(() => safeOAuthRedirectPath(props.redirectPath));
watch(() => route.query.mode, () => {
    const raw = route.query.mode;
    const s = Array.isArray(raw) ? raw[0] : raw;
    if (s === 'signup') {
        void router.replace({ path: '/auth', query: replaceAuthQuery(route, 'login') });
    }
}, { immediate: true });
function onTwitch() {
    loginWithTwitch(redirectForOAuth.value);
}
function onGoogle() {
    loginWithGoogle(redirectForOAuth.value);
}
function goLoginFromSuccess() {
    void router.replace({ path: '/auth', query: replaceAuthQuery(route, 'login') });
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
/** @type {__VLS_StyleScopedClasses['auth-form-twitch-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-form-oauth-btn__leading']} */ ;
/** @type {__VLS_StyleScopedClasses['app-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-form-oauth-btn--twitch']} */ ;
/** @type {__VLS_StyleScopedClasses['app-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['app-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-form-oauth-btn--google']} */ ;
/** @type {__VLS_StyleScopedClasses['app-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['app-btn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "auth-form" },
});
/** @type {__VLS_StyleScopedClasses['auth-form']} */ ;
if (__VLS_ctx.mode === 'forgot-success') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "auth-form-panel" },
        role: "status",
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        ...{ class: "auth-form-title" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-title']} */ ;
    (__VLS_ctx.t('app.authForgotSuccessTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "auth-form-lead" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-lead']} */ ;
    (__VLS_ctx.t('app.authForgotSuccessBody'));
    const __VLS_0 = AppButton || AppButton;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ 'onClick': {} },
        variant: "primary",
        type: "button",
        ...{ class: "auth-form-back-btn" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onClick': {} },
        variant: "primary",
        type: "button",
        ...{ class: "auth-form-back-btn" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = ({ click: {} },
        { onClick: (__VLS_ctx.goLoginFromSuccess) });
    /** @type {__VLS_StyleScopedClasses['auth-form-back-btn']} */ ;
    const { default: __VLS_7 } = __VLS_3.slots;
    (__VLS_ctx.t('app.authBackToSignIn'));
    // @ts-ignore
    [mode, t, t, t, goLoginFromSuccess,];
    var __VLS_3;
    var __VLS_4;
}
else if (__VLS_ctx.mode === 'reset-success') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "auth-form-panel" },
        role: "status",
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        ...{ class: "auth-form-title" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "auth-form-lead" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-lead']} */ ;
    const __VLS_8 = AppButton || AppButton;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent1(__VLS_8, new __VLS_8({
        ...{ 'onClick': {} },
        variant: "primary",
        type: "button",
        ...{ class: "auth-form-back-btn" },
    }));
    const __VLS_10 = __VLS_9({
        ...{ 'onClick': {} },
        variant: "primary",
        type: "button",
        ...{ class: "auth-form-back-btn" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    let __VLS_13;
    const __VLS_14 = ({ click: {} },
        { onClick: (__VLS_ctx.goLoginFromSuccess) });
    /** @type {__VLS_StyleScopedClasses['auth-form-back-btn']} */ ;
    const { default: __VLS_15 } = __VLS_11.slots;
    (__VLS_ctx.t('app.authBackToSignIn'));
    // @ts-ignore
    [mode, t, goLoginFromSuccess,];
    var __VLS_11;
    var __VLS_12;
}
else if (__VLS_ctx.mode === 'reset') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "auth-form-panel" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        ...{ class: "auth-form-title" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-title']} */ ;
    const __VLS_16 = ResetPasswordForm;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent1(__VLS_16, new __VLS_16({}));
    const __VLS_18 = __VLS_17({}, ...__VLS_functionalComponentArgsRest(__VLS_17));
}
else if (__VLS_ctx.mode === 'forgot') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "auth-form-panel" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        ...{ class: "auth-form-title" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-title']} */ ;
    (__VLS_ctx.t('app.authForgotTitle'));
    const __VLS_21 = ForgotForm;
    // @ts-ignore
    const __VLS_22 = __VLS_asFunctionalComponent1(__VLS_21, new __VLS_21({}));
    const __VLS_23 = __VLS_22({}, ...__VLS_functionalComponentArgsRest(__VLS_22));
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "auth-form-stack" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-stack']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "auth-form-oauth" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-oauth']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "auth-form-twitch-block" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-twitch-block']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "auth-form-twitch-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-twitch-hint']} */ ;
    (__VLS_ctx.t('app.authTwitchHint'));
    const __VLS_26 = AppButton || AppButton;
    // @ts-ignore
    const __VLS_27 = __VLS_asFunctionalComponent1(__VLS_26, new __VLS_26({
        ...{ 'onClick': {} },
        variant: "primary",
        type: "button",
        ...{ class: "auth-form-oauth-btn auth-form-oauth-btn--twitch auth-form-oauth-btn--full" },
    }));
    const __VLS_28 = __VLS_27({
        ...{ 'onClick': {} },
        variant: "primary",
        type: "button",
        ...{ class: "auth-form-oauth-btn auth-form-oauth-btn--twitch auth-form-oauth-btn--full" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_27));
    let __VLS_31;
    const __VLS_32 = ({ click: {} },
        { onClick: (__VLS_ctx.onTwitch) });
    /** @type {__VLS_StyleScopedClasses['auth-form-oauth-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['auth-form-oauth-btn--twitch']} */ ;
    /** @type {__VLS_StyleScopedClasses['auth-form-oauth-btn--full']} */ ;
    const { default: __VLS_33 } = __VLS_29.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "auth-form-oauth-btn__inner" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-oauth-btn__inner']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "auth-form-oauth-btn__leading" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-oauth-btn__leading']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 24 24",
        width: "20",
        height: "20",
        'aria-hidden': "true",
        focusable: "false",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        fill: "currentColor",
        d: "M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "auth-form-oauth-btn__label" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-oauth-btn__label']} */ ;
    (__VLS_ctx.t('app.authLoginTwitch'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        ...{ class: "auth-form-oauth-btn__balance" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-oauth-btn__balance']} */ ;
    // @ts-ignore
    [mode, mode, t, t, t, onTwitch,];
    var __VLS_29;
    var __VLS_30;
    const __VLS_34 = AppButton || AppButton;
    // @ts-ignore
    const __VLS_35 = __VLS_asFunctionalComponent1(__VLS_34, new __VLS_34({
        ...{ 'onClick': {} },
        variant: "secondary",
        type: "button",
        ...{ class: "auth-form-oauth-btn auth-form-oauth-btn--google auth-form-oauth-btn--full" },
    }));
    const __VLS_36 = __VLS_35({
        ...{ 'onClick': {} },
        variant: "secondary",
        type: "button",
        ...{ class: "auth-form-oauth-btn auth-form-oauth-btn--google auth-form-oauth-btn--full" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_35));
    let __VLS_39;
    const __VLS_40 = ({ click: {} },
        { onClick: (__VLS_ctx.onGoogle) });
    /** @type {__VLS_StyleScopedClasses['auth-form-oauth-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['auth-form-oauth-btn--google']} */ ;
    /** @type {__VLS_StyleScopedClasses['auth-form-oauth-btn--full']} */ ;
    const { default: __VLS_41 } = __VLS_37.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "auth-form-oauth-btn__inner" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-oauth-btn__inner']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "auth-form-oauth-btn__leading" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-oauth-btn__leading']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 24 24",
        width: "20",
        height: "20",
        'aria-hidden': "true",
        focusable: "false",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        fill: "#4285F4",
        d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        fill: "#34A853",
        d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        fill: "#FBBC05",
        d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        fill: "#EA4335",
        d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "auth-form-oauth-btn__label" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-oauth-btn__label']} */ ;
    (__VLS_ctx.t('app.authLoginGoogle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        ...{ class: "auth-form-oauth-btn__balance" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-oauth-btn__balance']} */ ;
    // @ts-ignore
    [t, onGoogle,];
    var __VLS_37;
    var __VLS_38;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "auth-form-divider" },
        role: "separator",
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-divider']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        ...{ class: "auth-form-divider__line" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-divider__line']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "auth-form-divider__text" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-divider__text']} */ ;
    (__VLS_ctx.t('app.authOr'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        ...{ class: "auth-form-divider__line" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['auth-form-divider__line']} */ ;
    const __VLS_42 = LoginForm;
    // @ts-ignore
    const __VLS_43 = __VLS_asFunctionalComponent1(__VLS_42, new __VLS_42({
        redirectPath: (__VLS_ctx.redirectPath),
    }));
    const __VLS_44 = __VLS_43({
        redirectPath: (__VLS_ctx.redirectPath),
    }, ...__VLS_functionalComponentArgsRest(__VLS_43));
}
// @ts-ignore
[t, redirectPath,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
