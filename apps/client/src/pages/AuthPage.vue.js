/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import '@/eat-first/style.css';
import '@/eat-first/styles/theme.css';
import { computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import AuthForm from '@/components/auth/AuthForm.vue';
import LandingCloudBackdrop from '@/components/ui/LandingCloudBackdrop.vue';
import { useAuth } from '@/composables/useAuth';
import { safeOAuthRedirectPath } from '@/utils/safeOAuthRedirectPath';
import { useTheme } from '@/eat-first';
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { isAuthenticated, ensureAuthLoaded, loaded } = useAuth();
const { theme, setTheme } = useTheme();
const redirectPath = computed(() => {
    const r = route.query.redirect;
    return typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : '/app';
});
const allowsAuthedAccess = computed(() => {
    const mode = route.query.mode;
    const value = Array.isArray(mode) ? mode[0] : mode;
    return value === 'reset';
});
async function redirectIfAuthed() {
    await ensureAuthLoaded();
    if (isAuthenticated.value && !allowsAuthedAccess.value) {
        await router.replace(safeOAuthRedirectPath(redirectPath.value));
    }
}
onMounted(() => {
    setTheme(theme.value);
    void redirectIfAuthed();
});
watch([loaded, isAuthenticated], () => {
    if (loaded.value && isAuthenticated.value && !allowsAuthedAccess.value) {
        void router.replace(safeOAuthRedirectPath(redirectPath.value));
    }
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['auth-page__back']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page__back']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page-password-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page-password-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page-password-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page-input']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page-link']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page-link--block']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page-submit']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "auth-page eat-first-root page-stack" },
    'data-theme': (__VLS_ctx.theme),
});
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
/** @type {__VLS_StyleScopedClasses['eat-first-root']} */ ;
/** @type {__VLS_StyleScopedClasses['page-stack']} */ ;
const __VLS_0 = LandingCloudBackdrop;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "auth-page__backdrop" },
    variant: "app",
}));
const __VLS_2 = __VLS_1({
    ...{ class: "auth-page__backdrop" },
    variant: "app",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['auth-page__backdrop']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "auth-page__surface" },
});
/** @type {__VLS_StyleScopedClasses['auth-page__surface']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "auth-page__inner" },
});
/** @type {__VLS_StyleScopedClasses['auth-page__inner']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "auth-page__head" },
});
/** @type {__VLS_StyleScopedClasses['auth-page__head']} */ ;
let __VLS_5;
/** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
RouterLink;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    ...{ class: "auth-page__back" },
    to: ({ path: '/' }),
    'aria-label': (__VLS_ctx.t('app.authBackHome')),
    title: (__VLS_ctx.t('app.authBackHome')),
}));
const __VLS_7 = __VLS_6({
    ...{ class: "auth-page__back" },
    to: ({ path: '/' }),
    'aria-label': (__VLS_ctx.t('app.authBackHome')),
    title: (__VLS_ctx.t('app.authBackHome')),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
/** @type {__VLS_StyleScopedClasses['auth-page__back']} */ ;
const { default: __VLS_10 } = __VLS_8.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    ...{ class: "auth-page__back-svg" },
    xmlns: "http://www.w3.org/2000/svg",
    fill: "none",
    viewBox: "0 0 24 24",
    'stroke-width': "1.75",
    stroke: "currentColor",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['auth-page__back-svg']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18",
});
// @ts-ignore
[theme, t, t,];
var __VLS_8;
__VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({
    ...{ class: "auth-page__title" },
});
/** @type {__VLS_StyleScopedClasses['auth-page__title']} */ ;
(__VLS_ctx.t('app.authPageTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "auth-page__card" },
});
/** @type {__VLS_StyleScopedClasses['auth-page__card']} */ ;
const __VLS_11 = AuthForm;
// @ts-ignore
const __VLS_12 = __VLS_asFunctionalComponent1(__VLS_11, new __VLS_11({
    redirectPath: (__VLS_ctx.redirectPath),
}));
const __VLS_13 = __VLS_12({
    redirectPath: (__VLS_ctx.redirectPath),
}, ...__VLS_functionalComponentArgsRest(__VLS_12));
// @ts-ignore
[t, redirectPath,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
