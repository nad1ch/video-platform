<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { hostControlChromeStore as store } from '../../../composables/hostControlChrome.js'
import { useHostChromeAct } from '../../../composables/useHostChromeAct.js'
import { millisFromFirestore } from '../../../utils/firestoreTime.js'

const { t } = useI18n()
const act = useHostChromeAct()

const tick = ref(Date.now())
let tickId = null

onMounted(() => {
  tickId = window.setInterval(() => {
    tick.value = Date.now()
  }, 250)
})

onUnmounted(() => {
  if (tickId != null) {
    window.clearInterval(tickId)
    tickId = null
  }
})

const timerRemainingSec = computed(() => {
  const gr = store.gameRoom
  if (!gr || typeof gr !== 'object') return null
  if (gr.timerPaused === true) {
    const f = Number(gr.timerRemainingFrozen)
    if (Number.isFinite(f) && f >= 0) return f
    return null
  }
  const start = millisFromFirestore(gr.timerStartedAt)
  const total = Number(gr.speakingTimer) || 0
  if (start == null || total <= 0) return null
  const elapsed = Math.floor((tick.value - start) / 1000)
  return Math.max(0, total - elapsed)
})

const timerTotalSec = computed(() => Math.max(0, Math.floor(Number(store.gameRoom?.speakingTimer) || 0)))

function formatRemain(sec) {
  const n = Math.max(0, Math.floor(Number(sec) || 0))
  const m = Math.floor(n / 60)
  const s = n % 60
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`
  return `${n}s`
}

const timerStatusLine = computed(() => {
  const left = timerRemainingSec.value
  if (left === null) return null
  const total = timerTotalSec.value
  if (total > 0) {
    return t('hostChrome.timerRemainingLine', { left: formatRemain(left), total })
  }
  return t('hostChrome.timerRemainingShort', { left: formatRemain(left) })
})
</script>

<template>
  <section class="hcc-panel hcc-panel--timer" :aria-label="t('hostChrome.timer')">
    <h3 class="hcc-panel-title">{{ t('hostChrome.timer') }}</h3>
    <p v-if="timerStatusLine" class="hcc-timer-remain" role="status" aria-live="polite">
      {{ timerStatusLine }}
    </p>
    <div class="hcc-timer-dur">
      <button
        v-for="sec in [30, 60, 90]"
        :key="'d-' + sec"
        type="button"
        class="hcc-chip-xl"
        :class="{ on: Number(store.speakingDuration) === sec }"
        @click="act('setSpeakingDuration', sec)"
      >
        {{ sec }}s
      </button>
    </div>
    <div class="hcc-timer-big">
      <button type="button" class="hcc-btn-xl hcc-btn-xl--primary" @click="act('startTimer')">
        {{ t('hostChrome.timerStart') }}
      </button>
      <button type="button" class="hcc-btn-xl hcc-btn-xl--ghost" @click="act('pauseTimer')">‖</button>
      <button type="button" class="hcc-btn-xl hcc-btn-xl--ghost" @click="act('resumeTimer')">▶</button>
      <button type="button" class="hcc-btn-xl hcc-btn-xl--ghost" @click="act('clearTimer')">↺</button>
      <button type="button" class="hcc-btn-xl hcc-btn-xl--next" @click="act('nextSpeaker')">
        {{ t('hostChrome.next') }}
      </button>
    </div>
    <p v-if="store.gameRoom?.timerPaused" class="hcc-pause-note">{{ t('hostChrome.timerPausedNote') }}</p>
  </section>
</template>
