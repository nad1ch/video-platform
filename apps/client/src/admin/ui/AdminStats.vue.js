/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAdminStatsState } from '@/admin';
const { t } = useI18n();
const { data, loading, errorKey, reloading, databaseConfigured, load, reload } = useAdminStatsState();
onMounted(() => {
    void load();
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "w-full min-w-0 space-y-6" },
});
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "flex flex-col gap-3 border-b border-slate-800/80 pb-4 sm:flex-row sm:items-end sm:justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "min-w-0" },
});
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "text-xl font-semibold tracking-tight text-white" },
});
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-tight']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
(__VLS_ctx.t('adminPanel.statsTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['mt-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
(__VLS_ctx.t('adminPanel.statsLead'));
if (!__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.reload) },
        type: "button",
        ...{ class: "shrink-0 rounded-lg border border-slate-700/80 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-700/90 disabled:opacity-50" },
        disabled: (__VLS_ctx.reloading),
    });
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-700/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-800/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-100']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-slate-700/90']} */ ;
    /** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
    (__VLS_ctx.reloading ? __VLS_ctx.t('adminPanel.statsReloading') : __VLS_ctx.t('adminPanel.statsReload'));
}
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
    (__VLS_ctx.t('adminPanel.statsLoading'));
}
else if (__VLS_ctx.errorKey === 'forbidden') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-xl border border-amber-900/50 bg-amber-950/20 p-4 text-sm text-amber-100/90" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-amber-900/50']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-amber-950/20']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-amber-100/90']} */ ;
    (__VLS_ctx.t('adminPanel.statsForbidden'));
}
else if (__VLS_ctx.errorKey === 'load') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm text-rose-300/90" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-rose-300/90']} */ ;
    (__VLS_ctx.t('adminPanel.statsError'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.load) },
        type: "button",
        ...{ class: "rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 ring-1 ring-slate-600 hover:bg-slate-700" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-800']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-slate-600']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-slate-700']} */ ;
    (__VLS_ctx.t('adminPanel.commonRetry'));
}
else if (__VLS_ctx.data) {
    if (!__VLS_ctx.databaseConfigured) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm text-amber-200/90" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-amber-200/90']} */ ;
        (__VLS_ctx.t('adminPanel.statsNoDb'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['lg:grid-cols-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 ring-1 ring-white/[0.03] lg:col-span-1" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-900/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-white/[0.03]']} */ ;
    /** @type {__VLS_StyleScopedClasses['lg:col-span-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-[11px] font-medium uppercase tracking-wide text-slate-500" },
    });
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    (__VLS_ctx.t('adminPanel.statUsers'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 text-2xl font-semibold tabular-nums text-white" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-white']} */ ;
    (__VLS_ctx.data.userCount ?? 0);
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
    (__VLS_ctx.t('adminPanel.statNadleRounds'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 text-2xl font-semibold tabular-nums text-cyan-300" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-cyan-300']} */ ;
    (__VLS_ctx.data.nadleRounds ?? 0);
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
    (__VLS_ctx.t('adminPanel.statTotalWinsInStats'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 text-2xl font-semibold tabular-nums text-emerald-300" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-emerald-300']} */ ;
    (__VLS_ctx.data.totalWinsRecorded ?? 0);
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
    (__VLS_ctx.t('adminPanel.statTotalGamesPlayed'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 text-2xl font-semibold tabular-nums text-slate-100" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-100']} */ ;
    (__VLS_ctx.data.totalGamesPlayed ?? 0);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-4 lg:grid-cols-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['lg:grid-cols-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 ring-1 ring-white/[0.03]" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-900/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-white/[0.03]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-medium uppercase tracking-wide text-slate-500" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    (__VLS_ctx.t('adminPanel.topWins'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.ol, __VLS_intrinsics.ol)({
        ...{ class: "mt-3 space-y-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
    for (const [u, i] of __VLS_vFor((__VLS_ctx.data.topWins ?? []))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (u.userId),
            ...{ class: "flex items-center justify-between gap-2 text-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "w-6 shrink-0 text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (i + 1);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "min-w-0 flex-1 truncate font-medium text-slate-100" },
        });
        /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-100']} */ ;
        (u.displayName);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "shrink-0 tabular-nums font-semibold text-cyan-300" },
        });
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-cyan-300']} */ ;
        (u.wins);
        // @ts-ignore
        [t, t, t, t, t, t, t, t, t, t, t, t, t, t, loading, loading, reload, reloading, reloading, errorKey, errorKey, load, data, data, data, data, data, data, databaseConfigured,];
    }
    if (!(__VLS_ctx.data.topWins && __VLS_ctx.data.topWins.length)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            ...{ class: "text-sm text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 ring-1 ring-white/[0.03]" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-900/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-white/[0.03]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-medium uppercase tracking-wide text-slate-500" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    (__VLS_ctx.t('adminPanel.topRating'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-xs text-slate-500" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    (__VLS_ctx.t('adminPanel.ratingHelp'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.ol, __VLS_intrinsics.ol)({
        ...{ class: "mt-3 space-y-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
    for (const [u, i] of __VLS_vFor((__VLS_ctx.data.topRating ?? []))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (u.userId),
            ...{ class: "flex items-center justify-between gap-2 text-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "w-6 shrink-0 text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (i + 1);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "min-w-0 flex-1 truncate font-medium text-slate-100" },
        });
        /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-100']} */ ;
        (u.displayName);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "shrink-0 tabular-nums font-semibold text-violet-200" },
        });
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-violet-200']} */ ;
        (u.rating);
        // @ts-ignore
        [t, t, data, data, data,];
    }
    if (!(__VLS_ctx.data.topRating && __VLS_ctx.data.topRating.length)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            ...{ class: "text-sm text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    }
}
// @ts-ignore
[data, data,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
