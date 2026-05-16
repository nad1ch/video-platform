/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
/**
 * MafiaSpeakingQueueBar — Mafia adapter around the shared
 * `<GameSpeakingQueueBar>` HUD (Phase 5b extraction).
 *
 * Owns the Mafia-specific bits:
 *   - reading `speakingQueue` + `hostInteractionMode` from the store
 *   - decoding the flat number queue into segments
 *   - swap-mode 'night' off-sentinel via `setHostInteractionMode`
 *   - direct store dispatch for `removeSpeakingNominationPairAt` / `clearSpeakingQueue`
 *   - i18n key resolution (`mafiaPage.*`)
 *
 * The HUD surface (chips, animations, transitions, layout-context-aware
 * CSS) is now in `GameSpeakingQueueBar` under `components/game-call/`,
 * shared with the Game Template page.
 *
 * Note: the shared component keeps the `mafia-vote-hud*` class namespace so
 * `CallPage.css :deep()` rules continue to match in Mafia stream-view +
 * mobile layouts. See the comment block in `GameSpeakingQueueBar.vue`.
 */
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMafiaGameStore } from '@/stores/mafiaGame';
import { decodeSpeakingNominationFlat } from '@/utils/speakingNominationQueue';
import GameSpeakingQueueBar from '@/components/game-call/GameSpeakingQueueBar.vue';
const props = withDefaults(defineProps(), {
    showTools: false,
});
const { t } = useI18n();
const mafia = useMafiaGameStore();
const { speakingQueue, hostInteractionMode } = storeToRefs(mafia);
const segments = computed(() => decodeSpeakingNominationFlat(speakingQueue.value));
const speakingActive = computed(() => hostInteractionMode.value === 'speaking');
const labels = computed(() => ({
    containerAria: t('mafiaPage.speakingQueueAria'),
    toolbarAria: t('mafiaPage.hostInteractionModeLabel'),
    speakingModeTitle: t('mafiaPage.speakingModeHint'),
    speakingModeAria: t('mafiaPage.modeSpeaking'),
    clearAllTitle: t('mafiaPage.speakingQueueClearAllTitle'),
    chipRemoveTitle: (by, target) => t('mafiaPage.speakingQueueRemoveTitle', { by, target }),
    chipViewOnlyTitle: (by, target) => t('mafiaPage.speakingQueueChipViewOnly', { by, target }),
}));
function onToggleSpeakingMode() {
    if (!props.showTools)
        return;
    mafia.setHostInteractionMode(speakingActive.value ? 'night' : 'speaking');
}
function onRemovePair(pairIndex) {
    if (!props.showTools)
        return;
    mafia.removeSpeakingNominationPairAt(pairIndex);
}
function onClearAll() {
    if (!props.showTools)
        return;
    if (speakingQueue.value.length === 0)
        return;
    mafia.clearSpeakingQueue();
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
