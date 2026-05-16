/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { useI18n } from 'vue-i18n';
const emit = defineEmits();
const { t } = useI18n();
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "w-full border-t border-white/10 bg-slate-950/35 px-2 pb-2 pt-2" },
});
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-white/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-950/35']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('clearCanvas');
            // @ts-ignore
            [emit,];
        } },
    type: "button",
    ...{ class: "sa-chip-btn flex w-full !min-h-[2.65rem] !justify-center !py-3 !text-[0.78rem] !font-extrabold !tracking-wide text-[color:var(--text-heading,#f1f5f9)]" },
});
/** @type {__VLS_StyleScopedClasses['sa-chip-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['!min-h-[2.65rem]']} */ ;
/** @type {__VLS_StyleScopedClasses['!justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['!py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['!text-[0.78rem]']} */ ;
/** @type {__VLS_StyleScopedClasses['!font-extrabold']} */ ;
/** @type {__VLS_StyleScopedClasses['!tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[color:var(--text-heading,#f1f5f9)]']} */ ;
(__VLS_ctx.t('nadrawShow.clearCanvas'));
// @ts-ignore
[t,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
