/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
const { t } = useI18n();
const router = useRouter();
function goHome() {
    void router.push({ name: 'home' });
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['beta-access-page__card']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-page__card']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-page__eyebrow']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-page__card']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-page__body']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-page__note']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-page__button']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "beta-access-page" },
    'aria-labelledby': "beta-access-title",
});
/** @type {__VLS_StyleScopedClasses['beta-access-page']} */ ;
const __VLS_0 = AppCard || AppCard;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "beta-access-page__card" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "beta-access-page__card" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['beta-access-page__card']} */ ;
const { default: __VLS_5 } = __VLS_3.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "beta-access-page__eyebrow" },
});
/** @type {__VLS_StyleScopedClasses['beta-access-page__eyebrow']} */ ;
(__VLS_ctx.t('betaAccess.eyebrow'));
__VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({
    id: "beta-access-title",
});
(__VLS_ctx.t('betaAccess.title'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "beta-access-page__body" },
});
/** @type {__VLS_StyleScopedClasses['beta-access-page__body']} */ ;
(__VLS_ctx.t('betaAccess.body'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "beta-access-page__note" },
});
/** @type {__VLS_StyleScopedClasses['beta-access-page__note']} */ ;
(__VLS_ctx.t('betaAccess.note'));
const __VLS_6 = AppButton || AppButton;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
    ...{ 'onClick': {} },
    ...{ class: "beta-access-page__button" },
    variant: "primary",
    type: "button",
}));
const __VLS_8 = __VLS_7({
    ...{ 'onClick': {} },
    ...{ class: "beta-access-page__button" },
    variant: "primary",
    type: "button",
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
let __VLS_11;
const __VLS_12 = ({ click: {} },
    { onClick: (__VLS_ctx.goHome) });
/** @type {__VLS_StyleScopedClasses['beta-access-page__button']} */ ;
const { default: __VLS_13 } = __VLS_9.slots;
(__VLS_ctx.t('betaAccess.backHome'));
// @ts-ignore
[t, t, t, t, t, goHome,];
var __VLS_9;
var __VLS_10;
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
