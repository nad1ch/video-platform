<script setup lang="ts">
/**
 * GameTemplateOverlay — Phase 3C.
 *
 * Switched off the Mafia stack. Now reads timer + host identity from the
 * generic `useGameTemplateGameStore`. The old/new Mafia mode gate
 * (`!oldMafiaMode || isMafiaHost`) is REMOVED — the generic protocol has
 * no mode toggle, so the timer chip is always visible (the chip itself is
 * a no-op when no timer is running and the user is not a host with
 * controls).
 *
 * Chip rendering remains the shared `<GameTimerOverlay>` from
 * `components/game-call/`; the change here is the data source and the
 * gate.
 */

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import {
  GAME_ROOM_TIMER_PRESET_MS,
  useGameTemplateGameStore,
} from '@/stores/gameTemplateGame'
import GameTimerOverlay, {
  type GameTimerLabels,
  type GameTimerState,
} from '@/components/game-call/GameTimerOverlay.vue'

const GAME_TEMPLATE_DEFAULT_TIMER_MS = 90_000

const props = withDefaults(
  defineProps<{
    streamView?: boolean
    viewMode?: boolean
  }>(),
  { streamView: false, viewMode: undefined },
)

const isViewLayout = computed(() => Boolean(props.viewMode ?? props.streamView))

const { t } = useI18n()
const gameStore = useGameTemplateGameStore()
const { isGameRoomHost, timer, selectedTimerDurationMs } = storeToRefs(gameStore)

const showTimerControls = computed(() => isGameRoomHost.value && !isViewLayout.value)
const useCompactTimer = computed(() => !showTimerControls.value)

const sharedTimer = computed<GameTimerState | null>(() => {
  const t = timer.value
  if (t == null || !t.isRunning) return null
  return { startedAt: t.startedAt, durationMs: t.duration }
})

const timerLabels = computed<GameTimerLabels>(() => ({
  countdown: (time) => t('gameRoom.timerCountdown', { time }),
  durationSec: (n) => t('gameRoom.timerSecTitle', { n }),
  start: t('gameRoom.timerStartButton'),
  stop: t('gameRoom.timerStopButton'),
  controlsAria: t('gameRoom.timerControlsAria'),
  durationsAria: t('gameRoom.timerDurationsAria'),
}))

function onStart(durationMs: number): void {
  gameStore.startTimer(durationMs)
}

function onStop(): void {
  gameStore.stopTimer()
}

function onSelectDuration(durationMs: number): void {
  gameStore.selectTimerPreset(durationMs)
}
</script>

<template>
  <div class="game-template-overlay" role="presentation">
    <GameTimerOverlay
      :timer="sharedTimer"
      :is-host="isGameRoomHost"
      :stream-view="isViewLayout"
      :compact="useCompactTimer"
      :preset-ms-list="GAME_ROOM_TIMER_PRESET_MS"
      :default-duration-ms="GAME_TEMPLATE_DEFAULT_TIMER_MS"
      :selected-duration-ms="selectedTimerDurationMs"
      :labels="timerLabels"
      @start="onStart"
      @stop="onStop"
      @select-duration="onSelectDuration"
    />
  </div>
</template>

<style scoped>
.game-template-overlay {
  position: absolute;
  inset: 0;
  /* Above `.call-page__tile-wrap` elevated states (z-index 35); see GameTemplatePage hover override. */
  z-index: 42;
  pointer-events: none;
}
</style>
