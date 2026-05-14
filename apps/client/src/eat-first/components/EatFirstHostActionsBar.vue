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
 *   - The swap-mode button is hidden via `:show-swap="false"` on the
 *     shared bar — Eat First does not have a generic swap-mode
 *     mechanic in its protocol.
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
const { isEatFirstRoomHost, playerOrder, playerCount, connectedPlayerCount } =
  storeToRefs(eatFirstShell)

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

const labels = computed<GameHostActionsLabels>(() => ({
  toolbarAria: t('eatFirstCall.hostActionsAria'),
  muteAllTitle: t('eatFirstCall.forceMuteAllTitle'),
  reshuffleTitle: t('eatFirstCall.reshuffleOrderTitle'),
  reshuffleDisabledHint: t('eatFirstCall.reshuffleOrderHint'),
  // Swap button is hidden via `show-swap="false"`; these strings are
  // never rendered but the `GameHostActionsLabels` interface requires
  // them. Use empty strings rather than fake i18n keys.
  swapModeTitle: '',
  swapModeAria: '',
  reshuffleConfirmTitle: t('eatFirstCall.reshuffleConfirmTitle'),
  reshuffleConfirmBody: t('eatFirstCall.reshuffleConfirmMessage'),
  reshuffleConfirmProceed: t('eatFirstCall.reshuffleConfirmAction'),
  reshuffleConfirmCancel: t('eatFirstCall.reshuffleConfirmCancel'),
}))

function onSetMuteAll(muted: boolean): void {
  if (import.meta.env.DEV) {
    console.info('[eat-first:adapter:mute-all]', {
      muted,
      isHost: isEatFirstRoomHost.value,
    })
  }
  if (!isEatFirstRoomHost.value) return
  muteAllActive.value = muted
  emit('force-mute-all', muted)
}

function onReshuffle(): void {
  if (import.meta.env.DEV) {
    console.info('[eat-first:adapter:reshuffle]', {
      isHost: isEatFirstRoomHost.value,
      canReshuffle: canReshuffle.value,
      playerOrderLength: eatFirstShell.playerOrder.length,
      playerCount: eatFirstShell.playerCount,
      connectedPlayerCount: eatFirstShell.connectedPlayerCount,
    })
  }
  if (!isEatFirstRoomHost.value || !canReshuffle.value) return
  emit('reshuffle')
}

/**
 * Swap-mode is hidden in this adapter (`:show-swap="false"`). The
 * shared bar still declares the `toggle-swap-mode` emit type; it will
 * never fire while the button is `v-if`-ed out, but we keep a no-op
 * handler so any future regression that re-renders the button does
 * not crash on a missing listener.
 */
function onToggleSwapModeNoop(): void {
  /* no-op — swap mode hidden for Eat First */
}
</script>

<template>
  <GameHostActionsBar
    v-if="isEatFirstRoomHost"
    :mute-all-active="muteAllActive"
    :can-reshuffle="canReshuffle"
    :swap-active="false"
    :show-swap="false"
    :labels="labels"
    @set-mute-all="onSetMuteAll"
    @reshuffle="onReshuffle"
    @toggle-swap-mode="onToggleSwapModeNoop"
  />
</template>
