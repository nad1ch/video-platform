<script setup lang="ts">
/**
 * EatFirstSpeakingQueueBar — thin adapter over the shared
 * `<GameSpeakingQueueBar>` HUD.
 *
 * Same pattern as `GameTemplateSpeakingQueueBar.vue` and
 * `MafiaSpeakingQueueBar.vue`: the presentational chip + tool surface
 * lives in `components/game-call/GameSpeakingQueueBar.vue`; this file
 * only wires Eat First store state (`eatFirstShell.speakingQueue`,
 * `speakingMode`) into the shared props/emits and feeds Eat First
 * i18n keys via the `labels` prop.
 *
 * CSS namespace `.mafia-vote-hud*` lives inside the shared component
 * because `CallPage.css` carries cross-component `:deep()` rules that
 * target those names from stream-view / mobile contexts — see the note
 * in `GameSpeakingQueueBar.vue`. The previous scoped `.ef-vote-hud*`
 * rules in this file are no longer needed.
 *
 * Eat First-specific carry-over (preserved 1:1 from the inline form):
 * when the host clears the queue from this HUD, the speaking mode also
 * flips off so the next tile click does not immediately start
 * collecting a fresh nomination pair. Mafia / Game Template adapters
 * intentionally do NOT do this — their off-state is route-specific
 * (`'night'` / `'idle'`) and lives in the store.
 */

import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useEatFirstCallShellStore } from '@/stores/eatFirstCallShell'
import { decodeSpeakingNominationFlat } from '@/utils/speakingNominationQueue'
import GameSpeakingQueueBar, {
  type GameSpeakingQueueLabels,
} from '@/components/game-call/GameSpeakingQueueBar.vue'

const props = withDefaults(
  defineProps<{
    showTools?: boolean
  }>(),
  { showTools: false },
)

const { t } = useI18n()
const eatFirstShell = useEatFirstCallShellStore()
const { speakingQueue, speakingMode } = storeToRefs(eatFirstShell)

const segments = computed(() => decodeSpeakingNominationFlat(speakingQueue.value))

const labels = computed<GameSpeakingQueueLabels>(() => ({
  containerAria: t('eatFirstCall.speakingQueueAria'),
  toolbarAria: t('eatFirstCall.hostInteractionModeLabel'),
  speakingModeTitle: t('eatFirstCall.speakingModeHint'),
  speakingModeAria: t('eatFirstCall.modeSpeaking'),
  clearAllTitle: t('eatFirstCall.speakingQueueClearAllTitle'),
  chipRemoveTitle: (by, target) =>
    t('eatFirstCall.speakingQueueRemoveTitle', { by, target }),
  chipViewOnlyTitle: (by, target) =>
    t('eatFirstCall.speakingQueueChipViewOnly', { by, target }),
}))

function onToggleSpeakingMode(): void {
  if (!props.showTools) return
  eatFirstShell.toggleSpeakingMode()
}

function onRemovePair(pairIndex: number): void {
  if (!props.showTools) return
  eatFirstShell.removeSpeakingNominationPairAt(pairIndex)
}

function onClearAll(): void {
  if (!props.showTools) return
  if (speakingQueue.value.length === 0) return
  eatFirstShell.clearSpeakingQueue()
  // Eat First-specific: also flip speaking mode off when the host
  // clears the queue, matching the previous inline behavior.
  if (speakingMode.value) {
    eatFirstShell.toggleSpeakingMode()
  }
}
</script>

<template>
  <GameSpeakingQueueBar
    :segments="segments"
    :speaking-active="speakingMode"
    :show-tools="showTools"
    :labels="labels"
    @toggle-speaking-mode="onToggleSpeakingMode"
    @remove-pair="onRemovePair"
    @clear-all="onClearAll"
  />
</template>
