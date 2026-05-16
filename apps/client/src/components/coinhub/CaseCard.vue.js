/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import '@/styles/coinhub-design-system.css';
const props = withDefaults(defineProps(), {
    title: '',
    priceLabel: undefined,
    state: 'available',
    isRemoteBusy: false,
    rarityId: 0,
});
const { t } = useI18n();
const displayTitle = computed(() => props.title || t('coinHub.caseDefaultTitle'));
const rarityKey = computed(() => ['common', 'rare', 'epic', 'legendary'][props.rarityId % 4]);
const isLegendary = computed(() => (props.rarityId % 4) === 3);
const emit = defineEmits();
function onSelectClick() {
    if (props.isRemoteBusy) {
        return;
    }
    emit('open');
}
const __VLS_defaults = {
    title: '',
    priceLabel: undefined,
    state: 'available',
    isRemoteBusy: false,
    rarityId: 0,
};
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
/** @type {__VLS_StyleScopedClasses['coinhub-rarity--common']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-rarity--common']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-rarity--rare']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-rarity--rare']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-case-icon-sigil']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-rarity--epic']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-rarity--epic']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-case-icon-sigil']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-rarity--legendary']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-rarity--legendary']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-rarity--legendary']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-rarity--legendary']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-loot--legend-breathe']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-loot--legend-float']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-loot__spark']} */ ;
if (__VLS_ctx.state === 'available') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.onSelectClick) },
        type: "button",
        ...{ class: ([
                'coinhub-loot coinhub-loot-box coinhub-case ch-ds-card ch-ds-card--interactive group relative flex min-h-[10.5rem] w-full min-w-0 flex-col overflow-hidden rounded-[20px] border-0 p-0 text-left',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500/50',
                `coinhub-rarity--${__VLS_ctx.rarityKey}`,
                __VLS_ctx.isLegendary && 'coinhub-loot--legendary',
                __VLS_ctx.isLegendary && 'coinhub-loot--legend-breathe',
                __VLS_ctx.isLegendary && 'coinhub-loot--legend-float',
                __VLS_ctx.isRemoteBusy && 'coinhub-case--remote-busy',
            ]) },
        'aria-busy': (__VLS_ctx.isRemoteBusy),
        'aria-label': (__VLS_ctx.displayTitle),
        disabled: (__VLS_ctx.isRemoteBusy),
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-loot']} */ ;
    /** @type {__VLS_StyleScopedClasses['coinhub-loot-box']} */ ;
    /** @type {__VLS_StyleScopedClasses['coinhub-case']} */ ;
    /** @type {__VLS_StyleScopedClasses['ch-ds-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['ch-ds-card--interactive']} */ ;
    /** @type {__VLS_StyleScopedClasses['group']} */ ;
    /** @type {__VLS_StyleScopedClasses['relative']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-[10.5rem]']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[20px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus-visible:outline']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus-visible:outline-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus-visible:outline-offset-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus-visible:outline-violet-500/50']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        ...{ class: "coinhub-loot__shine pointer-events-none absolute inset-0 z-[1] opacity-0 transition-opacity duration-300 group-hover:opacity-100" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-loot__shine']} */ ;
    /** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
    /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
    /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-[1]']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-opacity']} */ ;
    /** @type {__VLS_StyleScopedClasses['duration-300']} */ ;
    /** @type {__VLS_StyleScopedClasses['group-hover:opacity-100']} */ ;
    if (__VLS_ctx.isLegendary) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "coinhub-loot__sparks pointer-events-none absolute inset-0 z-[4]" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['coinhub-loot__sparks']} */ ;
        /** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
        /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
        /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['z-[4]']} */ ;
        for (const [k] of __VLS_vFor((4))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                key: (k),
                ...{ class: "coinhub-loot__spark" },
                ...{ style: ({
                        '--ch-sp': `${0.1 + (k * 0.11) % 0.8}s`,
                        '--ch-sx': `${(k * 47) % 90}%`,
                        '--ch-sy': `${(k * 23) % 70}%`,
                    }) },
            });
            /** @type {__VLS_StyleScopedClasses['coinhub-loot__spark']} */ ;
            // @ts-ignore
            [state, onSelectClick, rarityKey, isLegendary, isLegendary, isLegendary, isLegendary, isRemoteBusy, isRemoteBusy, isRemoteBusy, displayTitle,];
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "coinhub-loot__lid relative z-[2] h-[42%] min-h-[4.25rem] border-b" },
        ...{ class: (`coinhub-loot__lid--${__VLS_ctx.rarityKey}`) },
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-loot__lid']} */ ;
    /** @type {__VLS_StyleScopedClasses['relative']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-[2]']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-[42%]']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-[4.25rem]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "coinhub-loot__lid-gloss pointer-events-none absolute inset-0" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-loot__lid-gloss']} */ ;
    /** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
    /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
    /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "coinhub-loot__sweep pointer-events-none absolute inset-0 -translate-x-full opacity-0 group-hover:translate-x-full group-hover:opacity-100" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-loot__sweep']} */ ;
    /** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
    /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
    /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['-translate-x-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['group-hover:translate-x-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['group-hover:opacity-100']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "coinhub-loot__sigil flex h-full items-center justify-center pt-0.5" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-loot__sigil']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['pt-0.5']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: ([
                'coinhub-case-icon-sigil flex h-14 w-14 items-center justify-center rounded-xl text-xl',
                __VLS_ctx.isLegendary && 'coinhub-loot--legendary-sigil h-16 w-16 sm:text-2xl',
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-case-icon-sigil']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-14']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-14']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "coinhub-loot__body relative z-[2] flex min-h-0 flex-1 flex-col gap-2.5 px-4 pb-4 pt-3 sm:px-5" },
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-loot__body']} */ ;
    /** @type {__VLS_StyleScopedClasses['relative']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-[2]']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['pb-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['pt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:px-5']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-center text-sm font-bold leading-tight text-[#FFFFFF]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['leading-tight']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[#FFFFFF]']} */ ;
    (__VLS_ctx.displayTitle);
    if (__VLS_ctx.priceLabel) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-center text-[0.7rem] font-semibold tabular-nums text-[#FBBF24]" },
        });
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[0.7rem]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[#FBBF24]']} */ ;
        (__VLS_ctx.priceLabel);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-auto flex min-h-[2.5rem] flex-1 flex-col justify-end" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-auto']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-[2.5rem]']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: ([
                'coinhub-case-cta w-full rounded-lg border py-2.5 text-center text-sm font-bold',
                __VLS_ctx.isLegendary ? 'ch-ds-btn-gold py-3 text-base font-extrabold' : 'ch-ds-btn-purple',
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-case-cta']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    (__VLS_ctx.actionLabel);
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: ([
                'coinhub-loot coinhub-loot-box coinhub-loot--inactive ch-ds-card ch-ds-card--alt flex min-h-[10.5rem] flex-col overflow-hidden rounded-[20px] border-0 p-0',
                __VLS_ctx.state === 'locked' && 'coinhub-loot--locked',
                __VLS_ctx.state === 'cooldown' && 'coinhub-loot--cd',
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-loot']} */ ;
    /** @type {__VLS_StyleScopedClasses['coinhub-loot-box']} */ ;
    /** @type {__VLS_StyleScopedClasses['coinhub-loot--inactive']} */ ;
    /** @type {__VLS_StyleScopedClasses['ch-ds-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['ch-ds-card--alt']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-[10.5rem]']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[20px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "coinhub-loot__lid--muted relative h-[40%] min-h-[3.75rem] border-b border-[rgba(255,255,255,0.06)] bg-[rgba(15,18,32,0.5)]" },
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-loot__lid--muted']} */ ;
    /** @type {__VLS_StyleScopedClasses['relative']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-[40%]']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-[3.75rem]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[rgba(255,255,255,0.06)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[rgba(15,18,32,0.5)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex h-full items-center justify-center opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex h-12 w-12 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(11,14,23,0.9)] text-lg text-[#6B7280] shadow-[inset_0_2px_6px_rgba(0,0,0,0.55)]" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-12']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-12']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[rgba(255,255,255,0.08)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[rgba(11,14,23,0.9)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[#6B7280]']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-[inset_0_2px_6px_rgba(0,0,0,0.55)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: ([
                'flex flex-1 flex-col gap-3 px-5 pb-5 pt-4',
                __VLS_ctx.state === 'locked' && 'coinhub-loot-body--locked',
                __VLS_ctx.state === 'cooldown' && 'coinhub-loot-body--cd',
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['pb-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: ([
                'text-center text-sm font-semibold',
                __VLS_ctx.state === 'locked' ? 'text-[#6B7280]' : 'text-[#9CA3AF]',
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.displayTitle);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-auto flex flex-1 flex-col justify-end" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-auto']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
    if (__VLS_ctx.state === 'locked') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(11,14,23,0.6)] py-2.5 text-center text-sm font-medium text-[#6B7280]" },
        });
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[rgba(255,255,255,0.06)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[rgba(11,14,23,0.6)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[#6B7280]']} */ ;
        (__VLS_ctx.stateLabelLocked);
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(11,14,23,0.5)] py-2.5 text-center text-sm text-[#9CA3AF]" },
        });
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[rgba(255,255,255,0.06)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[rgba(11,14,23,0.5)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[#9CA3AF]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "block font-medium text-[#9CA3AF]" },
        });
        /** @type {__VLS_StyleScopedClasses['block']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[#9CA3AF]']} */ ;
        (__VLS_ctx.stateLabelCooldown);
        if (__VLS_ctx.detailLabel) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "coinhub-case-timer mt-1 block font-semibold tabular-nums text-sm text-[#FBBF24]" },
            });
            /** @type {__VLS_StyleScopedClasses['coinhub-case-timer']} */ ;
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['block']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[#FBBF24]']} */ ;
            (__VLS_ctx.detailLabel);
        }
    }
}
// @ts-ignore
[state, state, state, state, state, state, rarityKey, isLegendary, isLegendary, displayTitle, displayTitle, priceLabel, priceLabel, actionLabel, stateLabelLocked, stateLabelCooldown, detailLabel, detailLabel,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
