/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppButton from '@/components/ui/AppButton.vue';
import { useAuth } from '@/composables/useAuth';
import { replaceAuthQuery } from '@/utils/authRouteQuery';
const route = useRoute();
const router = useRouter();
const { confirmPasswordReset } = useAuth();
const password = ref('');
const confirmPassword = ref('');
const submitting = ref(false);
const feedback = ref(null);
const token = computed(() => {
    const raw = route.query.token;
    return typeof raw === 'string' ? raw : '';
});
async function onSubmit(e) {
    e.preventDefault();
    feedback.value = null;
    if (password.value.length < 6 || token.value.length === 0) {
        feedback.value = 'validation';
        return;
    }
    if (password.value !== confirmPassword.value) {
        feedback.value = 'mismatch';
        return;
    }
    submitting.value = true;
    try {
        const result = await confirmPasswordReset(token.value, password.value);
        if (result.ok) {
            await router.replace({ path: '/auth', query: replaceAuthQuery(route, 'reset-success') });
            return;
        }
        feedback.value = result.error;
    }
    finally {
        submitting.value = false;
    }
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
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "auth-page-label" },
});
/** @type {__VLS_StyleScopedClasses['auth-page-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "auth-page-label-text" },
});
/** @type {__VLS_StyleScopedClasses['auth-page-label-text']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "auth-page-input" },
    type: "password",
    name: "new-password",
    minlength: "6",
    autocomplete: "new-password",
    disabled: (__VLS_ctx.submitting),
    required: true,
});
(__VLS_ctx.password);
/** @type {__VLS_StyleScopedClasses['auth-page-input']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "auth-page-label" },
});
/** @type {__VLS_StyleScopedClasses['auth-page-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "auth-page-label-text" },
});
/** @type {__VLS_StyleScopedClasses['auth-page-label-text']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "auth-page-input" },
    type: "password",
    name: "confirm-password",
    minlength: "6",
    autocomplete: "new-password",
    disabled: (__VLS_ctx.submitting),
    required: true,
});
(__VLS_ctx.confirmPassword);
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
(__VLS_ctx.submitting ? '...' : 'Reset password');
// @ts-ignore
[onSubmit, submitting, submitting, submitting, submitting, password, confirmPassword,];
var __VLS_3;
if (__VLS_ctx.feedback === 'validation') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "auth-page-feedback auth-page-feedback--err" },
        role: "alert",
    });
    /** @type {__VLS_StyleScopedClasses['auth-page-feedback']} */ ;
    /** @type {__VLS_StyleScopedClasses['auth-page-feedback--err']} */ ;
}
else if (__VLS_ctx.feedback === 'mismatch') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "auth-page-feedback auth-page-feedback--err" },
        role: "alert",
    });
    /** @type {__VLS_StyleScopedClasses['auth-page-feedback']} */ ;
    /** @type {__VLS_StyleScopedClasses['auth-page-feedback--err']} */ ;
}
else if (__VLS_ctx.feedback === 'invalid_or_expired') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "auth-page-feedback auth-page-feedback--err" },
        role: "alert",
    });
    /** @type {__VLS_StyleScopedClasses['auth-page-feedback']} */ ;
    /** @type {__VLS_StyleScopedClasses['auth-page-feedback--err']} */ ;
}
else if (__VLS_ctx.feedback === 'server') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "auth-page-feedback auth-page-feedback--err" },
        role: "alert",
    });
    /** @type {__VLS_StyleScopedClasses['auth-page-feedback']} */ ;
    /** @type {__VLS_StyleScopedClasses['auth-page-feedback--err']} */ ;
}
// @ts-ignore
[feedback, feedback, feedback, feedback,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
