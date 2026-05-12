<script setup lang="ts">
/**
 * GameTemplateHostActionsBar — fork of `MafiaHostActionsBar.vue` for the
 * `/app/game-template` route.
 *
 * Adapter around the shared presentational `<GameHostActionsBar>`. Owns
 * the same Mafia-specific bits as the production adapter:
 *   - host identity gate (`isMafiaHost` v-if)
 *   - reshuffle gate logic (player-count vs `oldMafiaMode`)
 *   - swap-mode 'night' off-sentinel + `setHostInteractionMode` store call
 *   - reshuffle store dispatch (`gameStore.reshuffleGame()`)
 *   - `force-mute-all` outward emit (the call page's existing contract)
 *   - i18n key resolution (`mafiaPage.*`)
 *
 * The button surface (icons, animations, hover transforms, ConfirmDialog
 * mounting) lives in `GameHostActionsBar` under `components/game-call/`,
 * shared with Mafia.
 */

import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useMafiaGameStore } from '@/stores/mafiaGame'
import { useMafiaPlayersStore } from '@/stores/mafiaPlayers'
import GameHostActionsBar, {
  type GameHostActionsLabels,
} from '@/components/game-call/GameHostActionsBar.vue'

const emit = defineEmits<{
  'force-mute-all': [muted: boolean]
}>()

const { t } = useI18n()
const gameStore = useMafiaGameStore()
const players = useMafiaPlayersStore()
const {
  isMafiaHost,
  oldMafiaMode,
  hostInteractionMode,
  mafiaForceMuteAllActive,
  everyNonHostEffectivelyMuted,
} = storeToRefs(gameStore)

const muteAllActive = computed(
  () => mafiaForceMuteAllActive.value && everyNonHostEffectivelyMuted.value,
)

const canReshuffle = computed(() => {
  const n = players.joinOrder.length
  if (oldMafiaMode.value) {
    return n >= 2
  }
  return n >= 5 && n <= 12
})

const swapModeActive = computed(() => hostInteractionMode.value === 'swap')

const labels = computed<GameHostActionsLabels>(() => ({
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
}))

function onSetMuteAll(muted: boolean): void {
  if (!isMafiaHost.value) return
  emit('force-mute-all', muted)
}

function onReshuffle(): void {
  if (!isMafiaHost.value || !canReshuffle.value) return
  gameStore.reshuffleGame()
}

function onToggleSwapMode(): void {
  if (!isMafiaHost.value) return
  gameStore.setHostInteractionMode(swapModeActive.value ? 'night' : 'swap')
}
</script>

<template>
  <GameHostActionsBar
    v-if="isMafiaHost"
    :mute-all-active="muteAllActive"
    :can-reshuffle="canReshuffle"
    :swap-active="swapModeActive"
    :labels="labels"
    @set-mute-all="onSetMuteAll"
    @reshuffle="onReshuffle"
    @toggle-swap-mode="onToggleSwapMode"
  />
</template>
