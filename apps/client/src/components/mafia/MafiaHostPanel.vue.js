/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { storeToRefs } from 'pinia';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMafiaGameStore } from '@/stores/mafiaGame';
import { useMafiaPlayersStore } from '@/stores/mafiaPlayers';
import { mafiaGameSeatText } from '@/utils/mafiaSeatLabel';
const { t } = useI18n();
const mafia = useMafiaGameStore();
const mafiaPlayers = useMafiaPlayersStore();
const { nightActions, activeNightActionRole, isMafiaHost, lastNightResult, roleByPeerId, oldMafiaMode } = storeToRefs(mafia);
const MAFIA_TEAM = new Set(['mafia', 'don']);
const visible = computed(() => isMafiaHost.value);
const MIN_W = 281;
const MAX_W = 360;
const MIN_H = 126;
const MARGIN = 8;
const DEFAULT_LEFT_INSET = 70;
const DEFAULT_BOTTOM_INSET = 25;
const collapsed = ref(false);
const size = ref({ w: 281, h: 126 });
const pos = ref((() => {
    const h = 126;
    if (typeof window === 'undefined') {
        return { x: MARGIN, y: 400 };
    }
    return {
        x: Math.max(MARGIN, DEFAULT_LEFT_INSET),
        y: Math.max(MARGIN, window.innerHeight - h - DEFAULT_BOTTOM_INSET),
    };
})());
const savedSnapshot = ref(null);
const tabAnchorY = ref(200);
const collapsedSide = ref('left');
const dragging = ref(false);
const dragOrigin = ref({ cx: 0, cy: 0, x: 0, y: 0 });
const resizing = ref(false);
const resizeOrigin = ref({ cx: 0, cy: 0, w: 0, h: 0 });
const panelZ = 38;
const panelStyle = computed(() => {
    if (collapsed.value) {
        return {};
    }
    return {
        left: `${pos.value.x}px`,
        top: `${pos.value.y}px`,
        width: `${size.value.w}px`,
        height: `${size.value.h}px`,
        zIndex: panelZ,
    };
});
const tabStyle = computed(() => {
    const side = collapsedSide.value;
    return {
        top: `${tabAnchorY.value}px`,
        [side]: '0',
        zIndex: panelZ,
    };
});
const panelCollapseSide = computed(() => {
    if (typeof window === 'undefined') {
        return 'left';
    }
    return pos.value.x + size.value.w * 0.5 < window.innerWidth * 0.5 ? 'left' : 'right';
});
const collapseArrowPath = computed(() => panelCollapseSide.value === 'left'
    ? 'M14.5 7L9.5 12l5 5M10 12h8'
    : 'M9.5 7l5 5-5 5M6 12h8');
