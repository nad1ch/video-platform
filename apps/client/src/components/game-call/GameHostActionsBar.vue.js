/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
/**
 * GameHostActionsBar — shared host-side action toolbar for game-call pages.
 *
 * Extracted from `MafiaHostActionsBar.vue` in Phase 5b so production Mafia
 * and the Game Template render the same toolbar. The component is
 * presentational only:
 *
 *   - state arrives via props (`muteAllActive`, `canReshuffle`, `swapActive`)
 *   - actions leave via emits (`set-mute-all`, `reshuffle`, `toggle-swap-mode`)
 *   - all locale strings arrive via the `labels` prop
 *
 * The component owns the reshuffle `<ConfirmDialog>` mounting because the
 * confirm step is part of the toolbar's UX, not the upstream protocol. The
 * dialog's text comes through `labels.reshuffleConfirm*`.
 *
 * Hard isolation: NO imports from any Mafia store, composable, signaling,
 * or i18n keys. Asset paths live under the neutral `@/assets/game-call/`
 * folder; the file names + variable bindings keep their `mafia*` prefix
 * to minimize diff (the SVG bytes are namespace-neutral and shared with
 * Mafia / Game Template / Eat First via the same components).
 */
import { computed, ref } from 'vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import mafiaHostMuteAllActive from '@/assets/game-call/host-mute-all-active.svg';
import mafiaHostMuteAll from '@/assets/game-call/host-mute-all.svg';
import mafiaHostRoles from '@/assets/game-call/host-roles.svg';
const props = withDefaults(defineProps(), {
    showSwap: true,
});
const emit = defineEmits();
const muteAllIcon = computed(() => props.muteAllActive ? mafiaHostMuteAllActive : mafiaHostMuteAll);
/**
 * Local visibility for the reshuffle confirm dialog. `ConfirmDialog` writes
 * `false` here via `v-model:open` on confirm/close, so the toolbar does not
 * need to track the dialog lifecycle separately.
 */
