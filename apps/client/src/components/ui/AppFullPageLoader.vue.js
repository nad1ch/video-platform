/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { useI18n } from 'vue-i18n';
const __VLS_props = withDefaults(defineProps(), {
    visible: true,
    label: '',
    ariaLabel: '',
    teleport: true,
});
const { t } = useI18n();
const __VLS_defaults = {
    visible: true,
    label: '',
    ariaLabel: '',
    teleport: true,
};
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    to: "body",
    disabled: (!__VLS_ctx.teleport),
}));
const __VLS_2 = __VLS_1({
    to: "body",
    disabled: (!__VLS_ctx.teleport),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
let __VLS_6;
/** @ts-ignore @type { | typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
Transition;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
    name: "page-loader-fade",
}));
const __VLS_8 = __VLS_7({
    name: "page-loader-fade",
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
const { default: __VLS_11 } = __VLS_9.slots;
if (__VLS_ctx.visible) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "app-full-page-loader" },
        ...{ class: ({
                'app-full-page-loader--no-label': !__VLS_ctx.label,
                'app-full-page-loader--docked': !__VLS_ctx.teleport,
            }) },
        role: "status",
        'aria-label': (__VLS_ctx.label || __VLS_ctx.ariaLabel || __VLS_ctx.t('loader.ariaLoading')),
    });
    /** @type {__VLS_StyleScopedClasses['app-full-page-loader']} */ ;
    /** @type {__VLS_StyleScopedClasses['app-full-page-loader--no-label']} */ ;
    /** @type {__VLS_StyleScopedClasses['app-full-page-loader--docked']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "app-full-page-loader__rings" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['app-full-page-loader__rings']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        ...{ class: "app-full-page-loader__ring" },
    });
    /** @type {__VLS_StyleScopedClasses['app-full-page-loader__ring']} */ ;
    if (__VLS_ctx.label) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "app-full-page-loader__label" },
        });
        /** @type {__VLS_StyleScopedClasses['app-full-page-loader__label']} */ ;
        (__VLS_ctx.label);
    }
}
// @ts-ignore
[teleport, teleport, visible, label, label, label, label, ariaLabel, t,];
var __VLS_9;
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
