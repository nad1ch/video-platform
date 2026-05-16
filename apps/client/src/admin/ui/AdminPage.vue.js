/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, RouterView, useRoute } from 'vue-router';
const route = useRoute();
const { t } = useI18n();
const items = computed(() => [
    { name: 'admin-users', label: t('adminPanel.navUsers'), to: '/app/admin' },
    { name: 'admin-streamers', label: t('adminPanel.navStreamers'), to: '/app/admin/streamers' },
    { name: 'admin-games', label: t('adminPanel.navGames'), to: '/app/admin/games' },
    { name: 'admin-billing', label: t('adminPanel.navBilling'), to: '/app/admin/billing' },
    { name: 'admin-stats', label: t('adminPanel.navStats'), to: '/app/admin/stats' },
    { name: 'admin-debug', label: t('adminPanel.navSession'), to: '/app/admin/debug' },
    { name: 'admin-diagnostics', label: t('adminPanel.navDiagnostics'), to: '/app/admin/diagnostics' },
]);
const activeName = computed(() => String(route.name ?? ''));
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "relative mx-auto flex h-full min-h-0 w-full max-w-[1400px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#12081d]/88 via-[#0b0614]/94 to-[#07040f]/98 text-slate-100 shadow-[0_24px_80px_rgba(5,1,14,0.45)] ring-1 ring-violet-300/10 before:pointer-events-none before:absolute before:inset-x-8 before:top-0 before:z-[2] before:h-px before:bg-gradient-to-r before:from-transparent before:via-violet-200/35 before:to-transparent md:flex-row" },
});
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-[1400px]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-white/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gradient-to-br']} */ ;
/** @type {__VLS_StyleScopedClasses['from-[#12081d]/88']} */ ;
/** @type {__VLS_StyleScopedClasses['via-[#0b0614]/94']} */ ;
/** @type {__VLS_StyleScopedClasses['to-[#07040f]/98']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-[0_24px_80px_rgba(5,1,14,0.45)]']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-violet-300/10']} */ ;
/** @type {__VLS_StyleScopedClasses['before:pointer-events-none']} */ ;
/** @type {__VLS_StyleScopedClasses['before:absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['before:inset-x-8']} */ ;
/** @type {__VLS_StyleScopedClasses['before:top-0']} */ ;
/** @type {__VLS_StyleScopedClasses['before:z-[2]']} */ ;
/** @type {__VLS_StyleScopedClasses['before:h-px']} */ ;
/** @type {__VLS_StyleScopedClasses['before:bg-gradient-to-r']} */ ;
/** @type {__VLS_StyleScopedClasses['before:from-transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['before:via-violet-200/35']} */ ;
/** @type {__VLS_StyleScopedClasses['before:to-transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['md:flex-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ class: "pointer-events-none absolute inset-0 opacity-[0.1]" },
    'aria-hidden': "true",
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-[0.1]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
    ...{ class: "relative z-[1] flex shrink-0 flex-col border-b border-white/10 bg-gradient-to-b from-[#181026] via-[#10091c] to-[#0b0614] p-5 shadow-[inset_-1px_0_0_rgba(255,255,255,0.06)] md:h-full md:w-64 md:border-b-0 md:border-r md:p-6" },
});
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['z-[1]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-white/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gradient-to-b']} */ ;
/** @type {__VLS_StyleScopedClasses['from-[#181026]']} */ ;
/** @type {__VLS_StyleScopedClasses['via-[#10091c]']} */ ;
/** @type {__VLS_StyleScopedClasses['to-[#0b0614]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-[inset_-1px_0_0_rgba(255,255,255,0.06)]']} */ ;
/** @type {__VLS_StyleScopedClasses['md:h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['md:w-64']} */ ;
/** @type {__VLS_StyleScopedClasses['md:border-b-0']} */ ;
/** @type {__VLS_StyleScopedClasses['md:border-r']} */ ;
/** @type {__VLS_StyleScopedClasses['md:p-6']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500" },
});
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.2em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
(__VLS_ctx.t('adminPanel.sidebarBrand'));
__VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({
    ...{ class: "mb-1 text-lg font-semibold tracking-tight text-white" },
});
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-tight']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
(__VLS_ctx.t('adminPanel.sidebarTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mb-6 text-xs leading-relaxed text-slate-400/80" },
});
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400/80']} */ ;
(__VLS_ctx.t('adminPanel.sidebarHint'));
__VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
    ...{ class: "flex flex-row flex-wrap gap-2 md:flex-col" },
    'aria-label': (__VLS_ctx.t('adminPanel.sectionsAria')),
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['md:flex-col']} */ ;
for (const [item] of __VLS_vFor((__VLS_ctx.items))) {
    let __VLS_0;
    /** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
    RouterLink;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        key: (item.name),
        to: (item.to),
        ...{ class: "rounded-2xl px-3.5 py-2.5 text-sm font-medium text-slate-400 transition-all hover:bg-violet-400/10 hover:text-slate-100 hover:ring-1 hover:ring-violet-300/15" },
        ...{ class: ({
                'bg-gradient-to-r from-violet-700/28 to-indigo-500/12 text-violet-50 ring-1 ring-violet-300/25 shadow-[0_0_28px_rgba(124,77,219,0.18)]': __VLS_ctx.activeName === item.name,
            }) },
    }));
    const __VLS_2 = __VLS_1({
        key: (item.name),
        to: (item.to),
        ...{ class: "rounded-2xl px-3.5 py-2.5 text-sm font-medium text-slate-400 transition-all hover:bg-violet-400/10 hover:text-slate-100 hover:ring-1 hover:ring-violet-300/15" },
        ...{ class: ({
                'bg-gradient-to-r from-violet-700/28 to-indigo-500/12 text-violet-50 ring-1 ring-violet-300/25 shadow-[0_0_28px_rgba(124,77,219,0.18)]': __VLS_ctx.activeName === item.name,
            }) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-violet-400/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:text-slate-100']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:ring-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:ring-violet-300/15']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-gradient-to-r']} */ ;
    /** @type {__VLS_StyleScopedClasses['from-violet-700/28']} */ ;
    /** @type {__VLS_StyleScopedClasses['to-indigo-500/12']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-violet-50']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-violet-300/25']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-[0_0_28px_rgba(124,77,219,0.18)]']} */ ;
    const { default: __VLS_5 } = __VLS_3.slots;
    (item.label);
    // @ts-ignore
    [t, t, t, t, items, activeName,];
    var __VLS_3;
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "relative z-[1] min-h-0 min-w-0 flex-1 overflow-auto p-4 md:p-6 lg:p-8" },
});
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['z-[1]']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['md:p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:p-8']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mx-auto min-h-full w-full max-w-[1180px] rounded-[24px] border border-white/10 bg-slate-950/35 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-[2px] md:p-6 lg:p-8" },
});
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-[1180px]']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-white/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-950/35']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]']} */ ;
/** @type {__VLS_StyleScopedClasses['backdrop-blur-[2px]']} */ ;
/** @type {__VLS_StyleScopedClasses['md:p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:p-8']} */ ;
let __VLS_6;
/** @ts-ignore @type { | typeof __VLS_components.RouterView | typeof __VLS_components.RouterView} */
RouterView;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({}));
const __VLS_8 = __VLS_7({}, ...__VLS_functionalComponentArgsRest(__VLS_7));
{
    const { default: __VLS_11 } = __VLS_9.slots;
    const [{ Component }] = __VLS_vSlot(__VLS_11);
    let __VLS_12;
    /** @ts-ignore @type { | typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
    Transition;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
        name: "route-soft",
    }));
    const __VLS_14 = __VLS_13({
        name: "route-soft",
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    const { default: __VLS_17 } = __VLS_15.slots;
    if (Component) {
        const __VLS_18 = (Component);
        // @ts-ignore
        const __VLS_19 = __VLS_asFunctionalComponent1(__VLS_18, new __VLS_18({
            key: (__VLS_ctx.route.path),
        }));
        const __VLS_20 = __VLS_19({
            key: (__VLS_ctx.route.path),
        }, ...__VLS_functionalComponentArgsRest(__VLS_19));
    }
    // @ts-ignore
    [route,];
    var __VLS_15;
    // @ts-ignore
    [];
    __VLS_9.slots['' /* empty slot name completion */];
}
var __VLS_9;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
