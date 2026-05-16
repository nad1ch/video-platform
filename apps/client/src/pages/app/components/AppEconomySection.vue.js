/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { useI18n } from 'vue-i18n';
import EconomySlotBanner from '@/pages/app/components/EconomySlotBanner.vue';
const __VLS_props = defineProps();
const { t } = useI18n();
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['app-economy__title']} */ ;
/** @type {__VLS_StyleScopedClasses['app-economy__panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-economy__banner']} */ ;
/** @type {__VLS_StyleScopedClasses['app-economy__title']} */ ;
/** @type {__VLS_StyleScopedClasses['app-economy__panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-economy__banner']} */ ;
/** @type {__VLS_StyleScopedClasses['app-economy__title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "app-economy app-economy__panel" },
    'aria-labelledby': "app-economy-title",
});
/** @type {__VLS_StyleScopedClasses['app-economy']} */ ;
/** @type {__VLS_StyleScopedClasses['app-economy__panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    id: "app-economy-title",
    ...{ class: "app-economy__title" },
});
/** @type {__VLS_StyleScopedClasses['app-economy__title']} */ ;
(__VLS_ctx.t('home.sectionEconomy'));
const __VLS_0 = EconomySlotBanner;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "app-economy__banner" },
    to: (__VLS_ctx.to),
}));
const __VLS_2 = __VLS_1({
    ...{ class: "app-economy__banner" },
    to: (__VLS_ctx.to),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['app-economy__banner']} */ ;
// @ts-ignore
[t, to,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
