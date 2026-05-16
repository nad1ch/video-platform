/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import CoinHubStripRoll from '@/components/coinhub/CoinHubStripRoll.vue';
import '@/styles/coinhub-design-system.css';
import { buildCaseStripCells } from '@/utils/coinHub/coinHubStripMath';
const props = withDefaults(defineProps(), { rewardLine: null });
const emit = defineEmits();
const { t } = useI18n();
const step = ref('hold');
const rollKey = ref(0);
const cells = ref(['—']);
const land = ref(0);
const canDismiss = ref(false);
function close() {
    if (props.resolving) {
        return;
    }
    if (step.value === 'roll' && !canDismiss.value) {
        return;
    }
    emit('update:open', false);
    emit('close');
    step.value = 'hold';
    canDismiss.value = false;
    rollKey.value = 0;
    cells.value = ['—'];
    land.value = 0;
}
function onDocKey(e) {
    if (e.key !== 'Escape' || !props.open) {
        return;
    }
    if (props.resolving) {
        return;
    }
    if (step.value === 'roll' && !canDismiss.value) {
        return;
    }
    e.preventDefault();
    close();
}
onMounted(() => document.addEventListener('keydown', onDocKey));
onUnmounted(() => document.removeEventListener('keydown', onDocKey));
watch(() => props.open, (o) => {
    if (o) {
        return;
    }
    step.value = 'hold';
    canDismiss.value = false;
    rollKey.value = 0;
    cells.value = ['—'];
    land.value = 0;
});
watch(() => [props.open, props.resolving, props.rewardLine], () => {
    if (!props.open) {
        return;
    }
    if (props.resolving) {
        step.value = 'hold';
        canDismiss.value = false;
        return;
    }
    if (props.rewardLine) {
        const b = buildCaseStripCells(props.rewardLine);
        rollKey.value += 1;
        cells.value = b.cells;
        land.value = b.landIndex;
        step.value = 'roll';
    }
}, { flush: 'post' });
function onStripDone() {
    if (step.value === 'roll') {
        step.value = 'done';
        canDismiss.value = true;
    }
}
function onBackdropClick() {
    if (canDismiss.value) {
        close();
    }
}
const __VLS_defaults = { rewardLine: null };
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
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    to: "body",
}));
const __VLS_2 = __VLS_1({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "coinhub-case-modal fixed inset-0 z-[200] flex items-center justify-center p-4" },
    role: "presentation",
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.open) }, null, null);
/** @type {__VLS_StyleScopedClasses['coinhub-case-modal']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-[200]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ onClick: (__VLS_ctx.onBackdropClick) },
    ...{ class: "absolute inset-0 bg-[#0B0E17]/90 backdrop-blur-md" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[#0B0E17]/90']} */ ;
/** @type {__VLS_StyleScopedClasses['backdrop-blur-md']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onClick: () => { } },
    ...{ class: "coinhub-case-modal__panel ch-ds-card relative z-10 flex w-full max-w-lg flex-col gap-4 rounded-[20px] border-0 p-5 sm:p-7" },
    role: "dialog",
    'aria-modal': "true",
    'aria-label': (__VLS_ctx.title),
});
/** @type {__VLS_StyleScopedClasses['coinhub-case-modal__panel']} */ ;
/** @type {__VLS_StyleScopedClasses['ch-ds-card']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[20px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border-0']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:p-7']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "ch-ds-text-section text-center" },
});
/** @type {__VLS_StyleScopedClasses['ch-ds-text-section']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
(__VLS_ctx.title);
if (__VLS_ctx.resolving) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex min-h-[8rem] flex-col items-center justify-center gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-[8rem]']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        ...{ class: "h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-300" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-violet-500/30']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-t-violet-300']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "ch-ds-text-muted text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['ch-ds-text-muted']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    (__VLS_ctx.t('coinHub.caseOpening'));
}
else if (__VLS_ctx.rewardLine) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    const __VLS_6 = CoinHubStripRoll;
    // @ts-ignore
    const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
        ...{ 'onComplete': {} },
        key: (`case-roll-${__VLS_ctx.rollKey}`),
        cells: (__VLS_ctx.cells),
        landIndex: (__VLS_ctx.land),
        durationMs: (2800),
        itemWidthPx: (80),
    }));
    const __VLS_8 = __VLS_7({
        ...{ 'onComplete': {} },
        key: (`case-roll-${__VLS_ctx.rollKey}`),
        cells: (__VLS_ctx.cells),
        landIndex: (__VLS_ctx.land),
        durationMs: (2800),
        itemWidthPx: (80),
    }, ...__VLS_functionalComponentArgsRest(__VLS_7));
    let __VLS_11;
    const __VLS_12 = ({ complete: {} },
        { onComplete: (__VLS_ctx.onStripDone) });
    var __VLS_9;
    var __VLS_10;
    if (__VLS_ctx.step === 'done' && __VLS_ctx.rewardLine) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "coinhub-open-reward mt-3 text-center text-sm font-bold tabular-nums text-[#FEF3C7]" },
        });
        /** @type {__VLS_StyleScopedClasses['coinhub-open-reward']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
        /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[#FEF3C7]']} */ ;
        (__VLS_ctx.rewardLine);
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "min-h-[5rem]" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['min-h-[5rem]']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex justify-center" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
if (!__VLS_ctx.resolving && __VLS_ctx.rewardLine) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.close) },
        type: "button",
        ...{ class: "ch-ds-btn-purple rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50" },
        disabled: (!__VLS_ctx.canDismiss),
    });
    /** @type {__VLS_StyleScopedClasses['ch-ds-btn-purple']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
    /** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
    (__VLS_ctx.t('coinHub.continue'));
}
// @ts-ignore
[open, onBackdropClick, title, title, resolving, resolving, t, t, rewardLine, rewardLine, rewardLine, rewardLine, rollKey, cells, land, onStripDone, step, close, canDismiss,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
