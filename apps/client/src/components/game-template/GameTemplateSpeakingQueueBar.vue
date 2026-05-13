<script setup lang="ts">
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

import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameTemplateGameStore } from '@/stores/gameTemplateGame'
import { decodeSpeakingNominationFlat } from '@/utils/speakingNominationQueue'
import GameSpeakingQueueBar, {
  type GameSpeakingQueueLabels,
} from '@/components/game-call/GameSpeakingQueueBar.vue'

const props = withDefaults(
  defineProps<{
    showTools?: boolean
  }>(),
  {
    showTools: false,
  },
)

const { t } = useI18n()
const gameStore = useGameTemplateGameStore()
const { speakingQueue, hostInteractionMode } = storeToRefs(gameStore)

const segments = computed(() => decodeSpeakingNominationFlat(speakingQueue.value))
const speakingActive = computed(() => hostInteractionMode.value === 'speaking')

const labels = computed<GameSpeakingQueueLabels>(() => ({
  containerAria: t('mafiaPage.speakingQueueAria'),
  toolbarAria: t('mafiaPage.hostInteractionModeLabel'),
  speakingModeTitle: t('mafiaPage.speakingModeHint'),
  speakingModeAria: t('mafiaPage.modeSpeaking'),
  clearAllTitle: t('mafiaPage.speakingQueueClearAllTitle'),
  chipRemoveTitle: (by, target) =>
    t('mafiaPage.speakingQueueRemoveTitle', { by, target }),
  chipViewOnlyTitle: (by, target) =>
    t('mafiaPage.speakingQueueChipViewOnly', { by, target }),
}))

function onToggleSpeakingMode(): void {
  if (!props.showTools) return
  // Mafia toggled off into 'night'; the generic protocol toggles off into 'idle'.
  gameStore.setHostInteractionMode(speakingActive.value ? 'idle' : 'speaking')
}

function onRemovePair(pairIndex: number): void {
  if (!props.showTools) return
  gameStore.removeSpeakingNominationPairAt(pairIndex)
}

function onClearAll(): void {
  if (!props.showTools) return
  if (speakingQueue.value.length === 0) return
  gameStore.clearSpeakingQueue()
}
</script>

<template>
  <GameSpeakingQueueBar
    :segments="segments"
    :speaking-active="speakingActive"
    :show-tools="showTools"
    :labels="labels"
    @toggle-speaking-mode="onToggleSpeakingMode"
    @remove-pair="onRemovePair"
    @clear-all="onClearAll"
  />
</template>
