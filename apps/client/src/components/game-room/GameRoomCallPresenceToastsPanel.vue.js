/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { useI18n } from 'vue-i18n';
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
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "call-page__toasts" },
    role: "region",
    'aria-label': (__VLS_ctx.t('callPage.toastStackAria')),
});
/** @type {__VLS_StyleScopedClasses['call-page__toasts']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.TransitionGroup | typeof __VLS_components.TransitionGroup} */
TransitionGroup;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    name: "call-toast",
    tag: "div",
    ...{ class: "call-page__toast-stack" },
}));
const __VLS_2 = __VLS_1({
    name: "call-toast",
    tag: "div",
    ...{ class: "call-page__toast-stack" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['call-page__toast-stack']} */ ;
const { default: __VLS_5 } = __VLS_3.slots;
for (const [x] of __VLS_vFor((__VLS_ctx.toasts))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (x.id),
        ...{ class: "call-page__toast" },
        ...{ class: (x.kind === 'leave' ? 'call-page__toast--leave' : 'call-page__toast--join') },
    });
    /** @type {__VLS_StyleScopedClasses['call-page__toast']} */ ;
    (x.text);
    // @ts-ignore
    [t, toasts,];
}
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
