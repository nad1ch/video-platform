<script setup lang="ts">
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
const mafia = useMafiaGameStore()
const { speakingQueue, hostInteractionMode } = storeToRefs(mafia)

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
  mafia.setHostInteractionMode(speakingActive.value ? 'night' : 'speaking')
}

function onRemovePair(pairIndex: number): void {
  if (!props.showTools) return
  mafia.removeSpeakingNominationPairAt(pairIndex)
}

function onClearAll(): void {
  if (!props.showTools) return
  if (speakingQueue.value.length === 0) return
  mafia.clearSpeakingQueue()
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
