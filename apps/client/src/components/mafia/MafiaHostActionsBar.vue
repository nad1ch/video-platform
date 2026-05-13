<script setup lang="ts">
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
const mafia = useMafiaGameStore()
const mafiaPlayers = useMafiaPlayersStore()
const {
  isMafiaHost,
  oldMafiaMode,
  hostInteractionMode,
  mafiaForceMuteAllActive,
  everyNonHostEffectivelyMuted,
} = storeToRefs(mafia)

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
const muteAllActive = computed(
  () => mafiaForceMuteAllActive.value && everyNonHostEffectivelyMuted.value,
)

const canReshuffle = computed(() => {
  const n = mafiaPlayers.joinOrder.length
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
  mafia.reshuffleGame()
}

function onToggleSwapMode(): void {
  if (!isMafiaHost.value) return
  mafia.setHostInteractionMode(swapModeActive.value ? 'night' : 'swap')
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
