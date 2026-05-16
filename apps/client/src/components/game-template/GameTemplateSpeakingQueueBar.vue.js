/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
/**
 * GameTemplateSpeakingQueueBar — Phase 3C.
 *
 * Switched off the Mafia stack. Now uses `useGameTemplateGameStore`.
 *
 * Difference vs Mafia adapter: the speaking-mode off-state was `'night'`
 * for Mafia; for the generic protocol it is `'idle'` (no night phase
 * exists).
 *
 * The HUD surface remains the shared presentational
 * `<GameSpeakingQueueBar>` from `components/game-call/`. CSS class names
 * stay `.mafia-vote-hud*` because CallPage.css carries cross-component
 * `:deep()` rules on those names — see the note in `GameSpeakingQueueBar.vue`.
 */
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGameTemplateGameStore } from '@/stores/gameTemplateGame';
import { decodeSpeakingNominationFlat } from '@/utils/speakingNominationQueue';
import GameSpeakingQueueBar from '@/components/game-call/GameSpeakingQueueBar.vue';
const props = withDefaults(defineProps(), {
    showTools: false,
});
const { t } = useI18n();
const gameStore = useGameTemplateGameStore();
const { speakingQueue, hostInteractionMode } = storeToRefs(gameStore);
const segments = computed(() => decodeSpeakingNominationFlat(speakingQueue.value));
const speakingActive = computed(() => hostInteractionMode.value === 'speaking');
const labels = computed(() => ({
    containerAria: t('gameRoom.speakingQueueAria'),
    toolbarAria: t('gameRoom.hostInteractionModeLabel'),
    speakingModeTitle: t('gameRoom.speakingModeHint'),
    speakingModeAria: t('gameRoom.modeSpeaking'),
    clearAllTitle: t('gameRoom.speakingQueueClearAllTitle'),
    chipRemoveTitle: (by, target) => t('gameRoom.speakingQueueRemoveTitle', { by, target }),
    chipViewOnlyTitle: (by, target) => t('gameRoom.speakingQueueChipViewOnly', { by, target }),
}));
function onToggleSpeakingMode() {
    if (!props.showTools)
        return;
    // Mafia toggled off into 'night'; the generic protocol toggles off into 'idle'.
    gameStore.setHostInteractionMode(speakingActive.value ? 'idle' : 'speaking');
}
function onRemovePair(pairIndex) {
    if (!props.showTools)
        return;
    gameStore.removeSpeakingNominationPairAt(pairIndex);
}
function onClearAll() {
    if (!props.showTools)
        return;
    if (speakingQueue.value.length === 0)
        return;
    gameStore.clearSpeakingQueue();
}
const __VLS_defaults = {
    showTools: false,
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
const __VLS_0 = GameSpeakingQueueBar;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ 'onToggleSpeakingMode': {} },
    ...{ 'onRemovePair': {} },
    ...{ 'onClearAll': {} },
    segments: (__VLS_ctx.segments),
    speakingActive: (__VLS_ctx.speakingActive),
    showTools: (__VLS_ctx.showTools),
    labels: (__VLS_ctx.labels),
}));
const __VLS_2 = __VLS_1({
    ...{ 'onToggleSpeakingMode': {} },
    ...{ 'onRemovePair': {} },
    ...{ 'onClearAll': {} },
    segments: (__VLS_ctx.segments),
    speakingActive: (__VLS_ctx.speakingActive),
    showTools: (__VLS_ctx.showTools),
    labels: (__VLS_ctx.labels),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
const __VLS_6 = ({ toggleSpeakingMode: {} },
    { onToggleSpeakingMode: (__VLS_ctx.onToggleSpeakingMode) });
const __VLS_7 = ({ removePair: {} },
    { onRemovePair: (__VLS_ctx.onRemovePair) });
const __VLS_8 = ({ clearAll: {} },
    { onClearAll: (__VLS_ctx.onClearAll) });
var __VLS_9 = {};
var __VLS_3;
var __VLS_4;
// @ts-ignore
[segments, speakingActive, showTools, labels, onToggleSpeakingMode, onRemovePair, onClearAll,];
const __VLS_export = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
