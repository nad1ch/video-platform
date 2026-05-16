/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
/**
 * GameSpeakingQueueBar — shared speaking-queue HUD for game-call pages.
 *
 * Extracted from `MafiaSpeakingQueueBar.vue` in Phase 5b so production Mafia
 * and the Game Template render the same HUD. The component is presentational:
 *
 *   - state arrives via props (`segments`, `speakingActive`, `showTools`)
 *   - actions leave via emits (`toggle-speaking-mode`, `remove-pair`, `clear-all`)
 *   - all locale strings arrive via the `labels` prop
 *
 * Hard isolation: NO Mafia store / composable / signaling / i18n key imports.
 * Asset paths live under the neutral `@/assets/game-call/` folder; the
 * SVG bytes are namespace-neutral and shared with Mafia / Game Template /
 * Eat First via the same component.
 *
 * CSS class names preserved as `.mafia-vote-hud*`. **This is intentional**:
 * `apps/client/src/components/call/CallPage.css` carries cross-component
 * `:deep()` rules that target these names from the stream-view + mobile
 * layout contexts (e.g. `.call-page__mafia-view-bottom :deep(.mafia-vote-hud)`).
 * Renaming the namespace would require touching `CallPage.css`, which the
 * Phase 5b constraints rule out. The component is still architecturally
 * generic — only the CSS *selector* carries the legacy "vote" name.
 */