const reshuffleConfirmOpen = ref(false);
function onMuteAllClick() {
    // Click derives the next action from the *visual* state, not a bare server
    // flag. If anyone is unmuted while the flag is conceptually active, clicking
    // re-asserts mute-all (sends `muted: true`). Preserved 1:1 from
    // `MafiaHostActionsBar`.
    emit('set-mute-all', !props.muteAllActive);
}
function onReshuffleClick() {
    if (!props.canReshuffle)
        return;
    reshuffleConfirmOpen.value = true;
}
function onReshuffleConfirmed() {
    if (!props.canReshuffle)
        return;
    emit('reshuffle');
}
function onSwapClick() {
    emit('toggle-swap-mode');
}
const __VLS_defaults = {
    showSwap: true,
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
/** @type {__VLS_StyleScopedClasses['game-host-actions__btn']} */ ;
/** @type {__VLS_StyleScopedClasses['game-host-actions__btn']} */ ;
/** @type {__VLS_StyleScopedClasses['game-host-actions__btn']} */ ;
/** @type {__VLS_StyleScopedClasses['game-host-actions__btn']} */ ;
/** @type {__VLS_StyleScopedClasses['game-host-actions__full-art']} */ ;
/** @type {__VLS_StyleScopedClasses['game-host-actions__btn--swap']} */ ;
/** @type {__VLS_StyleScopedClasses['game-host-actions__btn']} */ ;
/** @type {__VLS_StyleScopedClasses['game-host-actions__roles-art']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "game-host-actions" },
    ...{ class: ({ 'game-host-actions--no-swap': !__VLS_ctx.showSwap }) },
    role: "toolbar",
    'aria-label': (__VLS_ctx.labels.toolbarAria),
});
/** @type {__VLS_StyleScopedClasses['game-host-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['game-host-actions--no-swap']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.onMuteAllClick) },
    type: "button",
    ...{ class: "game-host-actions__btn game-host-actions__btn--mute" },
    ...{ class: ({ 'game-host-actions__btn--mute-active': __VLS_ctx.muteAllActive }) },
    title: (__VLS_ctx.labels.muteAllTitle),
    'aria-label': (__VLS_ctx.labels.muteAllTitle),
    'aria-pressed': (__VLS_ctx.muteAllActive),
});
/** @type {__VLS_StyleScopedClasses['game-host-actions__btn']} */ ;
/** @type {__VLS_StyleScopedClasses['game-host-actions__btn--mute']} */ ;
/** @type {__VLS_StyleScopedClasses['game-host-actions__btn--mute-active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    ...{ class: "game-host-actions__full-art" },
    src: (__VLS_ctx.muteAllIcon),
    alt: "",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['game-host-actions__full-art']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.onReshuffleClick) },
    type: "button",
    ...{ class: "game-host-actions__btn game-host-actions__btn--roles" },
    disabled: (!__VLS_ctx.canReshuffle),
    title: (__VLS_ctx.canReshuffle ? __VLS_ctx.labels.reshuffleTitle : __VLS_ctx.labels.reshuffleDisabledHint),
    'aria-label': (__VLS_ctx.canReshuffle ? __VLS_ctx.labels.reshuffleTitle : __VLS_ctx.labels.reshuffleDisabledHint),
});
/** @type {__VLS_StyleScopedClasses['game-host-actions__btn']} */ ;
/** @type {__VLS_StyleScopedClasses['game-host-actions__btn--roles']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    ...{ class: "game-host-actions__roles-art" },
    src: (__VLS_ctx.mafiaHostRoles),
    alt: "",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['game-host-actions__roles-art']} */ ;
if (__VLS_ctx.showSwap) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.onSwapClick) },
        type: "button",
        ...{ class: "game-host-actions__btn game-host-actions__btn--swap" },
        ...{ class: ({ 'game-host-actions__btn--swap-active': __VLS_ctx.swapActive }) },
        title: (__VLS_ctx.labels.swapModeTitle),
        'aria-label': (__VLS_ctx.labels.swapModeAria),
        'aria-pressed': (__VLS_ctx.swapActive),
    });
    /** @type {__VLS_StyleScopedClasses['game-host-actions__btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['game-host-actions__btn--swap']} */ ;
    /** @type {__VLS_StyleScopedClasses['game-host-actions__btn--swap-active']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        ...{ class: "game-host-actions__swap-art" },
        viewBox: "0 0 24 24",
        width: "22",
        height: "22",
        'aria-hidden': "true",
        focusable: "false",
    });
    /** @type {__VLS_StyleScopedClasses['game-host-actions__swap-art']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M5 8h12m0 0-3-3m3 3-3 3M19 16H7m0 0 3-3m-3 3 3 3",
        fill: "none",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
    });
}
const __VLS_0 = ConfirmDialog;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ 'onConfirm': {} },
    open: (__VLS_ctx.reshuffleConfirmOpen),
    title: (__VLS_ctx.labels.reshuffleConfirmTitle),
    message: (__VLS_ctx.labels.reshuffleConfirmBody),
    confirmLabel: (__VLS_ctx.labels.reshuffleConfirmProceed),
    cancelLabel: (__VLS_ctx.labels.reshuffleConfirmCancel),
}));
const __VLS_2 = __VLS_1({
    ...{ 'onConfirm': {} },
    open: (__VLS_ctx.reshuffleConfirmOpen),
    title: (__VLS_ctx.labels.reshuffleConfirmTitle),
    message: (__VLS_ctx.labels.reshuffleConfirmBody),
    confirmLabel: (__VLS_ctx.labels.reshuffleConfirmProceed),
    cancelLabel: (__VLS_ctx.labels.reshuffleConfirmCancel),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
const __VLS_6 = ({ confirm: {} },
    { onConfirm: (__VLS_ctx.onReshuffleConfirmed) });
var __VLS_3;
var __VLS_4;
// @ts-ignore
[showSwap, showSwap, labels, labels, labels, labels, labels, labels, labels, labels, labels, labels, labels, labels, labels, onMuteAllClick, muteAllActive, muteAllActive, muteAllIcon, onReshuffleClick, canReshuffle, canReshuffle, canReshuffle, mafiaHostRoles, onSwapClick, swapActive, swapActive, reshuffleConfirmOpen, onReshuffleConfirmed,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
