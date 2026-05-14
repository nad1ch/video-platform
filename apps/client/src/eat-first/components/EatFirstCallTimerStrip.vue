<script setup lang="ts">
/**
 * EatFirstCallTimerStrip — thin adapter around the shared
 * `<GameTimerOverlay>` countdown chip.
 *
 * Public mount shape from `EatFirstCallPage.vue` is preserved 1:1:
 *   - `view-mode`, `is-eat-first-host`, `speaking-total-sec`,
 *     `timer-started-at`, `timer-paused`, `frozen-remaining-sec`, `game-id`
 *
 * Same adapter pattern as `MafiaOverlay.vue` and `GameTemplateOverlay.vue`:
 * presentational chip lives in `components/game-call/GameTimerOverlay.vue`;
 * this file wires Eat First state into the shared props, supplies EF
 * labels, and translates the shared `start(durationMs)` / `stop` emits
 * into the existing `streamassist:eat-first:timer-action` window
 * CustomEvent that `CallPage.vue` listens for. The event detail shape
 * (`{ action: 'timer-start', durationSec }` / `{ action: 'timer-stop' }`)
 * is preserved verbatim so CallPage's WS-dispatch path is unchanged.
 *
 * Eat First-specific carry-over (preserved 1:1 from the inline form):
 *   - **Pause display**: when the server reports `timerPaused === true`
 *     and `frozenRemainingSec` is finite, the chip shows that frozen
 *     value and does NOT tick. Achieved by passing `paused` and
 *     `frozenRemainingMs` to `GameTimerOverlay`.
 *   - **`gameId`-required disabled gate**: the Start/Stop button is
 *     `:disabled` until a `gameId` is present in the route. Passed via
 *     the shared chip's new `disabled` prop.
 *   - **EF preset list (`30 / 60 / 90 / 120 s`)**: same four values the
 *     shared default already ships; passed explicitly for clarity.
 *   - **EF Ukrainian "Стоп" button text**: passed via the shared chip's
 *     optional `labels.stopButton` (Mafia / Game Template don't supply
 *     it and continue to render the historical literal `'Start'` /
 *     `'Stop'`).
 *
 * The absolute-position frame (`position: absolute; inset: 0;
 * z-index: 42; pointer-events: none;`) is preserved as a wrapping
 * `<div>` so the chip lands at the same DOM stacking context as the
 * `<MafiaOverlay>` / `<GameTemplateOverlay>` frames. The chip itself
 * is positioned at the top center by the shared `GameTimerOverlay`
 * styles.
 */

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import GameTimerOverlay, {
  type GameTimerLabels,
  type GameTimerState,
} from '@/components/game-call/GameTimerOverlay.vue'
import { EAT_FIRST_CALL_TIMER_PRESET_MS } from '@/eat-first/constants/eatFirstCallTimerPresets'

/**
 * Eat First's historical default Start duration (third preset = 90 s),
 * pinned explicitly so the shared chip's "last preset" fallback does
 * not silently shift Eat First's default to 120 s. Matches Mafia's
 * `MAFIA_DEFAULT_TIMER_MS`.
 */
const EAT_FIRST_DEFAULT_TIMER_MS = 90_000

const EAT_FIRST_TIMER_ACTION_EVENT = 'streamassist:eat-first:timer-action'

const props = withDefaults(
  defineProps<{
    viewMode: boolean
    isEatFirstHost: boolean
    speakingTotalSec: number | null
    timerStartedAt: string
    timerPaused: boolean
    frozenRemainingSec: number | null
    gameId: string
  }>(),
  {
    timerStartedAt: '',
    gameId: '',
  },
)

const { t } = useI18n()

/**
 * Map Eat First's wire-format timer state (`{ timerStartedAt: ISO,
 * speakingTotalSec, timerPaused, frozenRemainingSec }`) to the shared
 * chip's `GameTimerState` (`{ startedAt: epochMs, durationMs }`).
 *
 * A non-null value is returned whenever the host has started the timer
 * — including the paused branch. The shared chip's pause-aware logic
 * uses `paused` + `frozenRemainingMs` for display while keeping the
 * `timer` non-null so the Start/Stop button shows "Stop".
 */
