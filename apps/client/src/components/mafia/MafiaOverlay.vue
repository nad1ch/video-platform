<script setup lang="ts">
/**
 * MafiaOverlay — Mafia adapter around the shared `<GameTimerOverlay>` chip.
 *
 * Owns the Mafia-specific bits (Phase 5a extraction):
 *   - host identity gate (`isMafiaHost`)
 *   - "old Mafia mode" panel-visibility rule (`!oldMafiaMode || isMafiaHost`)
 *   - the timer store contract (`mafiaGame.startTimer(ms)` / `stopTimer()`)
 *   - `MAFIA_TIMER_PRESET_MS` preset list
 *   - i18n key resolution (`mafiaPage.timer*`)
 *   - the absolute-positioning wrapper that frames the chip on the call stage
 *
 * The chip itself (countdown text, preset chips, Start/Stop button, 1 s tick,
 * compact layout) is now owned by `GameTimerOverlay` in `components/game-call`.
 * That component is store-free and consumed only via this adapter today;
 * future games can mount it directly with their own labels + adapter.
 */

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { MAFIA_TIMER_PRESET_MS, useMafiaGameStore } from '@/stores/mafiaGame'
import GameTimerOverlay, {
  type GameTimerLabels,
  type GameTimerState,
} from '@/components/game-call/GameTimerOverlay.vue'

/**
 * Mafia's historical default Start duration (third preset = 90 s). Pinned
 * explicitly here so adding 120 s to the shared preset list does not silently
 * shift Mafia's default to the new largest value.
 */
const MAFIA_DEFAULT_TIMER_MS = 90_000

const props = withDefaults(
  defineProps<{
    streamView?: boolean
    viewMode?: boolean
  }>(),
  { streamView: false, viewMode: undefined },
)

const isViewLayout = computed(() => Boolean(props.viewMode ?? props.streamView))

const { t } = useI18n()
const mafiaGame = useMafiaGameStore()
const { isMafiaHost, mafiaTimer, oldMafiaMode } = storeToRefs(mafiaGame)

const showTimerPanel = computed(() => !oldMafiaMode.value || isMafiaHost.value)
const showTimerControls = computed(() => isMafiaHost.value && !isViewLayout.value)
const useCompactTimer = computed(() => !showTimerControls.value)

/**
 * Map the Mafia store's `MafiaTimerState` (`{ startedAt, duration, isRunning }`)
 * to the shared component's `GameTimerState` (`{ startedAt, durationMs }`).
 * The shared component derives `isRunning` from the remaining ms — pass `null`
 * whenever the Mafia store says it isn't running, so the shared component
 * never inspects the store-specific `isRunning` flag.
 */
const sharedTimer = computed<GameTimerState | null>(() => {
  const t = mafiaTimer.value
  if (t == null || !t.isRunning) return null
  return { startedAt: t.startedAt, durationMs: t.duration }
})

const timerLabels = computed<GameTimerLabels>(() => ({
  countdown: (time) => t('mafiaPage.timerCountdown', { time }),
  durationSec: (n) => t('mafiaPage.timerSecTitle', { n }),
  start: t('mafiaPage.timerStartButton'),
  stop: t('mafiaPage.timerStopButton'),
  controlsAria: t('mafiaPage.timerControlsAria'),
  durationsAria: t('mafiaPage.timerDurationsAria'),
}))

function onStart(durationMs: number): void {
  mafiaGame.startTimer(durationMs)
}

function onStop(): void {
  mafiaGame.stopTimer()
}
</script>

<template>
  <div class="mafia-overlay" role="presentation">
    <GameTimerOverlay
      v-if="showTimerPanel"
      :timer="sharedTimer"
      :is-host="isMafiaHost"
      :stream-view="isViewLayout"
      :compact="useCompactTimer"
      :preset-ms-list="MAFIA_TIMER_PRESET_MS"
      :default-duration-ms="MAFIA_DEFAULT_TIMER_MS"
      :labels="timerLabels"
      @start="onStart"
      @stop="onStop"
    />
  </div>
</template>

<style scoped>
.mafia-overlay {
  position: absolute;
  inset: 0;
  /* Above `.call-page__tile-wrap` elevated states (z-index 35); see `MafiaPage` hover override. */
  z-index: 42;
  pointer-events: none;
}
</style>
