<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { MAFIA_TIMER_PRESET_MS, useMafiaGameStore } from '@/stores/mafiaGame'
import mafiaTimerClock from '@/assets/mafia/ui/timer-clock.svg'

const props = withDefaults(
  defineProps<{
    /** Back-compat; prefer `viewMode`. */
    streamView?: boolean
    /** Mafia `?mode=view` — timer only, no host controls. */
    viewMode?: boolean
  }>(),
  { streamView: false, viewMode: undefined },
)

const isViewLayout = computed(() => Boolean(props.viewMode ?? props.streamView))

const { t } = useI18n()
const mafiaGame = useMafiaGameStore()
const { isMafiaHost, mafiaTimer, oldMafiaMode } = storeToRefs(mafiaGame)

const nowMs = ref(Date.now())
let nowTick: ReturnType<typeof setInterval> | undefined

const selectedDurationMs = ref<(typeof MAFIA_TIMER_PRESET_MS)[number]>(MAFIA_TIMER_PRESET_MS[2]!)

const remainingMs = computed(() => {
  const t = mafiaTimer.value
  if (t == null || !t.isRunning) {
    return 0
  }
  return Math.max(0, t.duration - (nowMs.value - t.startedAt))
})

const timerDisplay = computed(() => {
  if (mafiaTimer.value == null || !mafiaTimer.value.isRunning) {
    return null
  }
  const totalSec = Math.floor(remainingMs.value / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
})

const showTimerControls = computed(() => isMafiaHost.value && !isViewLayout.value)
const showTimerPanel = computed(() => !oldMafiaMode.value || isMafiaHost.value)

const timerIdleDisplay = computed(() => {
  const totalSec = Math.floor(selectedDurationMs.value / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
})

const timerText = computed(() => timerDisplay.value ?? timerIdleDisplay.value)
const useCompactTimer = computed(() => !showTimerControls.value)

onMounted(() => {
  nowTick = setInterval(() => {
    nowMs.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (nowTick != null) {
    clearInterval(nowTick)
    nowTick = undefined
  }
})

function onSelectDuration(ms: (typeof MAFIA_TIMER_PRESET_MS)[number]): void {
  selectedDurationMs.value = ms
}

function onToggleTimer(): void {
  if (mafiaTimer.value?.isRunning) {
    mafiaGame.stopTimer()
    return
  }
  mafiaGame.startTimer(selectedDurationMs.value)
}
</script>

<template>
  <div class="mafia-overlay" role="presentation">
    <div
      v-if="showTimerPanel"
      class="mafia-overlay__header call-floating-surface"
      :class="{ 'mafia-overlay__header--compact': useCompactTimer }"
    >
      <div
        class="mafia-overlay__header-main"
        :class="{ 'mafia-overlay__header-main--compact': useCompactTimer }"
      >
        <img class="mafia-overlay__timer-stopwatch" :src="mafiaTimerClock" alt="" aria-hidden="true" />
        <span
          class="mafia-overlay__timer-text mafia-overlay__timer-text--mono"
          role="timer"
          :aria-label="t('mafiaPage.timerCountdown', { time: timerText })"
        >
          {{ timerText }}
        </span>
        <div
          v-if="showTimerControls"
          class="mafia-overlay__timer-ctrls"
          role="group"
          :aria-label="t('mafiaPage.timerControlsAria')"
        >
          <div
            class="mafia-overlay__timer-presets"
            role="group"
            :aria-label="t('mafiaPage.timerDurationsAria')"
          >
            <button
              v-for="ms in MAFIA_TIMER_PRESET_MS"
              :key="ms"
              type="button"
              class="sa-chip-btn mafia-overlay__timer-preset"
              :class="{ 'mafia-overlay__timer-preset--active': selectedDurationMs === ms }"
              :title="t('mafiaPage.timerSecTitle', { n: ms / 1000 })"
              :aria-label="t('mafiaPage.timerSecTitle', { n: ms / 1000 })"
              :aria-pressed="selectedDurationMs === ms"
              @click="onSelectDuration(ms)"
            >
              {{ ms / 1000 }}
            </button>
          </div>
          <button
            type="button"
            class="sa-chip-btn mafia-overlay__timer-action mafia-overlay__timer-action--start"
            :title="mafiaTimer?.isRunning ? t('mafiaPage.timerStopButton') : t('mafiaPage.timerStartButton')"
            :aria-label="mafiaTimer?.isRunning ? t('mafiaPage.timerStopButton') : t('mafiaPage.timerStartButton')"
            @click="onToggleTimer"
          >
            {{ mafiaTimer?.isRunning ? 'Stop' : 'Start' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="@/components/call/callFloatingSurface.css"></style>

<style scoped>
/* Stacking: below call dock (40) and tile menus (40); above call grid stage. */
.mafia-overlay {
  position: absolute;
  inset: 0;
  z-index: 28;
  pointer-events: none;
}

/* Layout + spacing: matches `.call-page__dock` flex / padding / max-width. */
.mafia-overlay__header {
  position: absolute;
  top: calc(max(0px, env(safe-area-inset-top, 0px)) + 6px);
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 277px;
  max-width: calc(100vw - 16px);
  min-height: 39px;
  padding: 0;
  border: 0;
  border-radius: 25.268px;
  background: rgb(60 36 99 / 0.68);
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  pointer-events: auto;
}

.mafia-overlay__header--compact {
  width: 102px;
}

.mafia-overlay__header-main {
  display: grid;
  grid-template-columns: 22px 50px minmax(0, 1fr);
  align-items: center;
  column-gap: 7px;
  width: 100%;
  height: 39px;
  padding: 0 11px;
  box-sizing: border-box;
  min-width: 0;
}

.mafia-overlay__header-main--compact {
  grid-template-columns: 22px 50px;
  column-gap: 7px;
}

.mafia-overlay__timer-ctrls {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  margin-left: 4px;
}

.mafia-overlay__timer-presets {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.mafia-overlay__timer-preset {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 35px;
  min-width: 35px;
  min-height: 23.896px;
  height: 23.896px;
  padding: 0;
  border: 0;
  border-radius: 19.234px;
  background: rgb(102 56 143 / 0.34);
  color: rgb(255 255 255 / 0.94);
  font-family: var(--app-home-counter, 'Coda Caption', var(--sa-font-display, system-ui, sans-serif));
  font-size: 11.345px;
  font-weight: 800;
  font-variant-numeric: lining-nums tabular-nums;
  font-feature-settings: 'lnum' 1, 'tnum' 1;
  line-height: 1;
  letter-spacing: -0.6807px;
  text-align: center;
}

.mafia-overlay__timer-preset--active {
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.18);
}

.mafia-overlay__timer-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 49px;
  min-width: 49px;
  min-height: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 19.234px;
  background: rgb(102 56 143 / 0.34);
  color: rgb(255 255 255 / 0.94);
  font-family: var(--app-home-counter, 'Coda Caption', var(--sa-font-display, system-ui, sans-serif));
  font-size: 11.345px;
  font-weight: 800;
  font-variant-numeric: lining-nums tabular-nums;
  font-feature-settings: 'lnum' 1, 'tnum' 1;
  line-height: 1;
  letter-spacing: -0.6807px;
  text-align: center;
}

.mafia-overlay__timer-stopwatch {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  display: block;
  object-fit: contain;
  align-self: center;
}

/* Typography aligned with `.call-page__toast` / call HUD. */
.mafia-overlay__timer-text {
  font-family: var(--app-home-counter, 'Coda Caption', var(--sa-font-display, system-ui, sans-serif));
  font-size: 20px;
  font-weight: 800;
  line-height: 1;
  color: rgb(255 255 255 / 0.94);
  transform: translateY(-1px);
}

.mafia-overlay__timer-text--mono {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
  letter-spacing: 0.04em;
}

.mafia-overlay__round-tools {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
  margin-left: 0.1rem;
  padding-left: 0.4rem;
  border-left: 1px solid color-mix(in srgb, var(--sa-color-border) 80%, transparent);
}

.mafia-overlay__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.05rem;
  height: 2.05rem;
  margin: 0;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--sa-color-border) 90%, #fff);
  border-radius: var(--sa-radius-sm, 8px);
  background: color-mix(in srgb, var(--sa-color-surface) 50%, #000);
  color: var(--sa-color-text-main, #e8e8f0);
  cursor: pointer;
  box-shadow: 0 0 0 1px color-mix(in srgb, #fff 4%, transparent);
  transition:
    background 0.12s ease,
    border-color 0.12s ease,
    box-shadow 0.12s ease;
}

.mafia-overlay__icon-btn:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--sa-color-primary, #a78bfa) 45%, var(--sa-color-border));
  background: color-mix(in srgb, var(--sa-color-primary, #a78bfa) 10%, var(--sa-color-surface-raised, #1a1a24));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--sa-color-primary) 22%, transparent);
}

.mafia-overlay__icon-btn:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--sa-color-primary) 55%, var(--sa-color-border));
  outline-offset: 2px;
}

.mafia-overlay__icon-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
  box-shadow: none;
}

.mafia-overlay__icon-svg {
  width: 1.15rem;
  height: 1.15rem;
}
</style>
