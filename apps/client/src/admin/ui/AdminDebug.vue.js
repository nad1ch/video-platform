/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, onMounted, ref, toRaw } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuth } from '@/composables/useAuth';
const { t } = useI18n();
const { user, loaded, refresh, ensureAuthLoaded } = useAuth();
const refreshing = ref(false);
const roleLine = computed(() => user.value?.role ?? t('adminPanel.sessionNotSignedIn'));
const rawAuthJson = computed(() => {
    const u = user.value;
    if (!u)
        return 'null';
    try {
        return JSON.stringify(toRaw(u), null, 2);
    }
    catch {
        return String(u);
    }
});
async function doRefresh() {
    refreshing.value = true;
    try {
        await refresh();
    }
    finally {
        refreshing.value = false;
    }
}
onMounted(() => {
    void (async () => {
        await ensureAuthLoaded();
        await refresh();
    })();
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "w-full min-w-0 space-y-5" },
});
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "flex flex-col gap-3 border-b border-slate-800/80 pb-4 sm:flex-row sm:items-start sm:justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "text-xl font-semibold tracking-tight text-white" },
});
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-tight']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
(__VLS_ctx.t('adminPanel.sessionTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1.5 max-w-xl text-sm leading-relaxed text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['mt-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
(__VLS_ctx.t('adminPanel.sessionLead'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.doRefresh) },
    type: "button",
    ...{ class: "shrink-0 rounded-lg bg-cyan-950/80 px-3 py-2 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-700/50 hover:bg-cyan-900/80 disabled:opacity-50" },
    disabled: (__VLS_ctx.refreshing),
});
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-cyan-950/80']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-cyan-100']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-cyan-700/50']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-cyan-900/80']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
(__VLS_ctx.refreshing ? __VLS_ctx.t('adminPanel.sessionRefreshing') : __VLS_ctx.t('adminPanel.sessionRefresh'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-3 sm:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 ring-1 ring-white/[0.03]" },
});
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-900/40']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-white/[0.03]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-[11px] font-medium uppercase tracking-wide text-slate-500" },
});
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
(__VLS_ctx.t('adminPanel.sessionAuthLoaded'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 font-mono text-sm text-slate-200" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
(__VLS_ctx.loaded);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 ring-1 ring-white/[0.03]" },
});
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-900/40']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-white/[0.03]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-[11px] font-medium uppercase tracking-wide text-slate-500" },
});
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
(__VLS_ctx.t('adminPanel.sessionCurrentUser'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 break-all font-mono text-sm text-slate-200" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['break-all']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
(__VLS_ctx.user ? `${__VLS_ctx.user.displayName} (${__VLS_ctx.user.id})` : 'null');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 sm:col-span-2 ring-1 ring-white/[0.03]" },
});
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-900/40']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:col-span-2']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-white/[0.03]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-[11px] font-medium uppercase tracking-wide text-slate-500" },
});
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
(__VLS_ctx.t('adminPanel.sessionRole'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 font-mono text-sm text-amber-200/95" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-200/95']} */ ;
(__VLS_ctx.roleLine);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 sm:col-span-2 ring-1 ring-white/[0.03]" },
});
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-900/40']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:col-span-2']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-white/[0.03]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-[11px] font-medium uppercase tracking-wide text-slate-500" },
});
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
(__VLS_ctx.t('adminPanel.sessionRawJson'));
__VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
    ...{ class: "mt-2 max-h-80 overflow-auto rounded-lg bg-slate-950/90 p-3 text-xs leading-relaxed text-slate-300 ring-1 ring-slate-800" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-80']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-950/90']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-300']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-slate-800']} */ ;
(__VLS_ctx.rawAuthJson);
// @ts-ignore
[t, t, t, t, t, t, t, t, doRefresh, refreshing, refreshing, loaded, user, user, user, roleLine, rawAuthJson,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