import { computed } from 'vue';
import mafiaVoteClear from '@/assets/game-call/vote-clear.svg';
import mafiaVoteStart from '@/assets/game-call/vote-start.svg';
const props = withDefaults(defineProps(), {
    speakingActive: false,
    showTools: false,
});
const emit = defineEmits();
/** Mafia uses `mafiaGameSeatText(seat) = String(seat)` — inlined here. */
function seatText(seat) {
    return String(seat);
}
const decoratedSegments = computed(() => props.segments.map((seg) => ({
    id: `pair-${seg.pairIndex}`,
    pairIndex: seg.pairIndex,
    byLabel: seg.bySeat == null ? '?' : seatText(seg.bySeat),
    targetLabel: seatText(seg.targetSeat),
})));
const readOnly = computed(() => !props.showTools);
const hudWidth = computed(() => {
    const n = decoratedSegments.value.length;
    if (readOnly.value) {
        return n === 0 ? 0 : Math.min(451, 14 + n * 22 + Math.max(0, n - 1) * 6);
    }
    if (n === 0) {
        return 104;
    }
    return Math.min(451, 104 + 8 + n * 22 + Math.max(0, n - 1) * 6);
});
const canClearSpeakingQueue = computed(() => {
    if (readOnly.value)
        return false;
    return props.segments.length > 0;
});
function chipTitle(byLabel, targetLabel) {
    return readOnly.value
        ? props.labels.chipViewOnlyTitle(byLabel, targetLabel)
        : props.labels.chipRemoveTitle(byLabel, targetLabel);
}
function onSpeakingModeClick(ev) {
    ev.stopPropagation();
    if (readOnly.value)
        return;
    emit('toggle-speaking-mode');
}
function onRemove(pairIndex, ev) {
    ev.stopPropagation();
    if (readOnly.value)
        return;
    emit('remove-pair', pairIndex);
}
function onClearAll(ev) {
    ev.stopPropagation();
    if (readOnly.value || !canClearSpeakingQueue.value)
        return;
    emit('clear-all');
}
const __VLS_defaults = {
    speakingActive: false,
    showTools: false,
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
/** @type {__VLS_StyleScopedClasses['mafia-vote-hud__tool']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-vote-hud__tool']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-vote-hud__chip']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-vote-hud__chip']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-vote-hud__tool']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-vote-hud__chip']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-vote-hud__tool']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-vote-hud__chip']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-vote-hud__tool']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-vote-hud__tool']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-vote-hud__tool-art']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-vote-hud__chips']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-vote-hud__chip']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-vote-hud__chip-voter']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-vote-hud__chip-arrow']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-vote-hud__chip-target']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-vote-hud']} */ ;
if (!__VLS_ctx.readOnly || __VLS_ctx.decoratedSegments.length > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mafia-vote-hud" },
        ...{ class: ({
                'mafia-vote-hud--empty': __VLS_ctx.decoratedSegments.length === 0,
                'mafia-vote-hud--readonly': __VLS_ctx.readOnly,
            }) },
        ...{ style: ({ '--mafia-vote-hud-width': `${__VLS_ctx.hudWidth}px` }) },
        role: "region",
        'aria-label': (__VLS_ctx.labels.containerAria),
    });
    /** @type {__VLS_StyleScopedClasses['mafia-vote-hud']} */ ;
    /** @type {__VLS_StyleScopedClasses['mafia-vote-hud--empty']} */ ;
    /** @type {__VLS_StyleScopedClasses['mafia-vote-hud--readonly']} */ ;
    if (!__VLS_ctx.readOnly) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mafia-vote-hud__tools" },
            role: "toolbar",
            'aria-label': (__VLS_ctx.labels.toolbarAria),
        });
        /** @type {__VLS_StyleScopedClasses['mafia-vote-hud__tools']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.onSpeakingModeClick) },
            type: "button",
            ...{ class: "mafia-vote-hud__tool mafia-vote-hud__tool--start" },
            ...{ class: ({ 'mafia-vote-hud__tool--on': __VLS_ctx.speakingActive }) },
            disabled: (__VLS_ctx.readOnly),
            title: (__VLS_ctx.labels.speakingModeTitle),
            'aria-pressed': (__VLS_ctx.speakingActive),
            'aria-label': (__VLS_ctx.labels.speakingModeAria),
        });
        /** @type {__VLS_StyleScopedClasses['mafia-vote-hud__tool']} */ ;
        /** @type {__VLS_StyleScopedClasses['mafia-vote-hud__tool--start']} */ ;
        /** @type {__VLS_StyleScopedClasses['mafia-vote-hud__tool--on']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
            ...{ class: "mafia-vote-hud__tool-art" },
            src: (__VLS_ctx.mafiaVoteStart),
            alt: "",
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['mafia-vote-hud__tool-art']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.onClearAll) },
            type: "button",
            ...{ class: "mafia-vote-hud__tool mafia-vote-hud__tool--clear" },
            disabled: (__VLS_ctx.readOnly || !__VLS_ctx.canClearSpeakingQueue),
            title: (__VLS_ctx.labels.clearAllTitle),
            'aria-label': (__VLS_ctx.labels.clearAllTitle),
        });
        /** @type {__VLS_StyleScopedClasses['mafia-vote-hud__tool']} */ ;
        /** @type {__VLS_StyleScopedClasses['mafia-vote-hud__tool--clear']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
            ...{ class: "mafia-vote-hud__tool-art" },
            src: (__VLS_ctx.mafiaVoteClear),
            alt: "",
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['mafia-vote-hud__tool-art']} */ ;
    }
    if (__VLS_ctx.decoratedSegments.length > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mafia-vote-hud__chips" },
            role: "status",
        });
        /** @type {__VLS_StyleScopedClasses['mafia-vote-hud__chips']} */ ;
        let __VLS_0;
        /** @ts-ignore @type { | typeof __VLS_components.TransitionGroup | typeof __VLS_components.TransitionGroup} */
        TransitionGroup;
        // @ts-ignore
        const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
            name: "mafia-vote-chip",
        }));
        const __VLS_2 = __VLS_1({
            name: "mafia-vote-chip",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        const { default: __VLS_5 } = __VLS_3.slots;
        for (const [seg] of __VLS_vFor((__VLS_ctx.decoratedSegments))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(!__VLS_ctx.readOnly || __VLS_ctx.decoratedSegments.length > 0))
                            return;
                        if (!(__VLS_ctx.decoratedSegments.length > 0))
                            return;
                        __VLS_ctx.onRemove(seg.pairIndex, $event);
                        // @ts-ignore
                        [readOnly, readOnly, readOnly, readOnly, readOnly, decoratedSegments, decoratedSegments, decoratedSegments, decoratedSegments, hudWidth, labels, labels, labels, labels, labels, labels, onSpeakingModeClick, speakingActive, speakingActive, mafiaVoteStart, onClearAll, canClearSpeakingQueue, mafiaVoteClear, onRemove,];
                    } },
                key: (seg.id),
                type: "button",
                ...{ class: "mafia-vote-hud__chip" },
                disabled: (__VLS_ctx.readOnly),
                title: (__VLS_ctx.chipTitle(seg.byLabel, seg.targetLabel)),
                'aria-label': (__VLS_ctx.chipTitle(seg.byLabel, seg.targetLabel)),
            });
            /** @type {__VLS_StyleScopedClasses['mafia-vote-hud__chip']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "mafia-vote-hud__chip-voter" },
            });
            /** @type {__VLS_StyleScopedClasses['mafia-vote-hud__chip-voter']} */ ;
            (seg.byLabel);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "mafia-vote-hud__chip-arrow" },
                'aria-hidden': "true",
            });
            /** @type {__VLS_StyleScopedClasses['mafia-vote-hud__chip-arrow']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "mafia-vote-hud__chip-target" },
            });
            /** @type {__VLS_StyleScopedClasses['mafia-vote-hud__chip-target']} */ ;
            (seg.targetLabel);
            // @ts-ignore
            [readOnly, chipTitle, chipTitle,];
        }
        // @ts-ignore
        [];
        var __VLS_3;
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
