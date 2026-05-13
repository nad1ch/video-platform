<script setup lang="ts">
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

import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useGameTemplateGameStore } from '@/stores/gameTemplateGame'
import { useGameTemplatePlayersStore } from '@/stores/gameTemplatePlayers'
import GameHostActionsBar, {
  type GameHostActionsLabels,
} from '@/components/game-call/GameHostActionsBar.vue'

const emit = defineEmits<{
  'force-mute-all': [muted: boolean]
}>()

const { t } = useI18n()
const gameStore = useGameTemplateGameStore()
const players = useGameTemplatePlayersStore()
const {
  isGameRoomHost,
  hostInteractionMode,
  forceMuteAllActive,
  everyNonHostEffectivelyMuted,
} = storeToRefs(gameStore)

const muteAllActive = computed(
  () => forceMuteAllActive.value && everyNonHostEffectivelyMuted.value,
)

/**
 * Generic reshuffle gate: at least 2 players. The Mafia adapter
 * additionally distinguished "old mode (>= 2)" vs "new mode (5–12)" via
 * `oldMafiaMode`; that mode toggle does not exist in the generic
 * protocol. The server still caps the upper bound at 12.
 */
const canReshuffle = computed(() => players.joinOrder.length >= 2)

const swapModeActive = computed(() => hostInteractionMode.value === 'swap')

const labels = computed<GameHostActionsLabels>(() => ({
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
}))

function onSetMuteAll(muted: boolean): void {
  if (!isGameRoomHost.value) return
  emit('force-mute-all', muted)
}

function onReshuffle(): void {
  if (!isGameRoomHost.value || !canReshuffle.value) return
  gameStore.reshuffleGame()
}

function onToggleSwapMode(): void {
  if (!isGameRoomHost.value) return
  // Mafia toggled off into 'night'; the generic protocol toggles off into 'idle'.
  gameStore.setHostInteractionMode(swapModeActive.value ? 'idle' : 'swap')
}
</script>

<template>
  <GameHostActionsBar
    v-if="isGameRoomHost"
    :mute-all-active="muteAllActive"
    :can-reshuffle="canReshuffle"
    :swap-active="swapModeActive"
    :labels="labels"
    @set-mute-all="onSetMuteAll"
    @reshuffle="onReshuffle"
    @toggle-swap-mode="onToggleSwapMode"
  />
</template>
