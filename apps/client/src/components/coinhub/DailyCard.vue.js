/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import '@/styles/coinhub-design-system.css';
const props = withDefaults(defineProps(), { state: 'available', actionLabel: undefined, visualTier: 'free' });
const emit = defineEmits();
function onPrimaryClick() {
    if (props.actionLabel) {
        emit('open');
    }
}
const __VLS_defaults = { state: 'available', actionLabel: undefined, visualTier: 'free' };
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
/** @type {__VLS_StyleScopedClasses['coinhub-daily__visual-bg']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: ([
            'coinhub-daily coinhub-daily--game ch-ds-card ch-ds-card--interactive flex flex-col p-6',
            `coinhub-daily--tier-${__VLS_ctx.visualTier}`,
            __VLS_ctx.state === 'available' && 'coinhub-daily--interactive coinhub-daily--state-available',
            __VLS_ctx.state === 'locked' && 'coinhub-daily--state-locked',
            __VLS_ctx.state === 'cooldown' && 'coinhub-daily--state-cooldown',
        ]) },
});
/** @type {__VLS_StyleScopedClasses['coinhub-daily']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-daily--game']} */ ;
/** @type {__VLS_StyleScopedClasses['ch-ds-card']} */ ;
/** @type {__VLS_StyleScopedClasses['ch-ds-card--interactive']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "coinhub-daily__visual pointer-events-none relative mb-3 h-24 overflow-hidden rounded-[20px] border border-white/[0.06] sm:h-28" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['coinhub-daily__visual']} */ ;
/** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['h-24']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[20px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-white/[0.06]']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:h-28']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ class: "coinhub-daily__visual-bg absolute inset-0" },
});
/** @type {__VLS_StyleScopedClasses['coinhub-daily__visual-bg']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "absolute inset-0 flex items-center justify-center" },
});
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: ([
            'coinhub-daily__chest flex h-16 w-24 items-end justify-center sm:h-[4.5rem] sm:w-28',
            __VLS_ctx.visualTier === 'subscriber' && 'coinhub-daily__chest--sub',
        ]) },
});
/** @type {__VLS_StyleScopedClasses['coinhub-daily__chest']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-16']} */ ;
/** @type {__VLS_StyleScopedClasses['w-24']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:h-[4.5rem]']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:w-28']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "coinhub-daily__chest-icon text-3xl sm:text-4xl" },
});
/** @type {__VLS_StyleScopedClasses['coinhub-daily__chest-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:text-4xl']} */ ;
(__VLS_ctx.visualTier === 'subscriber' ? '👑' : '📦');
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: ([
            'ch-ds-text-label text-xs font-semibold uppercase tracking-wider',
            __VLS_ctx.visualTier === 'subscriber' ? 'text-[#9CA3AF]' : 'text-[#9CA3AF]',
        ]) },
});
/** @type {__VLS_StyleScopedClasses['ch-ds-text-label']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
(__VLS_ctx.tagLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "mt-1.5 text-base font-semibold leading-snug text-[#FFFFFF] sm:text-lg" },
});
/** @type {__VLS_StyleScopedClasses['mt-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-snug']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[#FFFFFF]']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:text-lg']} */ ;
(__VLS_ctx.title);
if (__VLS_ctx.state === 'available') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 flex min-h-[1.25rem] items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-[1.25rem]']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: ([
                'text-sm',
                __VLS_ctx.visualTier === 'subscriber' ? 'text-amber-200/80' : 'text-violet-300/90',
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    (__VLS_ctx.stateLabelAvailable);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-4 min-h-[2.75rem]" },
});
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-[2.75rem]']} */ ;
if (__VLS_ctx.state === 'available' && __VLS_ctx.actionLabel) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.onPrimaryClick) },
        type: "button",
        ...{ class: ([
                'w-full cursor-pointer rounded-xl py-3.5 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                __VLS_ctx.visualTier === 'subscriber'
                    ? 'ch-ds-btn-gold focus-visible:outline-amber-300/80'
                    : 'ch-ds-btn-purple focus-visible:outline-violet-300',
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus-visible:outline']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus-visible:outline-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus-visible:outline-offset-2']} */ ;
    (__VLS_ctx.actionLabel);
}
else if (__VLS_ctx.state === 'locked') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex h-full min-h-[2.75rem] items-center justify-center rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 text-center text-sm font-medium text-slate-500" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-[2.75rem]']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-700/60']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-950/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    (__VLS_ctx.stateLabelLocked);
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex h-full min-h-[2.75rem] flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 py-2 text-center" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-[2.75rem]']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-0.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-700/60']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-950/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-sm font-medium text-amber-400/90" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-amber-400/90']} */ ;
    (__VLS_ctx.stateLabelCooldown);
    if (__VLS_ctx.detailLabel) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "coinhub-daily-cd-timer font-semibold tabular-nums text-sm text-amber-300/95" },
        });
        /** @type {__VLS_StyleScopedClasses['coinhub-daily-cd-timer']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-amber-300/95']} */ ;
        (__VLS_ctx.detailLabel);
    }
}
// @ts-ignore
[visualTier, visualTier, visualTier, visualTier, visualTier, visualTier, state, state, state, state, state, state, tagLabel, title, stateLabelAvailable, actionLabel, actionLabel, onPrimaryClick, stateLabelLocked, stateLabelCooldown, detailLabel, detailLabel,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
