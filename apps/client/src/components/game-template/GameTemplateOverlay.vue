<script setup lang="ts">
/**
 * GameTemplateOverlay — fork of `MafiaOverlay.vue` for `/app/game-template`.
 *
 * Owns the same surface as the Mafia adapter:
 *   - host identity gate (`isMafiaHost` from the Mafia store)
 *   - "old Mafia mode" panel-visibility rule (`!oldMafiaMode || isMafiaHost`)
 *   - the timer store contract (`mafiaGame.startTimer(ms)` / `stopTimer()`)
 *   - `MAFIA_TIMER_PRESET_MS` preset list
 *   - i18n key resolution (`mafiaPage.timer*`)
 *   - the absolute-positioning wrapper that frames the chip on the call stage
 *
 * The chip itself (countdown text, preset chips, Start/Stop button, 1 s
 * tick, compact layout) is owned by the shared `<GameTimerOverlay>` in
 * `components/game-call` and consumed unchanged.
 *
 * The Mafia store is reused intentionally (initial fork is 1:1 behaviour
 * with Mafia, including the host claim / timer protocol). Generalising
 * the timer store is future work, behind a server-side namespace.
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
 * Same default the Mafia overlay pins (third preset = 90 s). Kept explicit
 * so adding a larger preset to the shared list does not silently shift
 * Game Template's default to the new largest value.
 */
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
const gameStore = useMafiaGameStore()
const { isMafiaHost, mafiaTimer, oldMafiaMode } = storeToRefs(gameStore)

const showTimerPanel = computed(() => !oldMafiaMode.value || isMafiaHost.value)
const showTimerControls = computed(() => isMafiaHost.value && !isViewLayout.value)
const useCompactTimer = computed(() => !showTimerControls.value)

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
  gameStore.startTimer(durationMs)
}

function onStop(): void {
  gameStore.stopTimer()
}
</script>

<template>
  <div class="game-template-overlay" role="presentation">
    <GameTimerOverlay
      v-if="showTimerPanel"
      :timer="sharedTimer"
      :is-host="isMafiaHost"
      :stream-view="isViewLayout"
      :compact="useCompactTimer"
      :preset-ms-list="MAFIA_TIMER_PRESET_MS"
      :default-duration-ms="GAME_TEMPLATE_DEFAULT_TIMER_MS"
      :labels="timerLabels"
      @start="onStart"
      @stop="onStop"
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
