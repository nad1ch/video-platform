<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { createLogger } from '@/utils/logger'
import ConfirmDialog from '@/eat-first/ui/molecules/ConfirmDialog.vue'
import { MAFIA_TIMER_PRESET_MS, useMafiaGameStore } from '@/stores/mafiaGame'
import { useMafiaPlayersStore } from '@/stores/mafiaPlayers'
import mafiaIconDice from '@/assets/mafia/mafia-icon-dice.svg?raw'

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

const overlayLog = createLogger('mafia-overlay')
const { t } = useI18n()
const mafiaGame = useMafiaGameStore()
const mafiaPlayersStore = useMafiaPlayersStore()
const { isMafiaHost, mafiaTimer } = storeToRefs(mafiaGame)

const nowMs = ref(Date.now())
let nowTick: ReturnType<typeof setInterval> | undefined

const selectedDurationMs = ref<(typeof MAFIA_TIMER_PRESET_MS)[number]>(MAFIA_TIMER_PRESET_MS[0]!)

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
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

const showTimerCountdown = computed(
  () => mafiaTimer.value != null && mafiaTimer.value.isRunning && timerDisplay.value != null,
)

const showTimerControls = computed(() => isMafiaHost.value && !isViewLayout.value)

const nPlayers = computed(() => mafiaPlayersStore.joinOrder.length)
const canReshuffle = computed(() => nPlayers.value >= 5 && nPlayers.value <= 12)

const reshuffleConfirmOpen = ref(false)

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

function shuffleButtonTitle(): string {
  if (!canReshuffle.value) {
    return t('mafiaPage.reshuffleCountHint')
  }
  return t('mafiaPage.overlayShuffleButtonTitle')
}

function openReshuffleConfirm(): void {
  if (!canReshuffle.value) {
    return
  }
  reshuffleConfirmOpen.value = true
}

function onReshuffleConfirm(): void {
  const r = mafiaGame.reshuffleGame()
  if (r.ok) {
    return
  }
  if (r.error === 'count' || r.error === 'empty') {
    overlayLog.info('reshuffle declined', { n: nPlayers.value, error: r.error })
  }
  if (r.error === 'message' && r.messageKey) {
    overlayLog.info('reshuffle', t(r.messageKey))
  }
}

function onSelectDuration(ms: (typeof MAFIA_TIMER_PRESET_MS)[number]): void {
  selectedDurationMs.value = ms
}

function onStartTimer(): void {
  mafiaGame.startTimer(selectedDurationMs.value)
}

function onStopTimer(): void {
  mafiaGame.stopTimer()
}
</script>

<template>
  <div class="mafia-overlay" role="presentation">
    <div class="mafia-overlay__header call-floating-surface">
      <div class="mafia-overlay__header-main">
        <svg
          class="mafia-overlay__timer-stopwatch"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 5V3M9 3h6"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
          />
          <circle
            cx="12"
            cy="14"
            r="7"
            stroke="currentColor"
            stroke-width="1.75"
          />
          <path
            d="M12 11v3l2 1"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span
          v-if="showTimerCountdown && timerDisplay != null"
          class="mafia-overlay__timer-text mafia-overlay__timer-text--mono"
          role="timer"
          :aria-label="t('mafiaPage.timerCountdown', { time: timerDisplay })"
        >
          {{ t('mafiaPage.timerCountdown', { time: timerDisplay }) }}
        </span>
        <span v-else class="mafia-overlay__timer-text mafia-overlay__timer-text--mono">{{
          t('mafiaPage.timerPlaceholder')
        }}</span>
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
              {{ t('mafiaPage.timerSecShort', { n: ms / 1000 }) }}
            </button>
          </div>
          <button
            type="button"
            class="sa-chip-btn mafia-overlay__timer-action mafia-overlay__timer-action--start"
            :title="t('mafiaPage.timerStartButton')"
            :aria-label="t('mafiaPage.timerStartButton')"
            @click="onStartTimer"
          >
            {{ t('mafiaPage.timerStartButton') }}
          </button>
          <button
            type="button"
            class="sa-chip-btn mafia-overlay__timer-action mafia-overlay__timer-action--stop"
            :disabled="mafiaTimer == null || !mafiaTimer.isRunning"
            :title="t('mafiaPage.timerStopButton')"
            :aria-label="t('mafiaPage.timerStopButton')"
            @click="onStopTimer"
          >
            {{ t('mafiaPage.timerStopButton') }}
          </button>
        </div>
        <div
          v-if="showTimerControls"
          class="mafia-overlay__round-tools"
          role="group"
          :aria-label="t('mafiaPage.overlayHostToolsGroupAria')"
        >
          <button
            type="button"
            class="mafia-overlay__icon-btn"
            :disabled="!canReshuffle"
            :title="shuffleButtonTitle()"
            :aria-label="shuffleButtonTitle()"
            @click="openReshuffleConfirm"
          >
            <span class="mafia-overlay__icon-svg mafia-overlay__icon-svg--raw" v-html="mafiaIconDice" />
          </button>
        </div>
      </div>
    </div>

    <ConfirmDialog
      v-model:open="reshuffleConfirmOpen"
      :title="t('mafiaPage.reshuffleConfirmTitle')"
      :message="t('mafiaPage.reshuffleConfirmBody')"
      :confirm-label="t('mafiaPage.reshuffleConfirmProceed')"
      :cancel-label="t('mafiaPage.reshuffleConfirmCancel')"
      @confirm="onReshuffleConfirm"
    />
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
  top: max(0.5rem, env(safe-area-inset-top, 0px));
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.55rem 0.75rem;
  width: max-content;
  max-width: min(42rem, calc(100vw - 16px));
  padding: 0.62rem 0.9rem;
  pointer-events: auto;
}

.mafia-overlay__header-main {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.5rem;
  min-width: 0;
}

.mafia-overlay__timer-ctrls {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.45rem;
}

.mafia-overlay__timer-presets {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
}

.mafia-overlay__timer-preset {
  min-height: auto;
  padding: 0.22rem 0.45rem;
  font-size: 0.7rem;
  font-weight: 600;
}

.mafia-overlay__timer-preset--active {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--sa-color-primary, #a78bfa) 80%, var(--sa-color-border));
}

.mafia-overlay__timer-action {
  min-height: auto;
  padding: 0.25rem 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
}

.mafia-overlay__timer-stopwatch {
  width: 1.05rem;
  height: 1.05rem;
  flex-shrink: 0;
  color: var(--sa-color-primary, #a78bfa);
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--sa-color-primary) 50%, transparent));
}

.mafia-overlay__icon-svg--raw {
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.mafia-overlay__icon-svg--raw :deep(svg) {
  width: 1.15rem;
  height: 1.15rem;
  display: block;
}

/* Typography aligned with `.call-page__toast` / call HUD. */
.mafia-overlay__timer-text {
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: 0.02em;
  color: var(--sa-color-text-main);
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
