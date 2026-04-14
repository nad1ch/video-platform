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

const targetPlayerId = computed(() => String(store.gameRoom?.voting?.targetPlayer ?? '').trim())
const votingActive = computed(() => Boolean(store.gameRoom?.voting?.active))
const canStart = computed(() => Boolean(targetPlayerId.value) && !votingActive.value)

const voteSlotRemaining = computed(() => {
  const v = store.gameRoom?.voting
  if (!v?.active) return null
  const start = millisFromFirestore(v.voteSlotStartedAt)
  const sec = Math.max(1, Number(v.slotDurationSec) || 5)
  if (start == null) return sec
  const left = sec - (tick.value - start) / 1000
  return Math.max(0, Math.ceil(left))
})

const ballotPosition = computed(() => {
  const v = store.gameRoom?.voting
  if (!v?.ballotQueue?.length) return null
  const idx = Math.max(0, Number(v.ballotIndex) || 0)
  return { idx: idx + 1, total: v.ballotQueue.length }
})

const slotDurationPick = computed(() => Math.max(1, Number(store.gameRoom?.voting?.slotDurationSec) || 5))

function pickDur(sec) {
  act('setVoteSlotDuration', sec)
}

const handRaiseChips = computed(() => {
  const hr = store.handRaises && typeof store.handRaises === 'object' ? store.handRaises : {}
  return Object.keys(hr)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map((id) => ({ id, n: Math.max(0, Math.floor(Number(hr[id]) || 0)) }))
    .filter((x) => x.n > 0)
})
</script>

<template>
  <section class="hcc-panel hcc-panel--vote" :aria-label="t('hostChrome.voting')">
    <h3 class="hcc-panel-title">{{ t('hostChrome.voting') }}</h3>
    <p
      class="hcc-ballot-pos"
      :class="{ 'hcc-ballot-pos--empty': !ballotPosition }"
    >
      <template v-if="ballotPosition">
        {{ t('hostChrome.ballotPosition', ballotPosition) }}
      </template>
      <template v-else>
        {{ t('hostChrome.ballotQueueEmpty') }}
      </template>
    </p>
    <p
      v-if="votingActive && voteSlotRemaining != null"
      class="hcc-vote-slot-timer"
      role="timer"
      :aria-live="voteSlotRemaining <= 3 ? 'assertive' : 'polite'"
    >
      {{ t('hostChrome.voteSlotTimer', { sec: voteSlotRemaining }) }}
    </p>
    <p v-else-if="!votingActive" class="hcc-vote-slot-idle">
      {{ t('hostChrome.voteSlotIdleHint', { sec: slotDurationPick }) }}
    </p>
    <div class="hcc-vote-toolbar">
      <div class="hcc-target-block hcc-target-block--compact">
        <span class="hcc-target-block__lbl">{{ t('hostChrome.target') }}</span>
        <strong class="hcc-target-block__id">{{ targetPlayerId || '—' }}</strong>
      </div>
      <div class="hcc-vote-toolbar__controls">
        <div v-if="!votingActive" class="hcc-vote-dur-row">
          <span class="hcc-vote-dur-lab">{{ t('hostChrome.voteSlotDuration') }}</span>
          <div class="hcc-vote-dur-chips">
            <button
              v-for="s in [5, 10, 15, 30, 60]"
              :key="'vd-' + s"
              type="button"
              class="hcc-chip-dur"
              :class="{ on: slotDurationPick === s }"
              @click="pickDur(s)"
            >
              {{ s }}s
            </button>
          </div>
        </div>
        <div class="hcc-vote-big">
          <button
            type="button"
            class="hcc-btn-xl hcc-btn-xl--go"
            :disabled="!canStart"
            :title="t('hostChrome.startVoteTitle')"
            @click="act('votingStart')"
          >
            {{ t('hostChrome.start') }}
          </button>
          <button
            type="button"
            class="hcc-btn-xl hcc-btn-xl--stop"
            :disabled="!votingActive"
            :title="t('hostChrome.stopVoteTitle')"
            @click="act('votingFinish')"
          >
            {{ t('hostChrome.stop') }}
          </button>
        </div>
      </div>
    </div>

    <details v-if="handRaiseChips.length" class="hcc-sess hcc-sess--hands">
      <summary class="hcc-sess__sum">✋ {{ t('hostChrome.sessionHands') }}</summary>
      <ul class="hcc-sess-list">
        <li v-for="row in handRaiseChips" :key="row.id" class="hcc-sess-li">
          <span>{{ row.id }}</span>
          <span class="hcc-sess-n">×{{ row.n }}</span>
        </li>
      </ul>
    </details>
  </section>
</template>
