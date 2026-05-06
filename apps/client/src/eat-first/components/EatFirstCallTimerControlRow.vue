<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import mafiaTimerClock from '@/assets/mafia/ui/timer-clock.svg'
import { createLogger } from '@/utils/logger'

const EAT_FIRST_TIMER_ACTION_EVENT = 'streamassist:eat-first:timer-action'

function dispatchEatFirstTimerAction(detail: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EAT_FIRST_TIMER_ACTION_EVENT, { detail }))
}

const props = withDefaults(
  defineProps<{
    layout: 'floating' | 'embedded'
    viewMode: boolean
    isEatFirstHost: boolean
    speakingTotalSec: number | null
    timerStartedAt: string
    timerPaused: boolean
    frozenRemainingSec: number | null
    gameId: string
    /** When true, hide presets + action (viewer / compact floating strip). */
    compact?: boolean
  }>(),
  {
    timerStartedAt: '',
    gameId: '',
    compact: false,
  },
)

const { t } = useI18n()
const log = createLogger('eat-first:call-timer-controls')

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

const showHostControls = computed(() => props.isEatFirstHost && !props.viewMode && !props.compact)

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

function onTimerActionClick(): void {
  if (!props.isEatFirstHost || props.viewMode) return
  if (typeof props.gameId !== 'string' || props.gameId.length < 1) return
  if (timerActionPending.value) return
  timerActionPending.value = true
  try {
    if (isRunning.value || props.timerPaused) {
      dispatchEatFirstTimerAction({ action: 'timer-stop' })
    } else {
      const sec = Math.max(5, Math.floor(Number(selectedPresetSec.value) || 30))
      dispatchEatFirstTimerAction({ action: 'timer-start', durationSec: sec })
    }
  } catch (e) {
    log.warn('timer action failed', e)
  } finally {
    timerActionPending.value = false
  }
}

const rootClass = computed(() => ({
  'ef-timer-ctrl': true,
  'ef-timer-ctrl--floating': props.layout === 'floating',
  'ef-timer-ctrl--embedded': props.layout === 'embedded',
  'ef-timer-ctrl--compact': props.compact,
}))
</script>

<template>
  <div :class="rootClass">
    <img class="ef-timer-ctrl__ico" :src="mafiaTimerClock" alt="" aria-hidden="true" />
    <span
      class="ef-timer-ctrl__text ef-timer-ctrl__text--mono"
      role="timer"
      :aria-label="t('eatFirstCall.timerCountdownAria', { time: timerText })"
    >
      {{ timerText }}
    </span>
    <div
      v-if="showHostControls"
      class="ef-timer-ctrl__ctrls"
      role="group"
      :aria-label="t('eatFirstCall.timerControlsAria')"
    >
      <div class="ef-timer-ctrl__presets" role="group">
        <button
          v-for="sec in TIMER_PRESET_SEC"
          :key="sec"
          type="button"
          class="sa-chip-btn ef-timer-ctrl__preset"
          :class="{ 'ef-timer-ctrl__preset--active': selectedPresetSec === sec }"
          :title="t('eatFirstCall.timerPresetSecTitle', { n: sec })"
          :aria-label="t('eatFirstCall.timerPresetSecTitle', { n: sec })"
          @click="onSelectPreset(sec)"
        >
          {{ sec }}
        </button>
      </div>
      <button
        type="button"
        class="sa-chip-btn ef-timer-ctrl__action"
        :title="timerActionTitle"
        :aria-label="timerActionTitle"
        :disabled="timerActionDisabled"
        @click="onTimerActionClick"
      >
        {{ timerActionLabel }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.ef-timer-ctrl {
  display: grid;
  align-items: center;
  column-gap: 7px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.ef-timer-ctrl--floating {
  grid-template-columns: 22px 50px minmax(0, 1fr);
  height: 39px;
  padding: 0 11px;
}

.ef-timer-ctrl--floating.ef-timer-ctrl--compact {
  grid-template-columns: 22px 50px;
  column-gap: 7px;
}

.ef-timer-ctrl--embedded {
  grid-template-columns: 20px 48px minmax(0, 1fr);
  min-height: 36px;
  padding: 6px 8px;
  border-radius: 8px;
  background: rgb(74 50 116 / 0.55);
  border: 1px solid rgb(255 255 255 / 0.08);
}

.ef-timer-ctrl--embedded.ef-timer-ctrl--compact {
  grid-template-columns: 20px 48px;
}

.ef-timer-ctrl__ctrls {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  margin-left: 4px;
  flex-wrap: wrap;
}

.ef-timer-ctrl--embedded .ef-timer-ctrl__ctrls {
  margin-left: 2px;
  gap: 4px;
}

.ef-timer-ctrl__presets {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.ef-timer-ctrl__preset {
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

.ef-timer-ctrl--embedded .ef-timer-ctrl__preset {
  width: 32px;
  min-width: 32px;
  min-height: 22px;
  height: 22px;
  font-size: 10.5px;
}

.ef-timer-ctrl__preset--active {
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.18);
}

.ef-timer-ctrl__action {
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

.ef-timer-ctrl__ico {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  display: block;
  object-fit: contain;
  align-self: center;
}

.ef-timer-ctrl--embedded .ef-timer-ctrl__ico {
  width: 20px;
  height: 20px;
}

.ef-timer-ctrl__text {
  font-family: var(--app-home-counter, 'Coda Caption', var(--sa-font-display, system-ui, sans-serif));
  font-size: 20px;
  font-weight: 800;
  line-height: 1;
  color: rgb(255 255 255 / 0.94);
  transform: translateY(-1px);
}

.ef-timer-ctrl--embedded .ef-timer-ctrl__text {
  font-size: 17px;
}

.ef-timer-ctrl__text--mono {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
  letter-spacing: 0.04em;
}
</style>
