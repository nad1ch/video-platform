/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { STREAMER_NICK } from '@/eat-first/constants/brand.js';
const { t } = useI18n();
const defaultNadleStreamer = (typeof import.meta.env.VITE_DEFAULT_STREAMER === 'string' && import.meta.env.VITE_DEFAULT_STREAMER.trim()) ||
    STREAMER_NICK;
const lastAction = ref(null);
function stub(action) {
    lastAction.value = action;
}
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
    ...{ class: "border-b border-slate-800/80 pb-4" },
});
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "text-xl font-semibold tracking-tight text-white" },
});
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-tight']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
(__VLS_ctx.t('adminPanel.gamesTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['mt-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
(__VLS_ctx.t('adminPanel.gamesLead'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
RouterLink;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    to: ({ name: 'nadle-streamer', params: { streamer: __VLS_ctx.defaultNadleStreamer } }),
    ...{ class: "inline-flex items-center rounded-lg bg-slate-800/90 px-3 py-2 text-xs font-semibold text-slate-100 ring-1 ring-slate-600/60 transition hover:bg-slate-700/90" },
}));
const __VLS_2 = __VLS_1({
    to: ({ name: 'nadle-streamer', params: { streamer: __VLS_ctx.defaultNadleStreamer } }),
    ...{ class: "inline-flex items-center rounded-lg bg-slate-800/90 px-3 py-2 text-xs font-semibold text-slate-100 ring-1 ring-slate-600/60 transition hover:bg-slate-700/90" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-800/90']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-slate-600/60']} */ ;
/** @type {__VLS_StyleScopedClasses['transition']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-slate-700/90']} */ ;
const { default: __VLS_5 } = __VLS_3.slots;
(__VLS_ctx.t('adminPanel.gamesOpenNadle'));
// @ts-ignore
[t, t, t, defaultNadleStreamer,];
var __VLS_3;
let __VLS_6;
/** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
RouterLink;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
    to: ({ name: 'eat' }),
    ...{ class: "inline-flex items-center rounded-lg bg-violet-950/80 px-3 py-2 text-xs font-semibold text-violet-100 ring-1 ring-violet-700/45 transition hover:bg-violet-900/80" },
}));
const __VLS_8 = __VLS_7({
    to: ({ name: 'eat' }),
    ...{ class: "inline-flex items-center rounded-lg bg-violet-950/80 px-3 py-2 text-xs font-semibold text-violet-100 ring-1 ring-violet-700/45 transition hover:bg-violet-900/80" },
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-violet-950/80']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-violet-100']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-violet-700/45']} */ ;
/** @type {__VLS_StyleScopedClasses['transition']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-violet-900/80']} */ ;
const { default: __VLS_11 } = __VLS_9.slots;
(__VLS_ctx.t('adminPanel.gamesOpenEat'));
// @ts-ignore
[t,];
var __VLS_9;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-xl border border-slate-800/80 bg-slate-900/40 p-6 ring-1 ring-white/[0.03]" },
});
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-900/40']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-white/[0.03]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mb-4 text-xs font-medium uppercase tracking-wide text-slate-500" },
});
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
(__VLS_ctx.t('adminPanel.gamesPanelTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap gap-3" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.stub('start');
            // @ts-ignore
            [t, stub,];
        } },
    type: "button",
    ...{ class: "rounded-lg bg-emerald-800/90 px-4 py-2.5 text-sm font-semibold text-white shadow-sm ring-1 ring-emerald-600/30 transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-emerald-800/90']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-emerald-600/30']} */ ;
/** @type {__VLS_StyleScopedClasses['transition']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-emerald-700']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus-visible:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus-visible:ring-emerald-400']} */ ;
/** @type {__VLS_StyleScopedClasses['focus-visible:ring-offset-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus-visible:ring-offset-slate-950']} */ ;
(__VLS_ctx.t('adminPanel.gamesStart'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.stub('stop');
            // @ts-ignore
            [t, stub,];
        } },
    type: "button",
    ...{ class: "rounded-lg bg-amber-800/90 px-4 py-2.5 text-sm font-semibold text-white shadow-sm ring-1 ring-amber-600/30 transition hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-amber-800/90']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-amber-600/30']} */ ;
/** @type {__VLS_StyleScopedClasses['transition']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-amber-700']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus-visible:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus-visible:ring-amber-400']} */ ;
/** @type {__VLS_StyleScopedClasses['focus-visible:ring-offset-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus-visible:ring-offset-slate-950']} */ ;
(__VLS_ctx.t('adminPanel.gamesStop'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.stub('reset');
            // @ts-ignore
            [t, stub,];
        } },
    type: "button",
    ...{ class: "rounded-lg bg-rose-900/90 px-4 py-2.5 text-sm font-semibold text-white shadow-sm ring-1 ring-rose-700/40 transition hover:bg-rose-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-rose-900/90']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-rose-700/40']} */ ;
/** @type {__VLS_StyleScopedClasses['transition']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-rose-800']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus-visible:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus-visible:ring-rose-400']} */ ;
/** @type {__VLS_StyleScopedClasses['focus-visible:ring-offset-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus-visible:ring-offset-slate-950']} */ ;
(__VLS_ctx.t('adminPanel.gamesReset'));
if (__VLS_ctx.lastAction) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-5 text-sm text-slate-400" },
        role: "status",
    });
    /** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
    (__VLS_ctx.t('adminPanel.gamesStub'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono text-slate-300" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-300']} */ ;
    (__VLS_ctx.lastAction);
}
// @ts-ignore
[t, t, lastAction, lastAction,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
