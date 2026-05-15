<script setup lang="ts">
/**
 * EatFirstHostActionsBar — thin adapter around the shared
 * `<GameHostActionsBar>` toolbar.
 *
 * Same pattern as `MafiaHostActionsBar.vue` and
 * `GameTemplateHostActionsBar.vue`: the presentational button surface +
 * confirm-dialog lifecycle lives in
 * `components/game-call/GameHostActionsBar.vue`; this file only wires
 * Eat First state into the shared props/emits and feeds Eat First i18n
 * keys via the `labels` prop.
 *
 * Eat First-specific carry-over (preserved 1:1 from the inline form):
 *
 *   - The mute-all flag is **local** (no server-authoritative
 *     `forceMuteAllActive` like Mafia / Game Template). Clicking
 *     flips a local ref AND emits `force-mute-all` so CallPage can
 *     dispatch `eat:force-mute-all`.
 *
 *   - The reshuffle gate uses
 *     `Math.max(playerOrder, playerCount, connectedPlayerCount) >= 2`
 *     because Eat First may have remote players counted in
 *     `connectedPlayerCount` before `playerOrder` is populated.
 *
 *   - The swap-mode button is visible (Choice A — Mafia / Game Template
 *     parity). Toggling enters / exits the shell store's
 *     `hostInteractionMode === 'swap'`; the actual positional swap is
 *     committed by `CallPage`'s tile-click router via
 *     `eatFirstShell.swapEatFirstSlotsInPlayerOrder`, then broadcast on
 *     the existing `eat:players-update` WS path.
 *
 *   - The destructive reshuffle confirm dialog (server-authoritative
 *     `eat:table-round-deal` wipes the reveal ledger, marks every
 *     action card unused, regenerates traits, and resets the speaking
 *     queue) is now owned by the shared bar via its own
 *     `<ConfirmDialog>` mount. The dialog text comes from
 *     `eatFirstCall.reshuffleConfirm*` i18n keys.
 *
 * Public emit contract preserved for `CallPage.vue`:
 *   - `force-mute-all [muted: boolean]`
 *   - `reshuffle []`
 */

import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useEatFirstCallShellStore } from '@/stores/eatFirstCallShell'
import GameHostActionsBar, {
  type GameHostActionsLabels,
} from '@/components/game-call/GameHostActionsBar.vue'

const emit = defineEmits<{
  'force-mute-all': [muted: boolean]
  reshuffle: []
}>()

const { t } = useI18n()
const eatFirstShell = useEatFirstCallShellStore()
const {
  isEatFirstRoomHost,
  playerOrder,
  playerCount,
  connectedPlayerCount,
  hostInteractionMode,
} = storeToRefs(eatFirstShell)

/**
 * Local mute-all state — Eat First does NOT carry a
 * server-authoritative mute-all flag like Mafia's
 * `mafiaForceMuteAllActive`. The original inline component flipped a
 * local ref on each click; preserved 1:1 here.
 */
const muteAllActive = ref(false)

const canReshuffle = computed(
  () =>
    Math.max(playerOrder.value.length, playerCount.value, connectedPlayerCount.value) >= 2,
)

const swapModeActive = computed(() => hostInteractionMode.value === 'swap')

const labels = computed<GameHostActionsLabels>(() => ({
  toolbarAria: t('eatFirstCall.hostActionsAria'),
  muteAllTitle: t('eatFirstCall.forceMuteAllTitle'),
  reshuffleTitle: t('eatFirstCall.reshuffleOrderTitle'),
  reshuffleDisabledHint: t('eatFirstCall.reshuffleOrderHint'),
  swapModeTitle: t('eatFirstCall.swapModeHint'),
  swapModeAria: t('eatFirstCall.modeSwap'),
  reshuffleConfirmTitle: t('eatFirstCall.reshuffleConfirmTitle'),
  reshuffleConfirmBody: t('eatFirstCall.reshuffleConfirmMessage'),
  reshuffleConfirmProceed: t('eatFirstCall.reshuffleConfirmAction'),
  reshuffleConfirmCancel: t('eatFirstCall.reshuffleConfirmCancel'),
}))

function onSetMuteAll(muted: boolean): void {
  if (!isEatFirstRoomHost.value) return
  muteAllActive.value = muted
  emit('force-mute-all', muted)
}

function onReshuffle(): void {
  if (!isEatFirstRoomHost.value || !canReshuffle.value) return
  emit('reshuffle')
}

/**
 * Toggle positional swap mode (Choice A — Mafia / Game Template parity).
 * The shared bar's swap button is now visible (`show-swap` defaults to
 * `true`). Mutual-exclusion with speaking mode is enforced inside the
 * shell's `setHostInteractionMode` setter so the host's first tile click
 * routes through swap, not nomination.
 */
function onToggleSwapMode(): void {
  if (!isEatFirstRoomHost.value) return
  eatFirstShell.setHostInteractionMode(swapModeActive.value ? 'idle' : 'swap')
}
</script>

<template>
  <GameHostActionsBar
    v-if="isEatFirstRoomHost"
    :mute-all-active="muteAllActive"
    :can-reshuffle="canReshuffle"
    :swap-active="swapModeActive"
    :labels="labels"
    @set-mute-all="onSetMuteAll"
    @reshuffle="onReshuffle"
    @toggle-swap-mode="onToggleSwapMode"
  />
</template>