const roleKeys = ['mafia', 'don', 'sheriff', 'doctor'];
const flashRole = ref(null);
let nightActionFlashTimer;
watch(nightActions, (cur, prev) => {
    if (prev == null) {
        return;
    }
    for (const k of roleKeys) {
        if (cur[k] !== prev[k]) {
            flashRole.value = k;
            if (nightActionFlashTimer != null) {
                clearTimeout(nightActionFlashTimer);
            }
            nightActionFlashTimer = setTimeout(() => {
                flashRole.value = null;
                nightActionFlashTimer = undefined;
            }, 120);
            return;
        }
    }
});
function labelForKey(k) {
    return t(`mafiaPage.nightRole.${k}`);
}
function valueText(k) {
    const n = nightActions.value[k];
    if (n == null) {
        return t('mafiaPage.nightActionUnset');
    }
    return mafiaGameSeatText(n);
}
function peerIdForSeat(seat) {
    const order = mafia.getDisplayNumberingOrder(mafiaPlayers.joinOrder);
    if (seat < 1 || seat > order.length) {
        return undefined;
    }
    return order[seat - 1];
}
function roleAtSeat(seat) {
    if (seat == null || !Number.isInteger(seat) || seat < 1) {
        return undefined;
    }
    const pid = peerIdForSeat(seat);
    if (pid == null) {
        return undefined;
    }
    return roleByPeerId.value[pid];
}
function checkResultKindForKey(k) {
    const seat = nightActions.value[k];
    if (seat == null) {
        return 'unknown';
    }
    const role = roleAtSeat(seat);
    if (role == null) {
        return 'unknown';
    }
    if (k === 'don') {
        return role === 'sheriff' ? 'peace' : 'mafia';
    }
    return MAFIA_TEAM.has(role) ? 'mafia' : 'peace';
}
function resultGlyphMafia() {
    const lr = lastNightResult.value;
    if (lr == null) {
        return '—';
    }
    if (lr.saved === true) {
        return '❌';
    }
    if (lr.died != null) {
        return '☠️';
    }
    return '❌';
}
function resultGlyphDoctor() {
    const lr = lastNightResult.value;
    if (lr == null) {
        return '—';
    }
    if (lr.saved === true) {
        return '❤️';
    }
    return '❌';
}
function resultGlyphForKey(k) {
    if (k === 'mafia') {
        return resultGlyphMafia();
    }
    if (k === 'doctor') {
        return resultGlyphDoctor();
    }
    const kind = checkResultKindForKey(k);
    if (kind === 'unknown') {
        return '—';
    }
    return kind === 'mafia' ? 'thumb-down' : 'thumb-up';
}
function resultDescForKey(k) {
    if (k === 'mafia') {
        const lr = lastNightResult.value;
        if (lr == null) {
            return t('mafiaPage.hostPanelResultNone');
        }
        if (lr.saved === true) {
            return t('mafiaPage.hostPanelResultMafiaNoKill');
        }
        if (lr.died != null) {
            return t('mafiaPage.hostPanelResultMafiaKill');
        }
        return t('mafiaPage.hostPanelResultMafiaNoKill');
    }
    if (k === 'doctor') {
        const lr = lastNightResult.value;
        if (lr == null) {
            return t('mafiaPage.hostPanelResultNone');
        }
        if (lr.saved === true) {
            return t('mafiaPage.hostPanelResultDoctorSaved');
        }
        return t('mafiaPage.hostPanelResultDoctorNotSaved');
    }
    const seat = nightActions.value[k];
    if (seat == null) {
        return t('mafiaPage.hostPanelResultCheckNone');
    }
    const role = roleAtSeat(seat);
    if (role == null) {
        return t('mafiaPage.hostPanelResultCheckUnknown');
    }
    return MAFIA_TEAM.has(role)
        ? t('mafiaPage.hostPanelResultCheckMafia')
        : t('mafiaPage.hostPanelResultCheckNotMafia');
}
function resultAnimKey(k) {
    const lr = lastNightResult.value;
    const n = nightActions.value[k];
    return `${k}-${n ?? 'x'}-${lr?.died ?? ''}-${String(lr?.saved ?? '')}-${resultGlyphForKey(k)}`;
}
function isActive(r) {
    return activeNightActionRole.value === r;
}
function selectNightActionRole(r) {
    mafia.setHostInteractionMode('night');
    mafia.setActiveNightActionRole(r);
}
function maxPanelHeight() {
    return Math.max(MIN_H, Math.floor(window.innerHeight * 0.88) - 2 * MARGIN);
}
function clampSize() {
    const vw = window.innerWidth;
    const maxH = maxPanelHeight();
    size.value.w = Math.min(MAX_W, Math.max(MIN_W, Math.min(size.value.w, vw - MARGIN - DEFAULT_LEFT_INSET)));
    size.value.h = Math.min(maxH, Math.max(MIN_H, size.value.h));
}
function clampPos() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    clampSize();
    pos.value.x = Math.min(Math.max(MARGIN, pos.value.x), vw - size.value.w - MARGIN);
    pos.value.y = Math.min(Math.max(MARGIN, pos.value.y), vh - size.value.h - MARGIN);
}
function placeDefaultUnobstructed() {
    clampSize();
    const w = size.value.w;
    const h = size.value.h;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    pos.value = {
        x: Math.max(MARGIN, Math.min(DEFAULT_LEFT_INSET, vw - w - MARGIN)),
        y: Math.max(MARGIN, vh - h - DEFAULT_BOTTOM_INSET),
    };
    clampPos();
}
function onWindowResize() {
    clampPos();
    tabAnchorY.value = Math.max(MARGIN, Math.min(pos.value.y + size.value.h * 0.5, window.innerHeight - MARGIN));
}
let dragListenersAttached = false;
let resListenersAttached = false;
function endDrag() {
    if (!dragListenersAttached) {
        return;
    }
    dragListenersAttached = false;
    document.removeEventListener('pointermove', onPointerMoveDrag, true);
    document.removeEventListener('pointerup', onPointerUpDrag, true);
    document.removeEventListener('pointercancel', onPointerUpDrag, true);
    dragging.value = false;
}
function endResize() {
    if (!resListenersAttached) {
        return;
    }
    resListenersAttached = false;
    document.removeEventListener('pointermove', onPointerMoveResize, true);
    document.removeEventListener('pointerup', onPointerUpResize, true);
    document.removeEventListener('pointercancel', onPointerUpResize, true);
    resizing.value = false;
}
function onPointerMoveDrag(ev) {
    if (!dragging.value) {
        return;
    }
    ev.preventDefault();
    const dx = ev.clientX - dragOrigin.value.cx;
    const dy = ev.clientY - dragOrigin.value.cy;
    pos.value = {
        x: dragOrigin.value.x + dx,
        y: dragOrigin.value.y + dy,
    };
    clampPos();
}
function onPointerUpDrag() {
    endDrag();
}
function onHeadPointerDown(ev) {
    if (ev.button !== 0) {
        return;
    }
    const el = ev.target;
    if (el instanceof Element && el.closest('button, a, input, textarea, select, [data-no-maid-drag]')) {
        return;
    }
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
function onPointerMoveResize(ev) {
    if (!resizing.value) {
        return;
    }
    ev.preventDefault();
    const dx = ev.clientX - resizeOrigin.value.cx;
    const dy = ev.clientY - resizeOrigin.value.cy;
    const maxH = maxPanelHeight();
    size.value = {
        w: Math.min(MAX_W, Math.max(MIN_W, resizeOrigin.value.w + dx)),
        h: Math.min(maxH, Math.max(MIN_H, resizeOrigin.value.h + dy)),
    };
    const vw = window.innerWidth;
    size.value.w = Math.min(size.value.w, vw - MARGIN - DEFAULT_LEFT_INSET);
    clampPos();
}
function onPointerUpResize() {
    endResize();
}
function onResizePointerDown(ev) {
    if (ev.button !== 0) {
        return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    resizing.value = true;
    resizeOrigin.value = {
        cx: ev.clientX,
        cy: ev.clientY,
        w: size.value.w,
        h: size.value.h,
    };
    if (!resListenersAttached) {
        resListenersAttached = true;
        document.addEventListener('pointermove', onPointerMoveResize, { capture: true, passive: false });
        document.addEventListener('pointerup', onPointerUpResize, { capture: true });
        document.addEventListener('pointercancel', onPointerUpResize, { capture: true });
    }
}
function collapsePanel() {
    collapsedSide.value = panelCollapseSide.value;
    savedSnapshot.value = {
        pos: { ...pos.value },
        size: { ...size.value },
    };
    tabAnchorY.value = Math.max(MARGIN + 20, Math.min(pos.value.y + size.value.h * 0.45, window.innerHeight - MARGIN - 20));
    endDrag();
    endResize();
    collapsed.value = true;
}
function expandPanel() {
    const s = savedSnapshot.value;
    collapsed.value = false;
    if (s != null) {
        pos.value = { ...s.pos };
        size.value = { ...s.size };
    }
    else {
        placeDefaultUnobstructed();
    }
    void nextTick(() => {
        clampPos();
    });
}
function clearHostPanelSelections() {
    mafia.clearNightActions();
}
onMounted(() => {
    placeDefaultUnobstructed();
    window.addEventListener('resize', onWindowResize, { passive: true });
});
onBeforeUnmount(() => {
    if (nightActionFlashTimer != null) {
        clearTimeout(nightActionFlashTimer);
    }
    window.removeEventListener('resize', onWindowResize);
    endDrag();
    endResize();
});
watch(visible, (v) => {
    if (!v) {
        endDrag();
        endResize();
    }
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['mafia-host-panel__head']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-host-panel__collapse-action']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-host-panel__collapse-action--clear']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-host-panel__collapse-action--collapse']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-host-panel__collapse-action--collapse']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-host-panel__collapse-ico--arrow']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-host-panel__collapse-action--collapse']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-host-panel__role-col']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-host-panel__role-col--flash']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-host-panel__role-value']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-host-panel__role-col']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-host-panel__role-col--on']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-host-panel__role-value']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-host-panel__role-col--flash']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-host-panel__role-value']} */ ;
/** @type {__VLS_StyleScopedClasses['mhp-res-enter-active']} */ ;
/** @type {__VLS_StyleScopedClasses['mhp-res-leave-active']} */ ;
/** @type {__VLS_StyleScopedClasses['mafia-host-panel__resize']} */ ;
if (__VLS_ctx.visible) {
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
            ...{ class: "mafia-host-panel__edge-tab sa-chip-btn mafia-host-panel__edge-tab--pulse" },
            ...{ class: ({
                    'sa-chip-btn--on': true,
                    'mafia-host-panel__edge-tab--left': __VLS_ctx.collapsedSide === 'left',
                    'mafia-host-panel__edge-tab--right': __VLS_ctx.collapsedSide === 'right',
                }) },
            ...{ style: (__VLS_ctx.tabStyle) },
            'aria-label': (__VLS_ctx.t('mafiaPage.hostPanelOpen')),
            title: (__VLS_ctx.t('mafiaPage.hostPanelOpen')),
        });
        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__edge-tab']} */ ;
        /** @type {__VLS_StyleScopedClasses['sa-chip-btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__edge-tab--pulse']} */ ;
        /** @type {__VLS_StyleScopedClasses['sa-chip-btn--on']} */ ;
        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__edge-tab--left']} */ ;
        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__edge-tab--right']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "mafia-host-panel__edge-ico" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__edge-ico']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
            ...{ class: "mafia-host-panel mafia-host-panel__shell" },
            ...{ style: (__VLS_ctx.panelStyle) },
            'aria-label': (__VLS_ctx.t('mafiaPage.hostPanelTitle')),
        });
        /** @type {__VLS_StyleScopedClasses['mafia-host-panel']} */ ;
        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__shell']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
            ...{ onPointerdown: (__VLS_ctx.onHeadPointerDown) },
            ...{ class: "mafia-host-panel__head" },
        });
        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__head']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
            ...{ class: "mafia-host-panel__grip" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__grip']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
            ...{ class: "mafia-host-panel__title" },
        });
        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__title']} */ ;
        (__VLS_ctx.t('mafiaPage.hostPanelTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mafia-host-panel__head-actions" },
            'data-no-maid-drag': true,
        });
        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__head-actions']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.clearHostPanelSelections) },
            type: "button",
            ...{ class: "sa-chip-btn mafia-host-panel__collapse-action mafia-host-panel__collapse-action--clear" },
            'aria-label': (__VLS_ctx.t('mafiaPage.clearNightActionsTitle')),
            title: (__VLS_ctx.t('mafiaPage.clearNightActionsTitle')),
        });
        /** @type {__VLS_StyleScopedClasses['sa-chip-btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__collapse-action']} */ ;
        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__collapse-action--clear']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
            ...{ class: "mafia-host-panel__collapse-ico" },
            viewBox: "0 0 24 24",
            width: "16",
            height: "16",
            'aria-hidden': "true",
            focusable: "false",
        });
        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__collapse-ico']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            d: "M6 6l12 12M18 6L6 18",
            fill: "none",
            stroke: "currentColor",
            'stroke-width': "2.25",
            'stroke-linecap': "round",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.collapsePanel) },
            type: "button",
            ...{ class: "sa-chip-btn mafia-host-panel__collapse-action mafia-host-panel__collapse-action--collapse" },
            'aria-label': (__VLS_ctx.t('mafiaPage.hostPanelCollapse')),
            title: (__VLS_ctx.t('mafiaPage.hostPanelCollapse')),
        });
        /** @type {__VLS_StyleScopedClasses['sa-chip-btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__collapse-action']} */ ;
        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__collapse-action--collapse']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
            ...{ class: "mafia-host-panel__collapse-ico mafia-host-panel__collapse-ico--arrow" },
            ...{ class: (`mafia-host-panel__collapse-ico--arrow-${__VLS_ctx.panelCollapseSide}`) },
            viewBox: "0 0 24 24",
            width: "16",
            height: "16",
            'aria-hidden': "true",
            focusable: "false",
        });
        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__collapse-ico']} */ ;
        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__collapse-ico--arrow']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            d: (__VLS_ctx.collapseArrowPath),
            fill: "none",
            stroke: "currentColor",
            'stroke-width': "2.25",
            'stroke-linecap': "round",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mafia-host-panel__scroller" },
        });
        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__scroller']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mafia-host-panel__night-row" },
            role: "group",
            'aria-label': (__VLS_ctx.t('mafiaPage.nightActionsTitle')),
        });
        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__night-row']} */ ;
        for (const [r] of __VLS_vFor((__VLS_ctx.roleKeys))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.visible))
                            return;
                        if (!!(__VLS_ctx.collapsed))
                            return;
                        __VLS_ctx.selectNightActionRole(r);
                        // @ts-ignore
                        [visible, collapsed, expandPanel, collapsedSide, collapsedSide, tabStyle, t, t, t, t, t, t, t, t, t, panelStyle, onHeadPointerDown, clearHostPanelSelections, collapsePanel, panelCollapseSide, collapseArrowPath, roleKeys, selectNightActionRole,];
                    } },
                key: (r),
                type: "button",
                ...{ class: "mafia-host-panel__role-col h-focus-ring" },
                ...{ class: ({
                        'mafia-host-panel__role-col--on': __VLS_ctx.isActive(r),
                        'mafia-host-panel__role-col--flash': __VLS_ctx.flashRole === r,
                    }) },
                'aria-pressed': (__VLS_ctx.isActive(r)),
                'aria-label': (__VLS_ctx.t('mafiaPage.hostPanelSetActiveColumnTitle', { role: __VLS_ctx.labelForKey(r) })),
                title: (__VLS_ctx.t('mafiaPage.hostPanelSetActiveColumnTitle', { role: __VLS_ctx.labelForKey(r) })),
            });
            /** @type {__VLS_StyleScopedClasses['mafia-host-panel__role-col']} */ ;
            /** @type {__VLS_StyleScopedClasses['h-focus-ring']} */ ;
            /** @type {__VLS_StyleScopedClasses['mafia-host-panel__role-col--on']} */ ;
            /** @type {__VLS_StyleScopedClasses['mafia-host-panel__role-col--flash']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "mafia-host-panel__role-label" },
            });
            /** @type {__VLS_StyleScopedClasses['mafia-host-panel__role-label']} */ ;
            (__VLS_ctx.labelForKey(r));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "mafia-host-panel__role-value" },
            });
            /** @type {__VLS_StyleScopedClasses['mafia-host-panel__role-value']} */ ;
            (__VLS_ctx.valueText(r));
            if (!__VLS_ctx.oldMafiaMode) {
                let __VLS_6;
                /** @ts-ignore @type { | typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
                Transition;
                // @ts-ignore
                const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
                    name: "mhp-res",
                    mode: "out-in",
                }));
                const __VLS_8 = __VLS_7({
                    name: "mhp-res",
                    mode: "out-in",
                }, ...__VLS_functionalComponentArgsRest(__VLS_7));
                const { default: __VLS_11 } = __VLS_9.slots;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    key: (__VLS_ctx.resultAnimKey(r)),
                    ...{ class: "mafia-host-panel__role-result" },
                    ...{ class: ({
                            'mafia-host-panel__role-result--check-icons': r === 'sheriff' || r === 'don',
                        }) },
                    title: (__VLS_ctx.resultDescForKey(r)),
                    'aria-label': (__VLS_ctx.resultDescForKey(r)),
                    role: "img",
                });
                /** @type {__VLS_StyleScopedClasses['mafia-host-panel__role-result']} */ ;
                /** @type {__VLS_StyleScopedClasses['mafia-host-panel__role-result--check-icons']} */ ;
                if (r === 'sheriff' || r === 'don') {
                    if (__VLS_ctx.checkResultKindForKey(r) === 'unknown') {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            ...{ class: "mafia-host-panel__check-unknown" },
                        });
                        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__check-unknown']} */ ;
                    }
                    else if (__VLS_ctx.checkResultKindForKey(r) === 'peace') {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                            ...{ class: "mafia-host-panel__check-icon mafia-host-panel__check-icon--peace" },
                            xmlns: "http://www.w3.org/2000/svg",
                            viewBox: "0 0 24 24",
                            fill: "none",
                            'aria-hidden': "true",
                            focusable: "false",
                        });
                        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__check-icon']} */ ;
                        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__check-icon--peace']} */ ;
                        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                            stroke: "currentColor",
                            'stroke-width': "2",
                            'stroke-linecap': "round",
                            'stroke-linejoin': "round",
                            d: "M7 10v12",
                        });
                        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                            stroke: "currentColor",
                            'stroke-width': "2",
                            'stroke-linecap': "round",
                            'stroke-linejoin': "round",
                            d: "M15 4.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z",
                        });
                    }
                    else {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                            ...{ class: "mafia-host-panel__check-icon mafia-host-panel__check-icon--mafia" },
                            xmlns: "http://www.w3.org/2000/svg",
                            viewBox: "0 0 24 24",
                            fill: "none",
                            'aria-hidden': "true",
                            focusable: "false",
                        });
                        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__check-icon']} */ ;
                        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__check-icon--mafia']} */ ;
                        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                            stroke: "currentColor",
                            'stroke-width': "2",
                            'stroke-linecap': "round",
                            'stroke-linejoin': "round",
                            d: "M17 14V2",
                        });
                        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                            stroke: "currentColor",
                            'stroke-width': "2",
                            'stroke-linecap': "round",
                            'stroke-linejoin': "round",
                            d: "M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z",
                        });
                    }
                }
                else {
                    (__VLS_ctx.resultGlyphForKey(r));
                }
                // @ts-ignore
                [t, t, isActive, isActive, flashRole, labelForKey, labelForKey, labelForKey, valueText, oldMafiaMode, resultAnimKey, resultDescForKey, resultDescForKey, checkResultKindForKey, checkResultKindForKey, resultGlyphForKey,];
                var __VLS_9;
            }
            // @ts-ignore
            [];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
            ...{ onPointerdown: (__VLS_ctx.onResizePointerDown) },
            ...{ class: "mafia-host-panel__resize" },
            'aria-label': (__VLS_ctx.t('mafiaPage.hostPanelResizeHint')),
        });
        /** @type {__VLS_StyleScopedClasses['mafia-host-panel__resize']} */ ;
    }
    // @ts-ignore
    [t, onResizePointerDown,];
    var __VLS_3;
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
