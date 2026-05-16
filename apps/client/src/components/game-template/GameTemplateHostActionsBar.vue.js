/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
/**
 * GameTemplateHostActionsBar — Phase 3C.
 *
 * Switched off the Mafia stack. Now uses the generic stores
 * (`useGameTemplateGameStore`, `useGameTemplatePlayersStore`).
 *
 * Differences vs Mafia adapter:
 *   - `oldMafiaMode` REMOVED — the reshuffle gate is now `n >= 2` only
 *     (the upper bound of 12 is still enforced by the server).
 *   - The swap-mode off-state was `'night'` for Mafia; for the generic
 *     protocol it is `'idle'` (no night phase exists).
 *
 * The button surface is the shared presentational `<GameHostActionsBar>`
 * under `components/game-call/`, unchanged.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useGameTemplateGameStore } from '@/stores/gameTemplateGame';
import { useGameTemplatePlayersStore } from '@/stores/gameTemplatePlayers';
import GameHostActionsBar from '@/components/game-call/GameHostActionsBar.vue';
const emit = defineEmits();
const { t } = useI18n();
const gameStore = useGameTemplateGameStore();
const players = useGameTemplatePlayersStore();
const { isGameRoomHost, hostInteractionMode, forceMuteAllActive, everyNonHostEffectivelyMuted, } = storeToRefs(gameStore);
const muteAllActive = computed(() => forceMuteAllActive.value && everyNonHostEffectivelyMuted.value);
/**
 * Generic reshuffle gate: at least 2 players. The Mafia adapter
 * additionally distinguished "old mode (>= 2)" vs "new mode (5–12)" via
 * `oldMafiaMode`; that mode toggle does not exist in the generic
 * protocol. The server still caps the upper bound at 12.
 */
const canReshuffle = computed(() => players.joinOrder.length >= 2);
const swapModeActive = computed(() => hostInteractionMode.value === 'swap');
const labels = computed(() => ({
    toolbarAria: t('gameRoom.hostActionsAria'),
    muteAllTitle: t('gameRoom.forceMuteAllTitle'),
    reshuffleTitle: t('gameRoom.overlayShuffleButtonTitle'),
    reshuffleDisabledHint: t('gameRoom.reshuffleCountHint'),
    swapModeTitle: t('gameRoom.swapModeHint'),
    swapModeAria: t('gameRoom.modeSwap'),
    reshuffleConfirmTitle: t('gameRoom.reshuffleConfirmTitle'),
    reshuffleConfirmBody: t('gameRoom.reshuffleConfirmBody'),
    reshuffleConfirmProceed: t('gameRoom.reshuffleConfirmProceed'),
    reshuffleConfirmCancel: t('gameRoom.reshuffleConfirmCancel'),
}));
function onSetMuteAll(muted) {
    if (!isGameRoomHost.value)
        return;
    emit('force-mute-all', muted);
}
function onReshuffle() {
    if (!isGameRoomHost.value || !canReshuffle.value)
        return;
    gameStore.reshuffleGame();
}
function onToggleSwapMode() {
    if (!isGameRoomHost.value)
        return;
    // Mafia toggled off into 'night'; the generic protocol toggles off into 'idle'.
    gameStore.setHostInteractionMode(swapModeActive.value ? 'idle' : 'swap');
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
if (__VLS_ctx.isGameRoomHost) {
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
[isGameRoomHost, muteAllActive, canReshuffle, swapModeActive, labels, onSetMuteAll, onReshuffle, onToggleSwapMode,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
