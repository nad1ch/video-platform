<script setup lang="ts">
/**
 * GameTimerOverlay — shared presentational countdown chip for game-call pages.
 *
 * Extracted from `MafiaOverlay.vue` in Phase 5a so production Mafia and the
 * reusable Game Template can share one timer surface. Production Mafia keeps
 * owning the timer protocol (start/stop go through `mafiaGameStore`); this
 * component renders the chip and emits `start(durationMs)` / `stop()` — the
 * mounting adapter decides what to do with them.
 *
 * Hard isolation: NO imports from any production Mafia store, composable,
 * signaling, or i18n keys. All locale strings arrive via the `labels` prop so
 * the same component can be mounted by:
 *   - `MafiaOverlay.vue`         → Mafia adapter (labels from `mafiaPage.*`)
 *   - `GameTemplatePage.vue`     → demo adapter
 *   - future game pages          → game-specific adapter
 *
 * Visual scope preserved 1:1 from the original `MafiaOverlay` header chip:
 *   - stopwatch icon (left), monospaced m:ss text, optional host controls
 *   - host controls: N preset chips + Start/Stop pill (preset list injectable)
 *   - compact layout (`compact={true}` → 112px wide, no controls grid column)
 *   - `call-floating-surface` glass pill background (shared utility CSS)
 *   - 1 s tick runs only while the timer is running (no idle wakes)
 *
 * Class names are renamed `game-timer-overlay__*` (was `mafia-overlay__*`)
 * because the previous class set existed only inside one file. Renaming is
 * a no-op for any external selector (`grep` confirmed zero external refs).
 */

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { GAME_TIMER_PRESET_MS } from '@/utils/gameTimerPresets'
import mafiaTimerClock from '@/assets/mafia/ui/timer-clock.svg'

export interface GameTimerState {
  /** Wall-clock epoch ms when the timer started. */
  startedAt: number
  /** Total duration in ms. */
  durationMs: number
}

export interface GameTimerLabels {
  /**
   * ARIA-live label for the countdown `<span role="timer">`. Receives the
   * formatted `m:ss` time string.
   */
  countdown: (time: string) => string
  /**
   * Title + ARIA label for each preset chip. Receives the preset seconds.
   */
  durationSec: (sec: number) => string
  /** Title + ARIA label for the start button. */
  start: string
  /** Title + ARIA label for the stop button. */
  stop: string
  /** ARIA-label for the controls `<div role="group">`. */
  controlsAria: string
  /** ARIA-label for the presets `<div role="group">`. */
  durationsAria: string
}

const props = withDefaults(
  defineProps<{
    /** Server-authoritative timer state. `null` = not running. */
    timer: GameTimerState | null
    /** When true, host controls (presets + Start/Stop) render. */
    isHost?: boolean
    /**
     * When true (e.g. Mafia `?mode=view`), host controls are hidden even if
     * `isHost` is true. The chip itself stays visible (read-only).
     */
    streamView?: boolean
    /**
     * Compact layout (no controls visible → narrow chip). Mafia maps this to
     * `useCompactTimer = !showTimerControls`.
     */
    compact?: boolean
    /**
     * Preset durations in milliseconds. Defaults to the shared
     * `GAME_TIMER_PRESET_MS` constant (currently 30 / 60 / 90 / 120 s) —
     * the same tuple Mafia's `MAFIA_TIMER_PRESET_MS` resolves to.
     */
    presetMsList?: readonly number[]
    /**
     * Initial preset selected when the chip mounts (host's default Start).
     * Falls back to the last preset in `presetMsList` if not provided. Mafia
     * passes `90_000` to preserve the historical default after the 120 s
     * preset was added in Phase 5b.
     */
    defaultDurationMs?: number
    /** i18n strings (required so the component is locale-free). */
    labels: GameTimerLabels
  }>(),
  {
    isHost: false,
    streamView: false,
    compact: false,
    defaultDurationMs: undefined,
    // `withDefaults` hoists this factory above setup() — but importing a
    // module-scope `const` is fine; the compiler-sfc rule only forbids
    // referencing setup-scope locals. `GAME_TIMER_PRESET_MS` is a module
    // import, so this is safe.
    presetMsList: () => GAME_TIMER_PRESET_MS,
  },
)

