/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { createLogger } from '@/utils/logger';
import { useEatFirstCallShellStore } from '@/stores/eatFirstCallShell';
const log = createLogger('eat-first:call-host-panel');
const props = withDefaults(defineProps(), {
    timerStartedAt: '',
    timerSpeakingTotalSec: null,
    timerPaused: false,
    timerFrozenRemainingSec: null,
});
const { t } = useI18n();
const eatFirstShell = useEatFirstCallShellStore();
const { lastUsedActionCard } = storeToRefs(eatFirstShell);
const TRAIT_KEYS = [
    'gender',
    'age',
    'profession',
    'health',
    'hobby',
    'phobia',
    'fact',
    'baggage',
];
const EAT_FIRST_HOST_ACTION_EVENT = 'streamassist:eat-first:host-action';
function dispatchHostAction(detail) {
    if (typeof window === 'undefined')
        return;
    if (import.meta.env.DEV) {
        log.info('[eat-first:host-action:dispatch]', detail);
    }
    const ev = new CustomEvent(EAT_FIRST_HOST_ACTION_EVENT, { detail });
    window.dispatchEvent(ev);
}
const tableMutationPending = ref(false);
let tableMutationUnlockTimer = null;
function armTableMutationCooldown() {
    tableMutationPending.value = true;
    if (tableMutationUnlockTimer != null) {
        clearTimeout(tableMutationUnlockTimer);
        tableMutationUnlockTimer = null;
    }
    tableMutationUnlockTimer = window.setTimeout(() => {
        tableMutationPending.value = false;
        tableMutationUnlockTimer = null;
    }, 750);
}
function rerollTraitForAll(traitKey) {
    if (tableMutationPending.value)
        return;
    armTableMutationCooldown();
    dispatchHostAction({ action: 'trait-type-reroll-all', traitKey });
}
function rerollAllActionCards() {
    if (tableMutationPending.value)
        return;
    armTableMutationCooldown();
    dispatchHostAction({ action: 'action-card-reroll', slotId: '*' });
}
const lastUsedSlot = computed(() => {
    const card = lastUsedActionCard.value;
    if (!card || typeof card !== 'object')
        return '';
    const slot = typeof card.slotId === 'string' ? card.slotId.trim() : '';
    return slot;
});
const lastUsedTitle = computed(() => {
    const card = lastUsedActionCard.value;
    if (!card || typeof card !== 'object')
        return '';
    return typeof card.title === 'string' ? card.title.trim() : '';
});
const lastUsedDescription = computed(() => {
    const card = lastUsedActionCard.value;
    if (!card || typeof card !== 'object')
        return '';
    return typeof card.description === 'string' ? card.description.trim() : '';
});
const hasLastUsedCard = computed(() => lastUsedTitle.value.length > 0);
function traitButtonLabel(key) {
    return t(`eatFirstCall.traitLabels.${key}`);
}
const MIN_W = 320;
const MARGIN = 8;
const DEFAULT_LEFT_INSET = 70;
const DEFAULT_BOTTOM_INSET = 25;
/** Fallback before first layout / ref measure (panel sizes to content, not this height). */
const PANEL_HEIGHT_FALLBACK = 320;
const PANEL_Z = 38;
const panelElRef = ref(null);
const collapsed = ref(false);
const pos = ref({ x: DEFAULT_LEFT_INSET, y: 400 });
const savedPos = ref(null);
const tabAnchorY = ref(200);
const collapsedSide = ref('left');
const dragging = ref(false);
const dragOrigin = ref({ cx: 0, cy: 0, x: 0, y: 0 });
let dragListenersAttached = false;
const panelStyle = computed(() => {
    if (collapsed.value)
        return {};
    return {
        left: `${pos.value.x}px`,
        top: `${pos.value.y}px`,
        width: `${MIN_W}px`,
        zIndex: PANEL_Z,
    };
});
function panelHeightForClamp() {
    const el = panelElRef.value;
    const h = el?.getBoundingClientRect().height;
    return typeof h === 'number' && h > 0 ? h : PANEL_HEIGHT_FALLBACK;
}
const tabStyle = computed(() => ({
    top: `${tabAnchorY.value}px`,
    [collapsedSide.value]: '0',
    zIndex: PANEL_Z,
}));
const panelCollapseSide = computed(() => {
    if (typeof window === 'undefined')
        return 'left';
    return pos.value.x + MIN_W * 0.5 < window.innerWidth * 0.5 ? 'left' : 'right';
});
const collapseArrowPath = computed(() => panelCollapseSide.value === 'left'
    ? 'M14.5 7L9.5 12l5 5M10 12h8'
    : 'M9.5 7l5 5-5 5M6 12h8');
