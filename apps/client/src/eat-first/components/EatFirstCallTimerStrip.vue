<script setup lang="ts">
import { computed } from 'vue'
import EatFirstCallTimerControlRow from '@/eat-first/components/EatFirstCallTimerControlRow.vue'

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

const useCompactTimer = computed(() => !props.isEatFirstHost || props.viewMode)
</script>

<template>
  <div class="eat-first-call-timer" role="presentation">
    <div
      class="eat-first-call-timer__header call-floating-surface"
      :class="{ 'eat-first-call-timer__header--compact': useCompactTimer }"
    >
      <EatFirstCallTimerControlRow
        layout="floating"
        :view-mode="viewMode"
        :is-eat-first-host="isEatFirstHost"
        :speaking-total-sec="speakingTotalSec"
        :timer-started-at="timerStartedAt"
        :timer-paused="timerPaused"
        :frozen-remaining-sec="frozenRemainingSec"
        :game-id="gameId"
        :compact="useCompactTimer"
      />
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
</style>
