/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
/**
 * MafiaHostActionsBar — Mafia adapter around the shared `<GameHostActionsBar>`
 * toolbar (Phase 5b extraction).
 *
 * Owns the Mafia-specific bits (left in the adapter):
 *   - host identity gate (`isMafiaHost` v-if)
 *   - reshuffle gate logic (player-count vs `oldMafiaMode`)
 *   - swap-mode 'night' off-sentinel + `setHostInteractionMode` store call
 *   - reshuffle store dispatch (`mafia.reshuffleGame()`)
 *   - `force-mute-all` outward emit (CallPage's existing contract)
 *   - i18n key resolution (`mafiaPage.*`)
 *
 * The button surface (icons, animations, hover transforms, ConfirmDialog
 * mounting) is now in `GameHostActionsBar` under `components/game-call/`,
 * shared with the Game Template page.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useMafiaGameStore } from '@/stores/mafiaGame';
import { useMafiaPlayersStore } from '@/stores/mafiaPlayers';
import GameHostActionsBar from '@/components/game-call/GameHostActionsBar.vue';
const emit = defineEmits();
const { t } = useI18n();
const mafia = useMafiaGameStore();
const mafiaPlayers = useMafiaPlayersStore();
const { isMafiaHost, oldMafiaMode, hostInteractionMode, mafiaForceMuteAllActive, everyNonHostEffectivelyMuted, } = storeToRefs(mafia);
/**
 * Visual "active" state (P1 Bug 1 + Bug 2 — preserved 1:1):
 * - host has clicked "mute all" (server-authoritative `mafiaForceMuteAllActive`),
 *   AND
 * - every non-host peer is currently effectively muted.
 *
 * If the second clause becomes false (e.g. the previous host is now a
 * non-host peer with their own mic on after a transfer), the button drops
 * back to the "mute all" affordance so one click re-mutes the room.
 */
const muteAllActive = computed(() => mafiaForceMuteAllActive.value && everyNonHostEffectivelyMuted.value);
const canReshuffle = computed(() => {
    const n = mafiaPlayers.joinOrder.length;
    if (oldMafiaMode.value) {
        return n >= 2;
    }
    return n >= 5 && n <= 12;
});
const swapModeActive = computed(() => hostInteractionMode.value === 'swap');
const labels = computed(() => ({
    toolbarAria: t('mafiaPage.hostActionsAria'),
    muteAllTitle: t('mafiaPage.forceMuteAllTitle'),
    reshuffleTitle: t('mafiaPage.overlayShuffleButtonTitle'),
    reshuffleDisabledHint: t('mafiaPage.reshuffleCountHint'),
    swapModeTitle: t('mafiaPage.swapModeHint'),
    swapModeAria: t('mafiaPage.modeSwap'),
    reshuffleConfirmTitle: t('mafiaPage.reshuffleConfirmTitle'),
    reshuffleConfirmBody: t('mafiaPage.reshuffleConfirmBody'),
    reshuffleConfirmProceed: t('mafiaPage.reshuffleConfirmProceed'),
    reshuffleConfirmCancel: t('mafiaPage.reshuffleConfirmCancel'),
}));
function onSetMuteAll(muted) {
    if (!isMafiaHost.value)
        return;
    emit('force-mute-all', muted);
}
function onReshuffle() {
    if (!isMafiaHost.value || !canReshuffle.value)
        return;
    mafia.reshuffleGame();
}
function onToggleSwapMode() {
    if (!isMafiaHost.value)
        return;
    mafia.setHostInteractionMode(swapModeActive.value ? 'night' : 'swap');
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
if (__VLS_ctx.isMafiaHost) {
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
[isMafiaHost, muteAllActive, canReshuffle, swapModeActive, labels, onSetMuteAll, onReshuffle, onToggleSwapMode,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
