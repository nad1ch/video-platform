/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { useI18n } from 'vue-i18n';
import '@/styles/coinhub-design-system.css';
const __VLS_props = withDefaults(defineProps(), { statusLabel: undefined, viewersLabel: undefined, live: false });
const { t } = useI18n();
const __VLS_defaults = { statusLabel: undefined, viewersLabel: undefined, live: false };
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
    ...{ class: "coinhub-streamer ch-ds-card ch-ds-card--interactive group relative flex items-center gap-3 overflow-hidden rounded-[20px] py-3 pl-3 pr-4" },
});
/** @type {__VLS_StyleScopedClasses['coinhub-streamer']} */ ;
/** @type {__VLS_StyleScopedClasses['ch-ds-card']} */ ;
/** @type {__VLS_StyleScopedClasses['ch-ds-card--interactive']} */ ;
/** @type {__VLS_StyleScopedClasses['group']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[20px]']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['pl-3']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ class: "coinhub-streamer__avatar h-10 w-10 shrink-0 rounded-full border border-violet-500/25 bg-gradient-to-b from-slate-600 to-slate-950 shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_2px_8px_rgba(0,0,0,0.45)] transition-shadow group-hover:border-violet-400/30" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['coinhub-streamer__avatar']} */ ;
/** @type {__VLS_StyleScopedClasses['h-10']} */ ;
/** @type {__VLS_StyleScopedClasses['w-10']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-violet-500/25']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gradient-to-b']} */ ;
/** @type {__VLS_StyleScopedClasses['from-slate-600']} */ ;
/** @type {__VLS_StyleScopedClasses['to-slate-950']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_2px_8px_rgba(0,0,0,0.45)]']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['group-hover:border-violet-400/30']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "min-w-0 flex-1" },
});
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex min-w-0 items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "truncate text-sm font-semibold text-[#FFFFFF]" },
});
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[#FFFFFF]']} */ ;
(__VLS_ctx.name);
if (__VLS_ctx.live) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "shrink-0 rounded border border-rose-500/50 bg-rose-950/80 px-1.5 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-wide text-rose-200 shadow-[0_0_10px_-2px_rgba(244,63,94,0.45)]" },
    });
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-rose-500/50']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-rose-950/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[0.6rem]']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-extrabold']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-rose-200']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-[0_0_10px_-2px_rgba(244,63,94,0.45)]']} */ ;
    (__VLS_ctx.t('coinHub.liveBadge'));
}
if (__VLS_ctx.statusLabel) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "ch-ds-text-muted mt-0.5" },
    });
    /** @type {__VLS_StyleScopedClasses['ch-ds-text-muted']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
    (__VLS_ctx.statusLabel);
}
if (__VLS_ctx.viewersLabel) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "shrink-0 text-sm font-bold tabular-nums text-[#9CA3AF]" },
    });
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[#9CA3AF]']} */ ;
    (__VLS_ctx.viewersLabel);
}
// @ts-ignore
[name, live, t, statusLabel, statusLabel, viewersLabel, viewersLabel,];
const __VLS_export = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
