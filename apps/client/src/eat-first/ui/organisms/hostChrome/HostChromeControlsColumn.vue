<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { hostControlChromeStore as store } from '../../../composables/hostControlChrome.js'
import { useHostChromeAct } from '../../../composables/useHostChromeAct.js'

const { t, te } = useI18n()
const act = useHostChromeAct()

function slotNum(slot) {
  const s = String(slot ?? '')
  const m = s.match(/^p(\d+)$/i)
  if (m) return m[1]
  return s.replace(/^p/i, '') || s
}

function phaseChipLabel(ph) {
  const key = `gamePhase.${ph}`
  return te(key) ? t(key) : String(ph)
}

const roundNow = computed(() =>
  Math.min(8, Math.max(1, Math.floor(Number(store.gameRoom?.round) || 1))),
)
const canDec = computed(() => roundNow.value > 1)
const canInc = computed(() => roundNow.value < 8)

const phaseLabel = computed(() => String(store.gameRoom?.gamePhase || 'intro'))

const raisedHandSlots = computed(() => {
  const h = store.gameRoom?.hands
  if (!h || typeof h !== 'object') return []
  return Object.keys(h)
    .filter((k) => h[k] === true)
    .sort((a, b) =>
      String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }),
    )
})
</script>

<template>
  <section class="hcc-panel hcc-panel--controls" :aria-label="t('hostChrome.show')">
    <div
      class="hcc-hands-bar"
      :class="{ 'hcc-hands-bar--empty': raisedHandSlots.length === 0 }"
      role="group"
      :aria-label="t('hostChrome.handsUp')"
    >
      <p class="hcc-hands-row" role="status">
        <template v-if="raisedHandSlots.length">
          ✋ {{ t('hostChrome.handsUp') }}
          <strong>{{ raisedHandSlots.map(slotNum).join(', ') }}</strong>
        </template>
        <template v-else>
          <span class="hcc-hands-empty">✋ {{ t('hostChrome.handsNone') }}</span>
        </template>
      </p>
      <button
        type="button"
        class="hcc-clear-hands hcc-clear-hands--compact"
        :disabled="raisedHandSlots.length === 0"
        @click="act('clearHands')"
      >
        {{ t('hostChrome.clearHands') }}
      </button>
    </div>

    <div class="hcc-round-row">
      <div class="hcc-left-round">
        <span class="hcc-left-lab">{{ t('hostChrome.round') }}</span>
        <div class="hcc-round">
          <button
            type="button"
            class="hcc-step"
            :disabled="!canDec"
            :aria-label="t('hostChrome.roundMinus')"
            @click="act('roundDelta', -1)"
          >
            −
          </button>
          <span class="hcc-round__mid">R{{ roundNow }}</span>
          <button
            type="button"
            class="hcc-step"
            :disabled="!canInc"
            :aria-label="t('hostChrome.roundPlus')"
            @click="act('roundDelta', 1)"
          >
            +
          </button>
        </div>
      </div>
      <button
        type="button"
        class="hcc-revive-all"
        :title="t('hostChrome.reviveAllTitle')"
        @click="act('reviveAllPlayers')"
      >
        {{ t('hostChrome.reviveAll') }}
      </button>
    </div>

    <div class="hcc-show-phase-row" role="group">
      <div class="hcc-mol hcc-mol--show" :aria-label="t('hostChrome.show')">
        <p class="hcc-left-lab">{{ t('hostChrome.show') }}</p>
        <div class="hcc-show-btns">
          <button type="button" class="hcc-btn-sm hcc-btn-sm--go" @click="act('startRound')">
            {{ t('hostChrome.showStart') }}
          </button>
          <button type="button" class="hcc-btn-sm hcc-btn-sm--pause" @click="act('pauseShow')">
            {{ t('hostChrome.showPause') }}
          </button>
          <button type="button" class="hcc-btn-sm hcc-btn-sm--reset" @click="act('resetRoom')">
            {{ t('hostChrome.showReset') }}
          </button>
        </div>
      </div>
      <div class="hcc-mol hcc-mol--phase" :aria-label="t('hostChrome.phase')">
        <p class="hcc-left-lab">{{ t('hostChrome.phase') }}</p>
        <div class="hcc-phase-chips">
          <button
            v-for="ph in store.phaseOptions"
            :key="ph"
            type="button"
            class="hcc-chip hcc-chip--phase"
            :class="{ on: phaseLabel === ph }"
            @click="act('setPhase', ph)"
          >
            {{ phaseChipLabel(ph) }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
