<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import mafiaTimerClock from '@/assets/mafia/ui/timer-clock.svg'
// gameService is JS without TS d.ts; the helpers below already validate input.
import { clearSpeakingTimer, startSpeakingTimer } from '@/eat-first/services/gameService.js'
import { createLogger } from '@/utils/logger'

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
const log = createLogger('eat-first:call-timer-strip')

const TIMER_PRESET_SEC = [30, 60, 90, 120] as const

const nowMs = ref(Date.now())
let nowTick: ReturnType<typeof setInterval> | undefined

const selectedPresetSec = ref<(typeof TIMER_PRESET_SEC)[number]>(TIMER_PRESET_SEC[1]!)

function formatMinSec(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

const isRunning = computed(
  () => props.timerStartedAt.trim().length > 0 && !props.timerPaused,
)

function startTickIfNeeded(): void {
  if (nowTick != null) return
  nowMs.value = Date.now()
  nowTick = setInterval(() => {
    nowMs.value = Date.now()
  }, 1000)
}

function stopTick(): void {
  if (nowTick != null) {
    clearInterval(nowTick)
    nowTick = undefined
  }
}

watch(
  () => isRunning.value,
  (running) => {
    if (running) startTickIfNeeded()
    else stopTick()
  },
  { immediate: true },
)

onUnmounted(() => {
  stopTick()
})

const timerDisplay = computed(() => {
  if (props.timerPaused && props.frozenRemainingSec != null && Number.isFinite(props.frozenRemainingSec)) {
    return formatMinSec(props.frozenRemainingSec)
  }
  if (isRunning.value) {
    const start = Date.parse(props.timerStartedAt)
    if (!Number.isFinite(start)) return null
    const total = Math.max(1, Math.floor(Number(props.speakingTotalSec) || 0))
    const elapsed = Math.floor((nowMs.value - start) / 1000)
    return formatMinSec(Math.max(0, total - elapsed))
  }
  return null
})

const idleDisplay = computed(() => {
  const base = Math.max(1, Math.floor(Number(props.speakingTotalSec) || selectedPresetSec.value))
  return formatMinSec(base)
})

const timerText = computed(() => timerDisplay.value ?? idleDisplay.value)

const showHostControls = computed(() => props.isEatFirstHost && !props.viewMode)
const useCompactTimer = computed(() => !showHostControls.value)

function onSelectPreset(sec: (typeof TIMER_PRESET_SEC)[number]): void {
  selectedPresetSec.value = sec
}

const timerActionPending = ref(false)

const timerActionLabel = computed(() =>
  isRunning.value || props.timerPaused
    ? t('eatFirstCall.timerStopLabel')
    : t('eatFirstCall.timerStartLabel'),
)

const timerActionTitle = computed(() =>
  isRunning.value || props.timerPaused
    ? t('eatFirstCall.timerStopHint')
    : t('eatFirstCall.timerStartHint'),
)

const timerActionDisabled = computed(() => {
  if (timerActionPending.value) return true
  if (typeof props.gameId !== 'string' || props.gameId.length < 1) return true
  return false
})

/**
 * Host-only start/stop. Persists via `gameService.startSpeakingTimer` /
 * `clearSpeakingTimer` (PATCH `/games/{id}/room`); the snapshot poller in
 * `useEatFirstCallGameSnapshot` round-trips the new room fields and the
 * countdown re-renders for every tab.
 */
async function onTimerActionClick(): Promise<void> {
  if (!props.isEatFirstHost || props.viewMode) return
  if (typeof props.gameId !== 'string' || props.gameId.length < 1) return
  if (timerActionPending.value) return
  timerActionPending.value = true
  try {
    if (isRunning.value || props.timerPaused) {
      await clearSpeakingTimer(props.gameId)
    } else {
      const sec = Math.max(1, Math.floor(Number(selectedPresetSec.value) || 30))
      await startSpeakingTimer(props.gameId, '', sec)
    }
  } catch (e) {
    log.warn('timer action failed', e)
  } finally {
    timerActionPending.value = false
  }
}
</script>

<template>
  <div class="eat-first-call-timer" role="presentation">
    <div
      class="eat-first-call-timer__header call-floating-surface"
      :class="{ 'eat-first-call-timer__header--compact': useCompactTimer }"
    >
      <div
        class="eat-first-call-timer__main"
        :class="{ 'eat-first-call-timer__main--compact': useCompactTimer }"
      >
        <img class="eat-first-call-timer__ico" :src="mafiaTimerClock" alt="" aria-hidden="true" />
        <span
          class="eat-first-call-timer__text eat-first-call-timer__text--mono"
          role="timer"
          :aria-label="t('eatFirstCall.timerCountdownAria', { time: timerText })"
        >
          {{ timerText }}
        </span>
        <div
          v-if="showHostControls"
          class="eat-first-call-timer__ctrls"
          role="group"
          :aria-label="t('eatFirstCall.timerControlsAria')"
        >
          <div class="eat-first-call-timer__presets" role="group">
            <button
              v-for="sec in TIMER_PRESET_SEC"
              :key="sec"
              type="button"
              class="sa-chip-btn eat-first-call-timer__preset"
              :class="{ 'eat-first-call-timer__preset--active': selectedPresetSec === sec }"
              :title="t('eatFirstCall.timerPresetSecTitle', { n: sec })"
              :aria-label="t('eatFirstCall.timerPresetSecTitle', { n: sec })"
              @click="onSelectPreset(sec)"
            >
              {{ sec }}
            </button>
          </div>
          <button
            type="button"
            class="sa-chip-btn eat-first-call-timer__action"
            :title="timerActionTitle"
            :aria-label="timerActionTitle"
            :disabled="timerActionDisabled"
            @click="onTimerActionClick"
          >
            {{ timerActionLabel }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="@/components/call/callFloatingSurface.css"></style>

<style scoped>
.eat-first-call-timer {
  position: absolute;
  inset: 0;
  z-index: 42;
  pointer-events: none;
}

.eat-first-call-timer__header {
  position: absolute;
  top: calc(max(0px, env(safe-area-inset-top, 0px)) + 6px);
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: min(336px, calc(100vw - 16px));
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

.eat-first-call-timer__header--compact {
  width: 102px;
}

.eat-first-call-timer__main {
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

.eat-first-call-timer__main--compact {
  grid-template-columns: 22px 50px;
  column-gap: 7px;
}

.eat-first-call-timer__ctrls {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  margin-left: 4px;
  flex-wrap: nowrap;
}

.eat-first-call-timer__presets {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.eat-first-call-timer__preset {
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

.eat-first-call-timer__preset--active {
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.18);
}

.eat-first-call-timer__action {
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
  flex-shrink: 0;
  white-space: nowrap;
}

.eat-first-call-timer__ico {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  display: block;
  object-fit: contain;
  align-self: center;
}

.eat-first-call-timer__text {
  font-family: var(--app-home-counter, 'Coda Caption', var(--sa-font-display, system-ui, sans-serif));
  font-size: 20px;
  font-weight: 800;
  line-height: 1;
  color: rgb(255 255 255 / 0.94);
  transform: translateY(-1px);
}

.eat-first-call-timer__text--mono {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
  letter-spacing: 0.04em;
}
</style>
