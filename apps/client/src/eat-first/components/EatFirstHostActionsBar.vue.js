/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
/**
 * EatFirstHostActionsBar — thin adapter around the shared
 * `<GameHostActionsBar>` toolbar.
 *
 * Same pattern as `MafiaHostActionsBar.vue` and
 * `GameTemplateHostActionsBar.vue`: the presentational button surface +
 * confirm-dialog lifecycle lives in
 * `components/game-call/GameHostActionsBar.vue`; this file only wires
 * Eat First state into the shared props/emits and feeds Eat First i18n
 * keys via the `labels` prop.
 *
 * Eat First-specific carry-over (preserved 1:1 from the inline form):
 *
 *   - The mute-all flag is **local** (no server-authoritative
 *     `forceMuteAllActive` like Mafia / Game Template). Clicking
 *     flips a local ref AND emits `force-mute-all` so CallPage can
 *     dispatch `eat:force-mute-all`.
 *
 *   - The reshuffle gate uses
 *     `Math.max(playerOrder, playerCount, connectedPlayerCount) >= 2`
 *     because Eat First may have remote players counted in
 *     `connectedPlayerCount` before `playerOrder` is populated.
 *
 *   - The swap-mode button is visible (Choice A — Mafia / Game Template
 *     parity). Toggling enters / exits the shell store's
 *     `hostInteractionMode === 'swap'`; the actual positional swap is
 *     committed by `CallPage`'s tile-click router via
 *     `eatFirstShell.swapEatFirstSlotsInPlayerOrder`, then broadcast on
 *     the existing `eat:players-update` WS path.
 *
 *   - The destructive reshuffle confirm dialog (server-authoritative
 *     `eat:table-round-deal` wipes the reveal ledger, marks every
 *     action card unused, regenerates traits, and resets the speaking
 *     queue) is now owned by the shared bar via its own
 *     `<ConfirmDialog>` mount. The dialog text comes from
 *     `eatFirstCall.reshuffleConfirm*` i18n keys.
 *
 * Public emit contract preserved for `CallPage.vue`:
 *   - `force-mute-all [muted: boolean]`
 *   - `reshuffle []`
 */
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useEatFirstCallShellStore } from '@/stores/eatFirstCallShell';
import GameHostActionsBar from '@/components/game-call/GameHostActionsBar.vue';
const emit = defineEmits();
const { t } = useI18n();
const eatFirstShell = useEatFirstCallShellStore();
const { isEatFirstRoomHost, playerOrder, playerCount, connectedPlayerCount, hostInteractionMode, } = storeToRefs(eatFirstShell);
/**
 * Local mute-all state — Eat First does NOT carry a
 * server-authoritative mute-all flag like Mafia's
 * `mafiaForceMuteAllActive`. The original inline component flipped a
 * local ref on each click; preserved 1:1 here.
 */
const muteAllActive = ref(false);
const canReshuffle = computed(() => Math.max(playerOrder.value.length, playerCount.value, connectedPlayerCount.value) >= 2);
const swapModeActive = computed(() => hostInteractionMode.value === 'swap');
const labels = computed(() => ({
    toolbarAria: t('eatFirstCall.hostActionsAria'),
    muteAllTitle: t('eatFirstCall.forceMuteAllTitle'),
    reshuffleTitle: t('eatFirstCall.reshuffleOrderTitle'),
    reshuffleDisabledHint: t('eatFirstCall.reshuffleOrderHint'),
    swapModeTitle: t('eatFirstCall.swapModeHint'),
    swapModeAria: t('eatFirstCall.modeSwap'),
    reshuffleConfirmTitle: t('eatFirstCall.reshuffleConfirmTitle'),
    reshuffleConfirmBody: t('eatFirstCall.reshuffleConfirmMessage'),
    reshuffleConfirmProceed: t('eatFirstCall.reshuffleConfirmAction'),
    reshuffleConfirmCancel: t('eatFirstCall.reshuffleConfirmCancel'),
}));
function onSetMuteAll(muted) {
    if (!isEatFirstRoomHost.value)
        return;
    muteAllActive.value = muted;
    emit('force-mute-all', muted);
}
function onReshuffle() {
    if (!isEatFirstRoomHost.value || !canReshuffle.value)
        return;
    emit('reshuffle');
}
/**
 * Toggle positional swap mode (Choice A — Mafia / Game Template parity).
 * The shared bar's swap button is now visible (`show-swap` defaults to
 * `true`). Mutual-exclusion with speaking mode is enforced inside the
 * shell's `setHostInteractionMode` setter so the host's first tile click
 * routes through swap, not nomination.
 */
function onToggleSwapMode() {
    if (!isEatFirstRoomHost.value)
        return;
    eatFirstShell.setHostInteractionMode(swapModeActive.value ? 'idle' : 'swap');
}
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
if (__VLS_ctx.isEatFirstRoomHost) {
    const __VLS_0 = GameHostActionsBar;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ 'onSetMuteAll': {} },
        ...{ 'onReshuffle': {} },
        ...{ 'onToggleSwapMode': {} },
        muteAllActive: (__VLS_ctx.muteAllActive),
        canReshuffle: (__VLS_ctx.canReshuffle),
        swapActive: (__VLS_ctx.swapModeActive),
        labels: (__VLS_ctx.labels),
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onSetMuteAll': {} },
        ...{ 'onReshuffle': {} },
        ...{ 'onToggleSwapMode': {} },
        muteAllActive: (__VLS_ctx.muteAllActive),
        canReshuffle: (__VLS_ctx.canReshuffle),
        swapActive: (__VLS_ctx.swapModeActive),
        labels: (__VLS_ctx.labels),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = ({ setMuteAll: {} },
        { onSetMuteAll: (__VLS_ctx.onSetMuteAll) });
    const __VLS_7 = ({ reshuffle: {} },
        { onReshuffle: (__VLS_ctx.onReshuffle) });
    const __VLS_8 = ({ toggleSwapMode: {} },
        { onToggleSwapMode: (__VLS_ctx.onToggleSwapMode) });
    var __VLS_9 = {};
    var __VLS_3;
    var __VLS_4;
}
// @ts-ignore
[isEatFirstRoomHost, muteAllActive, canReshuffle, swapModeActive, labels, onSetMuteAll, onReshuffle, onToggleSwapMode,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
