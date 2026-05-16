/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAdminStreamersState } from '@/admin';
import { appConfirm } from '@/utils/appConfirm';
import { trackClientEvent } from '@/utils/clientAnalytics';
const { t, locale } = useI18n();
const { streamers, loading, saving, errorKey, databaseConfigured, slug, ownerId, ownersWithTwitch, refresh, createStreamer, removeStreamer: removeStreamerRequest, } = useAdminStreamersState();
async function removeStreamer(id) {
    if (!appConfirm('Deactivate this streamer? Existing game and leaderboard history will be kept.')) {
        return;
    }
    trackClientEvent('streamer_deactivate_clicked', { streamerId: id });
    await removeStreamerRequest(id);
}
async function onCreateStreamer() {
    trackClientEvent('streamer_create_clicked', { ownerId: ownerId.value, slug: slug.value.trim().toLowerCase() });
    await createStreamer();
}
onMounted(() => {
    void refresh();
});
function formatUpdated() {
    try {
        return new Intl.DateTimeFormat(locale.value || undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date());
    }
    catch {
        return new Date().toLocaleString();
    }
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "admin-streamers max-w-3xl text-slate-100" },
});
/** @type {__VLS_StyleScopedClasses['admin-streamers']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-100']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "mb-6" },
});
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "text-xl font-semibold tracking-tight text-white" },
});
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-tight']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
(__VLS_ctx.t('adminPanel.streamersTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-sm leading-relaxed text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
(__VLS_ctx.t('adminPanel.streamersLead'));
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
    (__VLS_ctx.t('adminPanel.streamersLoading'));
}
else if (__VLS_ctx.errorKey === 'forbidden') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm text-amber-300" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-amber-300']} */ ;
    (__VLS_ctx.t('adminPanel.usersForbidden'));
}
else if (__VLS_ctx.errorKey === 'load') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm text-rose-300" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-rose-300']} */ ;
    (__VLS_ctx.t('adminPanel.streamersError'));
}
else if (!__VLS_ctx.databaseConfigured) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm text-amber-200" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-amber-200']} */ ;
    (__VLS_ctx.t('adminPanel.usersNoDb'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-xs text-slate-500" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    (__VLS_ctx.t('adminPanel.usersNoDbHint'));
}
else {
    if (__VLS_ctx.errorKey === 'save') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mb-4 text-sm text-rose-300" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-rose-300']} */ ;
        (__VLS_ctx.t('adminPanel.streamersSaveError'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
        ...{ onSubmit: (__VLS_ctx.onCreateStreamer) },
        ...{ class: "mb-8 flex flex-col gap-4 rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 md:flex-row md:items-end" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-900/50']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:flex-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:items-end']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "flex min-w-0 flex-1 flex-col gap-1 text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-medium text-slate-300" },
    });
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-300']} */ ;
    (__VLS_ctx.t('adminPanel.streamersSlugLabel'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.slug),
        type: "text",
        autocomplete: "off",
        ...{ class: "rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-cyan-500/40 focus:ring-2" },
        placeholder: (__VLS_ctx.t('adminPanel.streamersSlugPlaceholder')),
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-700']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-950']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-100']} */ ;
    /** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-cyan-500/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "flex min-w-0 flex-1 flex-col gap-1 text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-medium text-slate-300" },
    });
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-300']} */ ;
    (__VLS_ctx.t('adminPanel.streamersOwnerLabel'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.ownerId),
        ...{ class: "rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-cyan-500/40 focus:ring-2" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-700']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-950']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-100']} */ ;
    /** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-cyan-500/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        disabled: true,
        value: "",
    });
    (__VLS_ctx.t('adminPanel.streamersOwnerPlaceholder'));
    for (const [o] of __VLS_vFor((__VLS_ctx.ownersWithTwitch))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (o.id),
            value: (o.id),
        });
        (o.displayName);
        (__VLS_ctx.t('adminPanel.streamersTwitchLinked'));
        // @ts-ignore
        [t, t, t, t, t, t, t, t, t, t, t, t, t, loading, errorKey, errorKey, errorKey, databaseConfigured, onCreateStreamer, slug, ownerId, ownersWithTwitch,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        type: "submit",
        ...{ class: "shrink-0 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50" },
        disabled: (__VLS_ctx.saving || !__VLS_ctx.slug.trim() || !__VLS_ctx.ownerId),
    });
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-gradient-to-r']} */ ;
    /** @type {__VLS_StyleScopedClasses['from-cyan-600']} */ ;
    /** @type {__VLS_StyleScopedClasses['to-indigo-600']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-white']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:opacity-95']} */ ;
    /** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
    /** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
    (__VLS_ctx.t('adminPanel.streamersCreate'));
    if (__VLS_ctx.ownersWithTwitch.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mb-4 text-xs text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (__VLS_ctx.t('adminPanel.streamersNoTwitchOwners'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-2 flex items-center justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "text-sm font-semibold text-slate-300" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-300']} */ ;
    (__VLS_ctx.t('adminPanel.streamersListTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.refresh) },
        type: "button",
        ...{ class: "text-xs font-medium text-cyan-400 hover:underline" },
        disabled: (__VLS_ctx.loading || __VLS_ctx.saving),
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-cyan-400']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:underline']} */ ;
    (__VLS_ctx.t('adminPanel.streamersRefresh'));
    if (__VLS_ctx.streamers.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
            ...{ class: "rounded-lg border border-dashed border-slate-700/80 p-6 text-sm text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-slate-700/80']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-6']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (__VLS_ctx.t('adminPanel.streamersEmpty'));
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
            ...{ class: "divide-y divide-slate-800/90 rounded-lg border border-slate-800/80 bg-slate-900/40" },
        });
        /** @type {__VLS_StyleScopedClasses['divide-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['divide-slate-800/90']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-slate-900/40']} */ ;
        for (const [s] of __VLS_vFor((__VLS_ctx.streamers))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                key: (s.id),
                ...{ class: "flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:justify-between']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "min-w-0" },
            });
            /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "font-mono font-semibold text-cyan-200" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-cyan-200']} */ ;
            (s.name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "truncate text-xs text-slate-500" },
            });
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
            (s.id.slice(0, 12));
            (s.twitchId);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "ml-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase" },
                ...{ class: (s.isActive ? 'border-emerald-700/60 text-emerald-300' : 'border-slate-700 text-slate-500') },
            });
            /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
            (s.isActive ? 'active' : 'inactive');
            if (s.owner) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                (__VLS_ctx.t('adminPanel.streamersOwnerShort'));
                (s.owner.displayName);
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.errorKey === 'forbidden'))
                            return;
                        if (!!(__VLS_ctx.errorKey === 'load'))
                            return;
                        if (!!(!__VLS_ctx.databaseConfigured))
                            return;
                        if (!!(__VLS_ctx.streamers.length === 0))
                            return;
                        __VLS_ctx.removeStreamer(s.id);
                        // @ts-ignore
                        [t, t, t, t, t, t, loading, slug, ownerId, ownersWithTwitch, saving, saving, refresh, streamers, streamers, removeStreamer,];
                    } },
                type: "button",
                ...{ class: "shrink-0 text-xs font-medium text-rose-400 hover:underline" },
                disabled: (__VLS_ctx.saving || !s.isActive),
            });
            /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-rose-400']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:underline']} */ ;
            (s.isActive ? __VLS_ctx.t('adminPanel.streamersDelete') : 'Inactive');
            // @ts-ignore
            [t, saving,];
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-4 text-[11px] text-slate-600" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
    (__VLS_ctx.t('adminPanel.streamersHint'));
    (__VLS_ctx.formatUpdated());
}
// @ts-ignore
[t, formatUpdated,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
