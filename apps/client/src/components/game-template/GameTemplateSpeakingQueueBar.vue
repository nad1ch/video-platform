<script setup lang="ts">
/**
 * GameTemplateSpeakingQueueBar — fork of `MafiaSpeakingQueueBar.vue` for
 * `/app/game-template`.
 *
 * Adapter around the shared presentational `<GameSpeakingQueueBar>`. Owns
 * the same bits as the Mafia adapter:
 *   - reading `speakingQueue` + `hostInteractionMode` from the Mafia store
 *   - decoding the flat number queue into segments
 *   - swap-mode 'night' off-sentinel via `setHostInteractionMode`
 *   - direct store dispatch for `removeSpeakingNominationPairAt` / `clearSpeakingQueue`
 *   - i18n key resolution (`mafiaPage.*`)
 *
 * The HUD surface (chips, animations, transitions, layout-context-aware
 * CSS) is in `GameSpeakingQueueBar` under `components/game-call/`, shared
 * with Mafia. CSS class names stay `.mafia-vote-hud*` because `CallPage.css`
 * carries cross-component `:deep()` rules on those names (see the note in
 * `GameSpeakingQueueBar.vue`).
 */

import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMafiaGameStore } from '@/stores/mafiaGame'
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
const gameStore = useMafiaGameStore()
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
  gameStore.setHostInteractionMode(speakingActive.value ? 'night' : 'speaking')
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