const emit = defineEmits<{
  start: [durationMs: number]
  stop: []
}>()

const nowMs = ref<number>(Date.now())
let tickInterval: ReturnType<typeof setInterval> | null = null

function startTickIfNeeded(): void {
  if (tickInterval != null) return
  nowMs.value = Date.now()
  tickInterval = setInterval(() => {
    nowMs.value = Date.now()
  }, 1000)
}
function stopTick(): void {
  if (tickInterval != null) {
    clearInterval(tickInterval)
    tickInterval = null
  }
}

const remainingMs = computed<number>(() => {
  const t = props.timer
  if (t == null) return 0
  const elapsed = Math.max(0, nowMs.value - t.startedAt)
  return Math.max(0, t.durationMs - elapsed)
})

const isRunning = computed<boolean>(() => props.timer != null && remainingMs.value > 0)

const showHostControls = computed<boolean>(() => props.isHost && !props.streamView)

/**
 * The 1 s tick previously ran for the whole life of `MafiaPage` even when no
 * timer was running, idly waking the JS loop every second. We start/stop it
 * strictly around the `isRunning` transition so an idle room is fully quiet.
 * Preserved 1:1 from `MafiaOverlay.vue`.
 */
watch(
  isRunning,
  (running) => {
    if (running) {
      startTickIfNeeded()
    } else {
      stopTick()
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => stopTick())

function formatMmss(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Host-selected preset for the next Start press. Mirrors `selectedDurationMs`
 * in the original `MafiaOverlay`: defaults to `defaultDurationMs` if it is a
 * member of the preset list, otherwise the last preset. Persists across
 * Start/Stop cycles so the host doesn't need to re-pick it.
 */
const FALLBACK_PRESET_MS = 90_000

function pickInitialPreset(
  defaultMs: number | undefined,
  list: readonly number[],
): number {
  if (defaultMs != null && list.includes(defaultMs)) return defaultMs
  return list[list.length - 1] ?? FALLBACK_PRESET_MS
}

const selectedDurationMs = ref<number>(
  pickInitialPreset(props.defaultDurationMs, props.presetMsList),
)

// Keep selectedDurationMs valid if the host swaps the preset list mid-life
// (rare; defensive).
watch(
  () => props.presetMsList,
  (list) => {
    if (!list.includes(selectedDurationMs.value)) {
      selectedDurationMs.value = pickInitialPreset(props.defaultDurationMs, list)
    }
  },
)

const timerDisplay = computed<string | null>(() => {
  if (!isRunning.value) return null
  return formatMmss(remainingMs.value)
})

const timerIdleDisplay = computed<string>(() => formatMmss(selectedDurationMs.value))

const timerText = computed<string>(() => timerDisplay.value ?? timerIdleDisplay.value)

const useCompactTimer = computed<boolean>(() => props.compact || !showHostControls.value)

function onSelectDuration(ms: number): void {
  if (!showHostControls.value) return
  selectedDurationMs.value = ms
}

function onToggleTimer(): void {
  if (!showHostControls.value) return
  if (isRunning.value) {
    emit('stop')
    return
  }
  emit('start', selectedDurationMs.value)
}
</script>

<template>
  <div
    class="game-timer-overlay call-floating-surface"
    :class="{ 'game-timer-overlay--compact': useCompactTimer }"
  >
    <div
      class="game-timer-overlay__main"
      :class="{ 'game-timer-overlay__main--compact': useCompactTimer }"
    >
      <img class="game-timer-overlay__stopwatch" :src="mafiaTimerClock" alt="" aria-hidden="true" />
      <span
        class="game-timer-overlay__text game-timer-overlay__text--mono"
        role="timer"
        :aria-label="labels.countdown(timerText)"
      >
        {{ timerText }}
      </span>
      <div
        v-if="showHostControls"
        class="game-timer-overlay__ctrls"
        role="group"
        :aria-label="labels.controlsAria"
      >
        <div
          class="game-timer-overlay__presets"
          role="group"
          :aria-label="labels.durationsAria"
        >
          <button
            v-for="ms in presetMsList"
            :key="ms"
            type="button"
            class="sa-chip-btn game-timer-overlay__preset"
            :class="{ 'game-timer-overlay__preset--active': selectedDurationMs === ms }"
            :title="labels.durationSec(ms / 1000)"
            :aria-label="labels.durationSec(ms / 1000)"
            :aria-pressed="selectedDurationMs === ms"
            @click="onSelectDuration(ms)"
          >
            {{ ms / 1000 }}
          </button>
        </div>
        <button
          type="button"
          class="sa-chip-btn game-timer-overlay__action game-timer-overlay__action--start"
          :title="isRunning ? labels.stop : labels.start"
          :aria-label="isRunning ? labels.stop : labels.start"
          @click="onToggleTimer"
        >
          {{ isRunning ? 'Stop' : 'Start' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped src="@/components/call/callFloatingSurface.css"></style>

<style scoped>
/*
 * Class set + dimensions ported verbatim from the original
 * `MafiaOverlay.vue` (Phase 5a extraction). Only the namespace changed
 * (`mafia-overlay__*` → `game-timer-overlay__*`); every numeric value,
 * font token, shadow, transform, and breakpoint is preserved.
 *
 * The `.mafia-overlay` absolute wrapper that previously framed this chip
 * stays in `MafiaOverlay.vue` so the production page layout is unchanged.
 */

.game-timer-overlay {
  position: absolute;
  top: calc(max(0px, env(safe-area-inset-top, 0px)) + 6px);
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 297px;
  max-width: calc(100vw - 16px);
  min-height: 42px;
  padding: 0;
  border: 0;
  border-radius: 27px;
  background: rgb(60 36 99 / 0.68);
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  pointer-events: auto;
}

.game-timer-overlay--compact {
  width: 112px;
}

.game-timer-overlay__main {
  display: grid;
  grid-template-columns: 24px 54px minmax(0, 1fr);
  align-items: center;
  column-gap: 8px;
  width: 100%;
  height: 42px;
  padding: 0 12px;
  box-sizing: border-box;
  min-width: 0;
}

.game-timer-overlay__main--compact {
  grid-template-columns: 24px 54px;
  column-gap: 8px;
}

.game-timer-overlay__ctrls {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  margin-left: 4px;
}

.game-timer-overlay__presets {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.game-timer-overlay__preset {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  min-width: 38px;
  min-height: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 21px;
  background: rgb(102 56 143 / 0.34);
  color: rgb(255 255 255 / 0.94);
  font-family: var(--app-timer-digits);
  font-size: 12px;
  font-weight: 800;
  font-variant-numeric: lining-nums tabular-nums;
  font-feature-settings: 'lnum' 1, 'tnum' 1;
  line-height: 1;
  letter-spacing: 0.01em;
  text-align: center;
}

.game-timer-overlay__preset--active {
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.18);
}

.game-timer-overlay__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 53px;
  min-width: 53px;
  min-height: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 21px;
  background: rgb(102 56 143 / 0.34);
  color: rgb(255 255 255 / 0.94);
  font-family: var(--app-timer-digits);
  font-size: 12px;
  font-weight: 800;
  font-variant-numeric: lining-nums tabular-nums;
  font-feature-settings: 'lnum' 1, 'tnum' 1;
  line-height: 1;
  letter-spacing: 0.01em;
  text-align: center;
}

.game-timer-overlay__stopwatch {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: block;
  object-fit: contain;
  align-self: center;
}

.game-timer-overlay__text {
  font-family: var(--app-timer-digits);
  font-size: 21px;
  font-weight: 800;
  line-height: 1;
  color: rgb(255 255 255 / 0.94);
  transform: translateY(-1px);
}

.game-timer-overlay__text--mono {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
  letter-spacing: 0.01em;
}
</style>
