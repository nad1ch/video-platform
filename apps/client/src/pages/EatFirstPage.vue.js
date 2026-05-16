/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { onMounted } from 'vue';
import '@/eat-first/styles/motion.css';
import { bootstrapEatFirstAuthOnce } from '@/eat-first/bootstrapEatFirst';
import EatFirstCallPage from '@/eat-first/pages/EatFirstCallPage.vue';
onMounted(() => {
    void bootstrapEatFirstAuthOnce();
});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "eat-first-inner" },
});
/** @type {__VLS_StyleScopedClasses['eat-first-inner']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "eat-first-route-stack" },
});
/** @type {__VLS_StyleScopedClasses['eat-first-route-stack']} */ ;
const __VLS_0 = EatFirstCallPage;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