const sharedTimer = computed<GameTimerState | null>(() => {
  const startedAtStr = props.timerStartedAt.trim()
  if (startedAtStr.length < 1) return null
  const startedAt = Date.parse(startedAtStr)
  if (!Number.isFinite(startedAt)) return null
  const total = Math.max(1, Math.floor(Number(props.speakingTotalSec) || 0))
  return { startedAt, durationMs: total * 1000 }
})

const frozenRemainingMs = computed<number | null>(() => {
  const sec = props.frozenRemainingSec
  if (typeof sec !== 'number' || !Number.isFinite(sec)) return null
  return Math.max(0, Math.floor(sec * 1000))
})

const isHost = computed(() => props.isEatFirstHost)

const disabled = computed(
  () => typeof props.gameId !== 'string' || props.gameId.trim().length < 1,
)

const timerLabels = computed<GameTimerLabels>(() => ({
  countdown: (time) => t('eatFirstCall.timerCountdownAria', { time }),
  durationSec: (n) => t('eatFirstCall.timerPresetSecTitle', { n }),
  // Start/Stop button title + ARIA — distinct strings (`timerStartHint` /
  // `timerStopHint`) preserved verbatim from the previous inline strip.
  start: t('eatFirstCall.timerStartHint'),
  stop: t('eatFirstCall.timerStopHint'),
  controlsAria: t('eatFirstCall.timerControlsAria'),
  durationsAria: t('eatFirstCall.timerDurationsAria'),
  // The pill text — `timerStartLabel` / `timerStopLabel` — overrides the
  // shared chip's hard-coded `'Start'` / `'Stop'` literal so Eat First
  // keeps its Ukrainian "Стоп" button.
  startButton: t('eatFirstCall.timerStartLabel'),
  stopButton: t('eatFirstCall.timerStopLabel'),
}))

function dispatchEatFirstTimerAction(detail: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EAT_FIRST_TIMER_ACTION_EVENT, { detail }))
}

function onStart(durationMs: number): void {
  if (import.meta.env.DEV) {
    console.info('[eat-first:adapter:timer-start]', {
      durationMs,
      isHost: isHost.value,
      viewMode: props.viewMode,
      disabled: disabled.value,
      gameId: props.gameId,
    })
  }
  if (!isHost.value || props.viewMode) return
  if (disabled.value) return
  const durationSec = Math.max(5, Math.floor(durationMs / 1000))
  dispatchEatFirstTimerAction({ action: 'timer-start', durationSec })
}

function onStop(): void {
  if (import.meta.env.DEV) {
    console.info('[eat-first:adapter:timer-stop]', {
      isHost: isHost.value,
      viewMode: props.viewMode,
      disabled: disabled.value,
      gameId: props.gameId,
    })
  }
  if (!isHost.value || props.viewMode) return
  if (disabled.value) return
  dispatchEatFirstTimerAction({ action: 'timer-stop' })
}
</script>

<template>
  <div class="eat-first-call-timer" role="presentation">
    <GameTimerOverlay
      :timer="sharedTimer"
      :is-host="isHost"
      :stream-view="viewMode"
      :paused="timerPaused"
      :frozen-remaining-ms="frozenRemainingMs"
      :disabled="disabled"
      :preset-ms-list="EAT_FIRST_CALL_TIMER_PRESET_MS"
      :default-duration-ms="EAT_FIRST_DEFAULT_TIMER_MS"
      :labels="timerLabels"
      @start="onStart"
      @stop="onStop"
    />
  </div>
</template>

<style scoped>
.eat-first-call-timer {
  position: absolute;
  inset: 0;
  /* Above `.call-page__tile-wrap` elevated states (z-index 35); mirrors
   * `.mafia-overlay` / `.game-template-overlay`. */
  z-index: 42;
  pointer-events: none;
}
</style>