function clampPos() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const ph = panelHeightForClamp();
    pos.value.x = Math.min(Math.max(MARGIN, pos.value.x), vw - MIN_W - MARGIN);
    pos.value.y = Math.min(Math.max(MARGIN, pos.value.y), vh - ph - MARGIN);
}
function placeDefault() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const ph = panelHeightForClamp();
    pos.value = {
        x: Math.max(MARGIN, Math.min(DEFAULT_LEFT_INSET, vw - MIN_W - MARGIN)),
        y: Math.max(MARGIN, vh - ph - DEFAULT_BOTTOM_INSET),
    };
}
function onWindowResize() {
    clampPos();
    const ph = panelHeightForClamp();
    tabAnchorY.value = Math.max(MARGIN, Math.min(pos.value.y + ph * 0.5, window.innerHeight - MARGIN));
}
function endDrag() {
    if (!dragListenersAttached)
        return;
    dragListenersAttached = false;
    document.removeEventListener('pointermove', onPointerMoveDrag, true);
    document.removeEventListener('pointerup', onPointerUpDrag, true);
    document.removeEventListener('pointercancel', onPointerUpDrag, true);
    dragging.value = false;
}
function onPointerMoveDrag(ev) {
    if (!dragging.value)
        return;
    ev.preventDefault();
    pos.value = {
        x: dragOrigin.value.x + (ev.clientX - dragOrigin.value.cx),
        y: dragOrigin.value.y + (ev.clientY - dragOrigin.value.cy),
    };
    clampPos();
}
function onPointerUpDrag() {
    endDrag();
}
function onHeadPointerDown(ev) {
    if (ev.button !== 0)
        return;
    if (ev.target instanceof Element && ev.target.closest('button, a, input, [data-no-drag]'))
        return;
    ev.preventDefault();
    dragging.value = true;
    dragOrigin.value = { cx: ev.clientX, cy: ev.clientY, x: pos.value.x, y: pos.value.y };
    if (!dragListenersAttached) {
        dragListenersAttached = true;
        document.addEventListener('pointermove', onPointerMoveDrag, { capture: true, passive: false });
        document.addEventListener('pointerup', onPointerUpDrag, { capture: true });
        document.addEventListener('pointercancel', onPointerUpDrag, { capture: true });
    }
}
function collapsePanel() {
    collapsedSide.value = panelCollapseSide.value;
    savedPos.value = { ...pos.value };
    const ph = panelHeightForClamp();
    tabAnchorY.value = Math.max(MARGIN + 20, Math.min(pos.value.y + ph * 0.45, window.innerHeight - MARGIN - 20));
    endDrag();
    collapsed.value = true;
}
function expandPanel() {
    collapsed.value = false;
    if (savedPos.value != null) {
        pos.value = { ...savedPos.value };
    }
    else {
        placeDefault();
    }
    void nextTick(() => {
        requestAnimationFrame(() => clampPos());
    });
}
onMounted(() => {
    void nextTick(() => {
        requestAnimationFrame(() => {
            placeDefault();
            clampPos();
        });
    });
    window.addEventListener('resize', onWindowResize, { passive: true });
});
onBeforeUnmount(() => {
    window.removeEventListener('resize', onWindowResize);
    endDrag();
    if (tableMutationUnlockTimer != null) {
        clearTimeout(tableMutationUnlockTimer);
        tableMutationUnlockTimer = null;
    }
});
const __VLS_defaults = {
    timerStartedAt: '',
    timerSpeakingTotalSec: null,
    timerPaused: false,
    timerFrozenRemainingSec: null,
};
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['ef-host-panel__head']} */ ;
/** @type {__VLS_StyleScopedClasses['ef-host-panel__head-btn--collapse']} */ ;
/** @type {__VLS_StyleScopedClasses['ef-host-panel__section--secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['ef-host-panel__trait-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['ef-host-panel__trait-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['ef-host-panel__trait-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['ef-host-panel__action-card-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['ef-host-panel__action-card-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['ef-host-panel__action-card-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['ef-host-panel__phase-row']} */ ;
/** @type {__VLS_StyleScopedClasses['ef-host-panel__phase-col--on']} */ ;
/** @type {__VLS_StyleScopedClasses['ef-host-panel__phase-bar']} */ ;
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
if (__VLS_ctx.collapsed) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.expandPanel) },
        type: "button",
        ...{ class: "ef-host-panel__edge-tab sa-chip-btn sa-chip-btn--on ef-host-panel__edge-tab--pulse" },
        ...{ class: ({
                'ef-host-panel__edge-tab--left': __VLS_ctx.collapsedSide === 'left',
                'ef-host-panel__edge-tab--right': __VLS_ctx.collapsedSide === 'right',
            }) },
        ...{ style: (__VLS_ctx.tabStyle) },
        'aria-label': (__VLS_ctx.t('eatFirstCall.hostPanelOpen')),
        title: (__VLS_ctx.t('eatFirstCall.hostPanelOpen')),
    });
    /** @type {__VLS_StyleScopedClasses['ef-host-panel__edge-tab']} */ ;
    /** @type {__VLS_StyleScopedClasses['sa-chip-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['sa-chip-btn--on']} */ ;
    /** @type {__VLS_StyleScopedClasses['ef-host-panel__edge-tab--pulse']} */ ;
    /** @type {__VLS_StyleScopedClasses['ef-host-panel__edge-tab--left']} */ ;
    /** @type {__VLS_StyleScopedClasses['ef-host-panel__edge-tab--right']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ef-host-panel__edge-ico" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['ef-host-panel__edge-ico']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
        ref: "panelElRef",
        ...{ class: "ef-host-panel ef-host-panel__shell" },
        ...{ style: (__VLS_ctx.panelStyle) },
        'aria-label': (__VLS_ctx.t('eatFirstCall.mafiaStyleHostPanelAria')),
    });
    /** @type {__VLS_StyleScopedClasses['ef-host-panel']} */ ;
    /** @type {__VLS_StyleScopedClasses['ef-host-panel__shell']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
        ...{ onPointerdown: (__VLS_ctx.onHeadPointerDown) },
        ...{ class: "ef-host-panel__head" },
    });
    /** @type {__VLS_StyleScopedClasses['ef-host-panel__head']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        ...{ class: "ef-host-panel__title" },
    });
    /** @type {__VLS_StyleScopedClasses['ef-host-panel__title']} */ ;
    (__VLS_ctx.t('eatFirstCall.leadTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ef-host-panel__head-actions" },
        'data-no-drag': true,
    });
    /** @type {__VLS_StyleScopedClasses['ef-host-panel__head-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.collapsePanel) },
        type: "button",
        ...{ class: "sa-chip-btn ef-host-panel__head-btn ef-host-panel__head-btn--collapse" },
        'aria-label': (__VLS_ctx.t('eatFirstCall.hostPanelCollapse')),
        title: (__VLS_ctx.t('eatFirstCall.hostPanelCollapse')),
    });
    /** @type {__VLS_StyleScopedClasses['sa-chip-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['ef-host-panel__head-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['ef-host-panel__head-btn--collapse']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        viewBox: "0 0 24 24",
        width: "16",
        height: "16",
        fill: "none",
        'aria-hidden': "true",
        focusable: "false",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: (__VLS_ctx.collapseArrowPath),
        stroke: "currentColor",
        'stroke-width': "2.25",
        'stroke-linecap': "round",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ef-host-panel__scroller" },
    });
    /** @type {__VLS_StyleScopedClasses['ef-host-panel__scroller']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "ef-host-panel__section" },
        'aria-label': (__VLS_ctx.t('eatFirstCall.hostLastCardSectionTitle')),
    });
    /** @type {__VLS_StyleScopedClasses['ef-host-panel__section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "ef-host-panel__section-title" },
    });
    /** @type {__VLS_StyleScopedClasses['ef-host-panel__section-title']} */ ;
    (__VLS_ctx.t('eatFirstCall.hostLastCardSectionTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ef-host-panel__last-card" },
    });
    /** @type {__VLS_StyleScopedClasses['ef-host-panel__last-card']} */ ;
    if (__VLS_ctx.hasLastUsedCard) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "ef-host-panel__last-card-head" },
        });
        /** @type {__VLS_StyleScopedClasses['ef-host-panel__last-card-head']} */ ;
        if (__VLS_ctx.lastUsedSlot.length > 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "ef-host-panel__last-slot" },
            });
            /** @type {__VLS_StyleScopedClasses['ef-host-panel__last-slot']} */ ;
            (__VLS_ctx.lastUsedSlot.toUpperCase());
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ef-host-panel__last-title" },
        });
        /** @type {__VLS_StyleScopedClasses['ef-host-panel__last-title']} */ ;
        (__VLS_ctx.lastUsedTitle);
        if (__VLS_ctx.lastUsedDescription.length > 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "ef-host-panel__last-desc" },
            });
            /** @type {__VLS_StyleScopedClasses['ef-host-panel__last-desc']} */ ;
            (__VLS_ctx.lastUsedDescription);
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ef-host-panel__last-card-empty" },
        });
        /** @type {__VLS_StyleScopedClasses['ef-host-panel__last-card-empty']} */ ;
        (__VLS_ctx.t('eatFirstCall.hostLastCardEmpty'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "ef-host-panel__section" },
        'aria-label': (__VLS_ctx.t('eatFirstCall.hostTraitRerollSectionTitle')),
    });
    /** @type {__VLS_StyleScopedClasses['ef-host-panel__section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "ef-host-panel__section-title" },
    });
    /** @type {__VLS_StyleScopedClasses['ef-host-panel__section-title']} */ ;
    (__VLS_ctx.t('eatFirstCall.hostTraitRerollSectionTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ef-host-panel__trait-grid" },
    });
    /** @type {__VLS_StyleScopedClasses['ef-host-panel__trait-grid']} */ ;
    for (const [key] of __VLS_vFor((__VLS_ctx.TRAIT_KEYS))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.collapsed))
                        return;
                    __VLS_ctx.rerollTraitForAll(key);
                    // @ts-ignore
                    [collapsed, expandPanel, collapsedSide, collapsedSide, tabStyle, t, t, t, t, t, t, t, t, t, t, t, panelStyle, onHeadPointerDown, collapsePanel, collapseArrowPath, hasLastUsedCard, lastUsedSlot, lastUsedSlot, lastUsedTitle, lastUsedDescription, lastUsedDescription, TRAIT_KEYS, rerollTraitForAll,];
                } },
            key: (`reroll-${key}`),
            type: "button",
            ...{ class: "ef-host-panel__trait-btn" },
            disabled: (__VLS_ctx.tableMutationPending),
            title: (__VLS_ctx.t('eatFirstCall.hostTraitRerollButtonHint', { trait: __VLS_ctx.traitButtonLabel(key) })),
            'aria-label': (__VLS_ctx.t('eatFirstCall.hostTraitRerollButtonHint', { trait: __VLS_ctx.traitButtonLabel(key) })),
        });
        /** @type {__VLS_StyleScopedClasses['ef-host-panel__trait-btn']} */ ;
        (__VLS_ctx.traitButtonLabel(key));
        // @ts-ignore
        [t, t, tableMutationPending, traitButtonLabel, traitButtonLabel, traitButtonLabel,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "ef-host-panel__section" },
        'aria-label': (__VLS_ctx.t('eatFirstCall.hostActionCardsSectionTitle')),
    });
    /** @type {__VLS_StyleScopedClasses['ef-host-panel__section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "ef-host-panel__section-title" },
    });
    /** @type {__VLS_StyleScopedClasses['ef-host-panel__section-title']} */ ;
    (__VLS_ctx.t('eatFirstCall.hostActionCardsSectionTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.rerollAllActionCards) },
        type: "button",
        ...{ class: "ef-host-panel__action-card-btn" },
        title: (__VLS_ctx.t('eatFirstCall.hostRerollAllActionCardsHint')),
        'aria-label': (__VLS_ctx.t('eatFirstCall.hostRerollAllActionCardsHint')),
        disabled: (__VLS_ctx.tableMutationPending),
    });
    /** @type {__VLS_StyleScopedClasses['ef-host-panel__action-card-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        viewBox: "0 0 24 24",
        width: "14",
        height: "14",
        fill: "none",
        'aria-hidden': "true",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
        x: "4",
        y: "4",
        width: "16",
        height: "16",
        rx: "3",
        stroke: "currentColor",
        'stroke-width': "1.8",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "9",
        cy: "9",
        r: "1.3",
        fill: "currentColor",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "15",
        cy: "9",
        r: "1.3",
        fill: "currentColor",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "12",
        cy: "12",
        r: "1.3",
        fill: "currentColor",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "9",
        cy: "15",
        r: "1.3",
        fill: "currentColor",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "15",
        cy: "15",
        r: "1.3",
        fill: "currentColor",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.t('eatFirstCall.hostRerollAllActionCards'));
}
// @ts-ignore
[t, t, t, t, t, tableMutationPending, rerollAllActionCards,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
