<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fieldConfig } from '../characterState'
import { formatGenderDisplay } from '../utils/genderDisplay.js'
import { saveVote } from '../services/gameService'
import { playVoteSubmitSound } from '../utils/voteUiSound.js'
const HUD_LEFT = ['profession', 'health', 'phobia']
const HUD_RIGHT = ['luggage', 'fact', 'quirk']

const props = defineProps({
  player: { type: Object, required: true },
  /** Spotlight (activePlayer) */
  isSpotlight: { type: Boolean, default: false },
  /** Таймер лише для currentSpeaker */
  isTimerTarget: { type: Boolean, default: false },
  /** Глобальна сітка: затемнити, коли інший говорить */
  dimmed: { type: Boolean, default: false },
  solo: { type: Boolean, default: false },
  cinema: { type: Boolean, default: false },
  speakerTimeLeft: { type: Number, default: undefined },
  speakerTimerTotal: { type: Number, default: 30 },
  drama: { type: Boolean, default: false },
  /** Голосування з gameRoom.voting */
  votingActive: { type: Boolean, default: false },
  votingTargetId: { type: String, default: '' },
  /** Тільки персональний оверлей: кнопки голосу активні */
  voteInteractive: { type: Boolean, default: false },
  /** Сховати смугу голосування на картці (батько показує зверху, напр. персональний оверлей) */
  hideVoteStrip: { type: Boolean, default: false },
  gameId: { type: String, default: '' },
  nominatedPlayerId: { type: String, default: '' },
  /** Хто ініціював номінацію (slot p1…) — legacy */
  nominatedById: { type: String, default: '' },
  /** Рядок «1, 3» з масиву nominations або legacy */
  nominatorsLine: { type: String, default: '' },
  roomRound: { type: Number, default: 1 },
  /** Голоси проти цього гравця в поточному раунді: { id, choice } */
  votesReceived: { type: Array, default: () => [] },
  hasVotedThisRound: { type: Boolean, default: false },
  /** Персональний оверлей: тебе голосують */
  isVoteTargetSelf: { type: Boolean, default: false },
  handRaised: { type: Boolean, default: false },
  /** Персональний оверлей: немає спікера й немає голосування */
  idleWaiting: { type: Boolean, default: false },
  /** Глобальна сітка: >3 рук у грі — не показувати ✋ на картці */
  suppressHandBadge: { type: Boolean, default: false },
  /** Міні-клітинка глобального оверлею: той самий solo-HUD, але від container (cqw/cqh) */
  mosaicTile: { type: Boolean, default: false },
})

const { t, locale } = useI18n()

const labelByKey = computed(() =>
  Object.fromEntries(fieldConfig.map((f) => [f.key, t(`traits.${f.key}`)])),
)

/** Закрите поле в HUD: [ ПРОФЕСІЯ ] */
function fieldLabelUi(fieldKey) {
  const raw = labelByKey.value[fieldKey] ?? fieldKey
  const loc = typeof locale.value === 'string' && locale.value ? locale.value : 'uk'
  return `[ ${String(raw).toLocaleUpperCase(loc)} ]`
}

function chunkFor(player, key) {
  const c = player[key]
  if (c && typeof c === 'object') return c
  return { value: '', revealed: false }
}

function statDisplay(player, fieldKey) {
  const c = chunkFor(player, fieldKey)
  if (!c.revealed) return { mode: 'label', text: labelByKey.value[fieldKey] }
  const v = String(c.value ?? '').trim()
  return { mode: 'value', text: v.length ? v : '—' }
}

/** Вік/стать на оверлеї; ім’я окремо завжди */
function demographicsRevealed(player) {
  if (player.demographicsRevealed === true) return true
  if (player.demographicsRevealed === false) return false
  return player.identityRevealed === true
}

function displayNameLine(player) {
  const n = String(player.name ?? '').trim()
  return { hidden: false, text: n.length ? n : '—' }
}

function displayAgeGenderLine(player) {
  if (!demographicsRevealed(player)) return { hidden: true, text: '' }
  const a = String(player.age ?? '').trim()
  const g = String(player.gender ?? '').trim()
  const left = a.length ? a : '—'
  const right = g.length ? formatGenderDisplay(g) : '—'
  return { hidden: false, text: `${left} · ${right}` }
}

function chunkForDisplay(player, key) {
  return chunkFor(player, key)
}

function isEliminated(player) {
  return player.eliminated === true
}

/** Випадковий арт вибуття 1…12 */
const deathArtIndex = ref(null)

watch(
  () => props.player.id,
  () => {
    deathArtIndex.value = null
  },
)

watch(
  () => isEliminated(props.player),
  (elim) => {
    if (!elim) deathArtIndex.value = null
    else if (deathArtIndex.value === null) {
      deathArtIndex.value = Math.floor(Math.random() * 12) + 1
    }
  },
  { immediate: true },
)

const deathSvgSrc = computed(() => {
  const n = deathArtIndex.value ?? 1
  return `/overlay-eliminated-${n}.svg`
})

function valueRevealKey(player, rowKey) {
  const r = chunkFor(player, rowKey).revealed
  return `${player.id}-${rowKey}-${r ? 'open' : 'closed'}`
}

function playerIdDisplay(player) {
  const id = String(player.id ?? '')
  const m = id.match(/^p(\d+)$/i)
  if (m) return m[1]
  return id.replace(/^p/i, '')
}

function activeCardFrom(player) {
  const ac = player.activeCard
  if (!ac || typeof ac !== 'object') {
    return { title: '', description: '', used: false }
  }
  return {
    title: String(ac.title ?? '').trim(),
    description: String(ac.description ?? '').trim(),
    used: Boolean(ac.used),
  }
}

const showSpeakerTimer = computed(
  () => props.isTimerTarget && typeof props.speakerTimeLeft === 'number',
)

const ringPct = computed(() => {
  if (!showSpeakerTimer.value) return 0
  const total = Math.max(1, props.speakerTimerTotal || 30)
  const left = Math.max(0, props.speakerTimeLeft)
  return Math.min(100, (left / total) * 100)
})

const timerUrgent = computed(() => {
  const t = props.speakerTimeLeft
  if (typeof t !== 'number') return false
  return t > 0 && t <= 5
})

const timerRingStyle = computed(() => {
  const pct = ringPct.value
  const urgent = timerUrgent.value
  const c = urgent ? '#ef4444' : '#a855f7'
  return {
    background: `conic-gradient(${c} ${pct}%, rgba(255,255,255,0.1) 0)`,
  }
})

const showActiveCardChip = computed(() => {
  const ac = activeCardFrom(props.player)
  if (ac.used) return false
  return Boolean(ac.title || ac.description)
})

const votingTargetNorm = computed(() => String(props.votingTargetId ?? '').trim())
const votingShown = computed(
  () => props.votingActive && votingTargetNorm.value.length > 0 && !isEliminated(props.player),
)

const voteTargetDisplay = computed(() => playerIdDisplay({ id: votingTargetNorm.value }))

const voteHintLine = computed(() => t('overlayCard.voteAgainst', { name: voteTargetDisplay.value }))

const nominatorsLineNorm = computed(() => String(props.nominatorsLine ?? '').trim())

const isNominated = computed(() => {
  if (isEliminated(props.player)) return false
  if (nominatorsLineNorm.value) return true
  const n = String(props.nominatedPlayerId ?? '').trim()
  return Boolean(n && props.player?.id === n)
})

const nominatedByLabel = computed(() => {
  const n = String(props.nominatedById ?? '').trim()
  if (!n) return ''
  return playerIdDisplay({ id: n })
})

const nominatorsUi = computed(() => nominatorsLineNorm.value || nominatedByLabel.value)

const countFor = computed(
  () => (Array.isArray(props.votesReceived) ? props.votesReceived : []).filter((v) => v.choice !== 'against').length,
)

const countAgainst = computed(
  () => (Array.isArray(props.votesReceived) ? props.votesReceived : []).filter((v) => v.choice === 'against').length,
)

const showVoteScore = computed(() => {
  if (!votingShown.value) return false
  return countFor.value + countAgainst.value > 0
})

const showVoteDetail = computed(
  () =>
    votingShown.value &&
    Array.isArray(props.votesReceived) &&
    props.votesReceived.length > 0,
)

/** Детальний список голосів з мікро-stagger (30–50ms) */
const staggeredVotes = ref([])
const staggerTimers = []

function clearVoteStaggerTimers() {
  while (staggerTimers.length) {
    const t = staggerTimers.pop()
    clearTimeout(t)
  }
}

watch(
  () => props.votesReceived,
  (list) => {
    clearVoteStaggerTimers()
    const sorted = Array.isArray(list)
      ? [...list].sort((a, b) =>
          String(a.id).localeCompare(String(b.id), undefined, { numeric: true, sensitivity: 'base' }),
        )
      : []
    if (sorted.length === 0) {
      staggeredVotes.value = []
      return
    }
    const nextById = Object.fromEntries(sorted.map((v) => [v.id, v]))
    staggeredVotes.value = staggeredVotes.value.filter((v) => nextById[v.id]).map((v) => nextById[v.id])
    const shown = new Set(staggeredVotes.value.map((v) => v.id))
    const newcomers = sorted.filter((v) => !shown.has(v.id))
    newcomers.forEach((v, i) => {
      const tid = window.setTimeout(() => {
        const latest = props.votesReceived
        if (!Array.isArray(latest) || !latest.some((x) => x.id === v.id)) return
        const cur = latest.find((x) => x.id === v.id)
        if (!cur) return
        if (staggeredVotes.value.some((x) => x.id === v.id)) return
        staggeredVotes.value = [...staggeredVotes.value, cur].sort((a, b) =>
          String(a.id).localeCompare(String(b.id), undefined, { numeric: true, sensitivity: 'base' }),
        )
      }, i * 45)
      staggerTimers.push(tid)
    })
  },
  { deep: true },
)

const bumpFor = ref(false)
const bumpAgainst = ref(false)
let bumpForT = null
let bumpAgainstT = null

watch(countFor, (n, prev) => {
  if (prev === undefined || n === prev || !votingShown.value) return
  bumpFor.value = true
  if (bumpForT) clearTimeout(bumpForT)
  bumpForT = window.setTimeout(() => {
    bumpFor.value = false
  }, 160)
})

watch(countAgainst, (n, prev) => {
  if (prev === undefined || n === prev || !votingShown.value) return
  bumpAgainst.value = true
  if (bumpAgainstT) clearTimeout(bumpAgainstT)
  bumpAgainstT = window.setTimeout(() => {
    bumpAgainst.value = false
  }, 160)
})

const isVoteTargetCard = computed(
  () =>
    !props.solo &&
    votingShown.value &&
    String(props.player?.id ?? '') === votingTargetNorm.value,
)

const handPop = ref(false)
let handPopT = null

watch(
  () => props.handRaised,
  (up, was) => {
    if (was === undefined) return
    if (!up || was) return
    handPop.value = true
    if (handPopT) clearTimeout(handPopT)
    handPopT = window.setTimeout(() => {
      handPop.value = false
    }, 120)
  },
)

const voteAckText = computed(() => {
  if (localVoteChoice.value && !props.hasVotedThisRound) return t('overlayCard.voteRecorded')
  return ''
})

const voteButtonsLocked = computed(
  () => voteBusy.value || props.hasVotedThisRound || localVoteChoice.value != null,
)

/** Короткий flash рамки live-голосів (сітка + персональний перегляд цілі) */
const voteFlash = ref(false)
let voteFlashTimer = null

watch(
  () => (Array.isArray(props.votesReceived) ? props.votesReceived.length : 0),
  (n, prev) => {
    if (prev === undefined) return
    if (n === prev || !votingShown.value) return
    voteFlash.value = true
    if (voteFlashTimer) clearTimeout(voteFlashTimer)
    voteFlashTimer = setTimeout(() => {
      voteFlash.value = false
    }, 100)
  },
)

onUnmounted(() => {
  if (voteFlashTimer) clearTimeout(voteFlashTimer)
  clearVoteStaggerTimers()
  if (bumpForT) clearTimeout(bumpForT)
  if (bumpAgainstT) clearTimeout(bumpAgainstT)
  if (handPopT) clearTimeout(handPopT)
})

const voteBusy = ref(false)
/** Локальний стан після успішного голосу (персональний оверлей) */
const localVoteChoice = ref(null)

watch(
  () => [props.votingActive, votingTargetNorm.value, props.voteInteractive, props.roomRound],
  () => {
    localVoteChoice.value = null
  },
)

async function submitVote(choice) {
  if (!props.voteInteractive || voteBusy.value || props.hasVotedThisRound) return
  const gid = String(props.gameId ?? '').trim()
  const voter = String(props.player?.id ?? '').trim()
  const target = votingTargetNorm.value
  const rr = Math.floor(Number(props.roomRound) || 1)
  if (!gid || !voter || !target) return
  voteBusy.value = true
  try {
    const res = await saveVote(gid, voter, target, choice, rr)
    if (res.ok) {
      localVoteChoice.value = choice === 'against' ? 'against' : 'for'
      playVoteSubmitSound(0.14)
    }
  } catch (e) {
    console.error('[saveVote]', e)
  } finally {
    voteBusy.value = false
  }
}
</script>

<template>
  <article
    v-if="!solo"
    class="card-grid"
    :class="{
      'card-grid--spotlight': isSpotlight && !isEliminated(player),
      'card-grid--timer': isTimerTarget,
      'card-grid--eliminated': isEliminated(player),
      'card-grid--cinema': cinema,
      'card-grid--dimmed': dimmed && !isEliminated(player),
      'card-grid--speaker': isTimerTarget && !isEliminated(player),
      'card-grid--nominated': isNominated && !isEliminated(player),
      'card-grid--vote-target': isVoteTargetCard,
    }"
  >
    <div v-if="isEliminated(player)" class="card-elim-screen card-elim-screen--cut">
      <img class="card-elim-screen__art" :src="deathSvgSrc" alt="" />
      <p class="card-elim-screen__title">{{ t('overlayCard.eliminated') }}</p>
      <p class="card-elim-screen__hint">{{ t('overlayCard.slotClosed') }}</p>
      <p class="card-elim-screen__slot">{{ playerIdDisplay(player) }}</p>
    </div>

    <template v-else>
      <span
        v-if="handRaised && !suppressHandBadge"
        class="hand-badge hand-badge--grid"
        :class="{ 'hand-badge--pop': handPop }"
        aria-hidden="true"
        :title="t('overlayCard.handUp')"
        >✋</span
      >
      <div v-if="showSpeakerTimer" class="card-grid-timer" aria-hidden="true">
        <p v-if="isTimerTarget" class="card-speak-badge">{{ t('overlayCard.speaking') }}</p>
        <div class="timer-ring-wrap" :class="{ 'timer-ring-wrap--urgent': timerUrgent }">
          <span class="timer-ring" :style="timerRingStyle" />
          <span class="timer-num" :class="{ 'timer-num--urgent': timerUrgent }">⏱ {{ speakerTimeLeft }}s</span>
        </div>
      </div>
      <div class="card-grid-body">
        <div class="card-grid-id-row">
          <p class="card-grid-id">{{ playerIdDisplay(player) }}</p>
        </div>
        <template v-if="isNominated">
          <p class="nominee-nom-label">{{ t('overlayCard.nomShort') }}</p>
          <p v-if="nominatorsUi" class="nominee-nom-who">{{ nominatorsUi }}</p>
        </template>
        <h2 class="card-grid-name">
          {{ displayNameLine(player).text }}
        </h2>
        <p class="card-grid-meta">
          <span v-if="!demographicsRevealed(player)" class="placeholder">••• · •••</span>
          <span v-else>{{ displayAgeGenderLine(player).text }}</span>
        </p>
        <ul class="stats">
          <li v-for="row in fieldConfig" :key="row.key">
            <Transition name="opc-flip" mode="out-in">
              <span
                :key="valueRevealKey(player, row.key)"
                class="stat-cell"
                :class="{
                  'stat-cell--label': !chunkForDisplay(player, row.key).revealed,
                  'stat-cell--open': chunkForDisplay(player, row.key).revealed,
                  'stat-cell--wave': chunkForDisplay(player, row.key).revealed,
                  'value--revealed': chunkForDisplay(player, row.key).revealed,
                  'stat-cell--drama': drama && chunkForDisplay(player, row.key).revealed,
                }"
              >
                <template v-if="!chunkForDisplay(player, row.key).revealed">
                  {{ fieldLabelUi(row.key) }}
                </template>
                <template v-else>
                  {{ statDisplay(player, row.key).text }}
                </template>
              </span>
            </Transition>
          </li>
        </ul>
      </div>
      <div
        v-if="votingShown && !hideVoteStrip"
        class="vote-strip vote-strip--grid"
        :class="{ 'vote-strip--flash': voteFlash }"
        :aria-label="t('overlayCard.voteAria')"
      >
        <p class="vote-strip__title">{{ t('overlayCard.voting') }}</p>
        <p class="vote-strip__target">{{ voteHintLine }}</p>
        <p v-if="showVoteScore" class="vote-score">
          <span class="vote-score__n" :class="{ 'vote-score__n--bump': bumpFor }">👍 {{ countFor }}</span>
          <span class="vote-score__n" :class="{ 'vote-score__n--bump': bumpAgainst }">👎 {{ countAgainst }}</span>
        </p>
        <p v-if="showVoteDetail && !voteInteractive" class="vote-tally">
          <span
            v-for="v in staggeredVotes"
            :key="v.id"
            class="vote-tally__it"
          >{{ playerIdDisplay({ id: v.id }) }}{{ v.choice === 'against' ? '👎' : '👍' }}</span>
        </p>
        <div class="vote-strip__row">
          <button
            v-if="voteInteractive"
            type="button"
            class="vote-btn"
            :class="{ 'vote-btn--picked': localVoteChoice === 'for', 'vote-btn--locked': voteButtonsLocked }"
            :disabled="voteButtonsLocked"
            @click="submitVote('for')"
          >
            👍 <span class="vote-btn__lbl">{{ t('overlayCard.for') }}</span>
          </button>
          <span v-else class="vote-fake">👍</span>
          <button
            v-if="voteInteractive"
            type="button"
            class="vote-btn"
            :class="{ 'vote-btn--picked': localVoteChoice === 'against', 'vote-btn--locked': voteButtonsLocked }"
            :disabled="voteButtonsLocked"
            @click="submitVote('against')"
          >
            👎 <span class="vote-btn__lbl">{{ t('overlayCard.against') }}</span>
          </button>
          <span v-else class="vote-fake">👎</span>
        </div>
        <p v-if="voteInteractive && voteAckText" class="vote-strip__ack">{{ voteAckText }}</p>
      </div>
    </template>
  </article>

  <div
    v-else
    class="hud-root hud-root--solo"
    :class="{
      'hud-root--mosaic': mosaicTile,
      'hud-root--eliminated': isEliminated(player),
      'hud-root--spotlight': isSpotlight && !isEliminated(player),
      'hud-root--speaker': isTimerTarget && !isEliminated(player),
      'hud-root--cinema': cinema,
      'hud-root--drama': drama,
      'hud-root--nominated': isNominated && !isEliminated(player),
      'hud-root--vote-target-ambient': solo && isVoteTargetSelf && !isEliminated(player),
    }"
  >
    <div v-if="isEliminated(player)" class="elim-solo-screen elim-solo-screen--cut">
      <div class="elim-solo-screen__base" aria-hidden="true" />
      <img class="elim-solo-screen__mark" :src="deathSvgSrc" alt="" />
      <div class="elim-solo-screen__content">
        <p class="elim-solo-screen__kicker">{{ t('overlayCard.elimKicker') }}</p>
        <h2 class="elim-solo-screen__title">{{ t('overlayCard.eliminated') }}</h2>
        <p class="elim-solo-screen__subline">{{ t('overlayCard.slotClosed') }}</p>
        <p class="elim-solo-screen__slot">{{ t('overlayCard.player', { name: playerIdDisplay(player) }) }}</p>
      </div>
    </div>

    <template v-else>
      <p v-if="solo && idleWaiting" class="idle-wait-cue" role="status">{{ t('overlayCard.waitPlayer') }}</p>
      <div
        v-if="solo && showActiveCardChip"
        class="ac-chip"
        :title="activeCardFrom(player).description || activeCardFrom(player).title || t('overlayCard.hasCardTitle')"
      >
        <span class="ac-chip-ico">🃏</span>
        <span class="ac-chip-t">{{ t('overlayCard.hasCard') }}</span>
      </div>

      <div
        v-if="solo && isNominated && !isEliminated(player)"
        class="nominee-solo-float"
        role="status"
      >
        <p class="nominee-solo-float__k">{{ t('overlayCard.youOnVote') }}</p>
        <p class="nominee-solo-float__nom">{{ t('overlayCard.nomShort') }}</p>
        <p v-if="nominatorsUi" class="nominee-solo-float__who">{{ nominatorsUi }}</p>
      </div>

      <div class="hud-zones">
      <div class="hud-block hud-tl">
        <p class="hud-line hud-line--name">
          {{ displayNameLine(player).text }}
        </p>
        <p class="hud-line hud-line--sub">
          <span v-if="!demographicsRevealed(player)" class="hud-ph">••• · •••</span>
          <span v-else>{{ displayAgeGenderLine(player).text }}</span>
        </p>
      </div>

      <div
        class="hud-block hud-tr"
        :class="{
          'hud-block--speaker-live': isTimerTarget && !isEliminated(player),
          'hud-tr--urgent': timerUrgent,
        }"
      >
        <div
          v-if="handRaised"
          class="hand-wait-hud"
          :class="{ 'hand-wait-hud--pop': handPop }"
          aria-hidden="true"
        >
          <span class="hand-wait-hud__ico">✋</span>
          <span class="hand-wait-hud__txt">{{ t('overlayCard.waitWord') }}</span>
        </div>
        <div class="hud-tr-top">
          <span class="hud-slot-wrap">
            <span class="hud-slot">{{ playerIdDisplay(player) }}</span>
          </span>
          <span v-if="isTimerTarget" class="hud-speak-badge">{{ t('overlayCard.speaking') }}</span>
        </div>
        <div v-if="showSpeakerTimer" class="hud-timer-stack">
          <div
            class="hud-ring-wrap"
            :class="{ 'hud-ring-wrap--urgent': timerUrgent, 'timer--danger': timerUrgent }"
          >
            <span class="hud-ring" :style="timerRingStyle" />
            <span
              class="hud-timer-label"
              :class="{ 'hud-timer-label--urgent': timerUrgent, 'timer--danger': timerUrgent }"
            >{{ speakerTimeLeft }}s</span>
          </div>
        </div>
      </div>

      <div class="hud-block hud-bl">
        <div v-for="key in HUD_LEFT" :key="key" class="hud-stat">
          <Transition name="opc-flip" mode="out-in">
            <span
              :key="valueRevealKey(player, key)"
              class="hud-stat-inner"
              :class="{
                'hud-stat-inner--label': !chunkForDisplay(player, key).revealed,
                'hud-stat-inner--open': chunkForDisplay(player, key).revealed,
                'hud-stat-inner--wave': chunkForDisplay(player, key).revealed,
                'value--revealed': chunkForDisplay(player, key).revealed,
                'hud-stat-inner--drama': drama && chunkForDisplay(player, key).revealed,
              }"
            >
              <template v-if="!chunkForDisplay(player, key).revealed">{{ fieldLabelUi(key) }}</template>
              <template v-else>{{ statDisplay(player, key).text }}</template>
            </span>
          </Transition>
        </div>
      </div>

      <div class="hud-block hud-br">
        <div v-for="key in HUD_RIGHT" :key="key" class="hud-stat">
          <Transition name="opc-flip" mode="out-in">
            <span
              :key="valueRevealKey(player, key)"
              class="hud-stat-inner"
              :class="{
                'hud-stat-inner--label': !chunkForDisplay(player, key).revealed,
                'hud-stat-inner--open': chunkForDisplay(player, key).revealed,
                'hud-stat-inner--wave': chunkForDisplay(player, key).revealed,
                'value--revealed': chunkForDisplay(player, key).revealed,
                'hud-stat-inner--drama': drama && chunkForDisplay(player, key).revealed,
              }"
            >
              <template v-if="!chunkForDisplay(player, key).revealed">{{ fieldLabelUi(key) }}</template>
              <template v-else>{{ statDisplay(player, key).text }}</template>
            </span>
          </Transition>
        </div>
      </div>
    </div>

      <div
        v-if="votingShown && !hideVoteStrip"
        class="vote-strip vote-strip--solo"
        :class="{ 'vote-strip--interactive': voteInteractive, 'vote-strip--flash': voteFlash }"
        :aria-label="t('overlayCard.voteAria')"
      >
        <p class="vote-strip__title">{{ t('overlayCard.voting') }}</p>
        <p v-if="voteInteractive && isVoteTargetSelf" class="vote-strip__dramatic">{{ t('overlayCard.youAreBeingVoted') }}</p>
        <p class="vote-strip__target">{{ voteHintLine }}</p>
        <p v-if="showVoteScore" class="vote-score vote-score--solo">
          <span class="vote-score__n" :class="{ 'vote-score__n--bump': bumpFor }">👍 {{ countFor }}</span>
          <span class="vote-score__n" :class="{ 'vote-score__n--bump': bumpAgainst }">👎 {{ countAgainst }}</span>
        </p>
        <p v-if="voteInteractive && showVoteDetail" class="vote-tally vote-tally--solo">
          <span
            v-for="v in staggeredVotes"
            :key="v.id"
            class="vote-tally__it"
          >{{ playerIdDisplay({ id: v.id }) }}{{ v.choice === 'against' ? '👎' : '👍' }}</span>
        </p>
        <p v-if="voteInteractive && hasVotedThisRound" class="vote-strip__voted-only">{{ t('overlayCard.alreadyVotedShort') }}</p>
        <div v-else-if="voteInteractive" class="vote-strip__row">
          <button
            type="button"
            class="vote-btn"
            :class="{ 'vote-btn--picked': localVoteChoice === 'for', 'vote-btn--locked': voteButtonsLocked }"
            :disabled="voteButtonsLocked"
            @click="submitVote('for')"
          >
            👍 <span class="vote-btn__lbl">{{ t('overlayCard.for') }}</span>
          </button>
          <button
            type="button"
            class="vote-btn"
            :class="{ 'vote-btn--picked': localVoteChoice === 'against', 'vote-btn--locked': voteButtonsLocked }"
            :disabled="voteButtonsLocked"
            @click="submitVote('against')"
          >
            👎 <span class="vote-btn__lbl">{{ t('overlayCard.against') }}</span>
          </button>
        </div>
        <p v-if="voteInteractive && voteAckText" class="vote-strip__ack">{{ voteAckText }}</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.card-grid {
  --cg-pad-x: clamp(0.75rem, min(2.8vw, 3.2vh), 1.45rem);
  --cg-pad-y: clamp(0.85rem, min(3vw, 3.4vh), 1.5rem);
  /* +20%: картки характеристик, номер слота, цифра таймера, голосування */
  --cg-stat-gap: clamp(0.504rem, min(2.16vw, 2.64vh), 0.9rem);
  --cg-stat-pad-y: clamp(0.624rem, min(2.64vw, 3.12vh), 1.26rem);
  --cg-stat-pad-x: clamp(0.696rem, min(3.12vw, 3.6vh), 1.44rem);
  --cg-stat-fs: clamp(1.08rem, min(3.36vw, 3.84vh), 1.464rem);
  --cg-id-fs: clamp(0.816rem, min(2.4vw, 2.64vh), 1.056rem);
  --cg-name-fs: clamp(1.26rem, min(3.36vw, 4.08vh), 1.704rem);
  --cg-meta-fs: clamp(0.88rem, min(2.2vw, 2.8vh), 1.12rem);
  --cg-timer: clamp(3.9rem, min(12vw, 13.2vh), 6.6rem);
  --cg-timer-num: clamp(0.816rem, min(2.4vw, 2.88vh), 1.08rem);

  position: relative;
  padding: 0;
  border-radius: 14px;
  /* Трохи прозоріше — вебка з шару LiveKit проглядає під карткою */
  background: rgba(12, 8, 28, 0.78);
  border: 1px solid rgba(168, 85, 247, 0.28);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.32);
  overflow: visible;
  transition:
    transform 0.4s ease,
    box-shadow 0.4s ease,
    border-color 0.4s ease,
    opacity 0.4s ease,
    filter 0.4s ease;
}

@media (min-width: 1600px) {
  .card-grid {
    --cg-stat-fs: clamp(1.2rem, 1.32vw, 1.62rem);
  }
}

/* Spotlight: окремо від спікера — статична фіолетова рамка + м’яке світіння */
.card-grid--spotlight:not(.card-grid--speaker) {
  transform: scale(1.008);
  border-color: rgba(168, 85, 247, 0.5);
  box-shadow:
    0 0 0 1px rgba(168, 85, 247, 0.35),
    0 4px 16px rgba(168, 85, 247, 0.12);
}

.card-grid--nominated:not(.card-grid--eliminated) {
  border: 1px solid rgba(220, 38, 38, 0.52);
  animation: nominatedPulse 2.5s ease-in-out infinite;
}

@keyframes nominatedPulse {
  0%,
  100% {
    box-shadow:
      0 0 0 1px rgba(127, 29, 29, 0.32),
      0 0 16px rgba(220, 38, 38, 0.2);
    border-color: rgba(220, 38, 38, 0.48);
  }
  50% {
    box-shadow:
      0 0 0 1px rgba(127, 29, 29, 0.38),
      0 0 24px rgba(220, 38, 38, 0.3);
    border-color: rgba(220, 38, 38, 0.58);
  }
}

.card-grid--vote-target:not(.card-grid--eliminated) {
  box-shadow:
    inset 0 0 28px rgba(220, 38, 38, 0.28),
    0 6px 20px rgba(0, 0, 0, 0.32);
}

.card-grid--dimmed {
  opacity: 0.5;
  filter: saturate(0.55) brightness(0.92);
  transition:
    opacity 0.45s ease,
    filter 0.45s ease;
}

/* Спікер: лише легка рамка — центр кадру не зафарбовуємо */
.card-grid--speaker:not(.card-grid--eliminated) {
  opacity: 1;
  filter: none;
  z-index: 2;
  transform: none;
  outline: 1px solid rgba(168, 85, 247, 0.28);
  outline-offset: -1px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
}

.card-speak-badge {
  margin: 0;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  font-size: clamp(0.5rem, min(1.5vw, 1.7vh), 0.62rem);
  font-weight: 800;
  letter-spacing: 0.1em;
  color: rgba(250, 245, 255, 0.92);
  background: rgba(168, 85, 247, 0.22);
  border: 1px solid rgba(168, 85, 247, 0.35);
  line-height: 1;
}

.timer-ring-wrap--urgent {
  animation: timerDangerPulse 0.6s ease-in-out infinite;
}

@keyframes timerDangerPulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.92;
    transform: scale(1.04);
  }
}

.timer-num--urgent {
  color: #fecaca !important;
  text-shadow: 0 0 10px rgba(239, 68, 68, 0.6) !important;
}

.card-grid > .card-grid-timer {
  position: absolute;
  top: 0.45rem;
  right: 0.45rem;
  z-index: 4;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.timer-ring-wrap {
  position: relative;
  width: var(--cg-timer, 62px);
  height: var(--cg-timer, 62px);
  display: grid;
  place-items: center;
}

.timer-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  transition: background 0.35s linear;
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 3px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 3px));
}

.card-grid--speaker:not(.card-grid--eliminated) .timer-ring-wrap:not(.timer-ring-wrap--urgent) .timer-ring {
  animation: speakerRingPulse 1.6s ease-in-out infinite;
  transform-origin: center;
}

.timer-num {
  position: relative;
  z-index: 1;
  font-size: var(--cg-timer-num, 0.72rem);
  font-weight: 800;
  color: #faf5ff;
  font-family: 'Orbitron', sans-serif;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}

.card-grid-body {
  position: relative;
  z-index: 2;
  padding: var(--cg-pad-y) var(--cg-pad-x);
}

.card-grid-id-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.5rem;
  margin-bottom: 0.2rem;
}

.card-grid-id-row .card-grid-id {
  margin: 0;
}

.nominee-badge {
  display: inline-block;
  padding: 0.12rem 0.35rem;
  border-radius: 6px;
  font-size: clamp(0.48rem, min(1.35vw, 1.5vh), 0.58rem);
  font-weight: 800;
  letter-spacing: 0.08em;
  color: rgba(254, 226, 226, 0.98);
  background: rgba(80, 20, 28, 0.62);
  border: 1px solid rgba(248, 113, 113, 0.45);
  line-height: 1.2;
  white-space: nowrap;
  box-shadow: 0 0 10px rgba(220, 38, 38, 0.2);
}

.nominee-badge--hud {
  margin-top: 0.2rem;
  font-size: clamp(0.45rem, min(1.25vw, 1.4vh), 0.52rem);
  letter-spacing: 0.06em;
}

.hand-badge {
  display: inline-grid;
  place-items: center;
  font-size: clamp(0.85rem, min(2.4vw, 2.6vh), 1.05rem);
  line-height: 1;
  pointer-events: none;
  user-select: none;
}

.hand-badge--grid {
  position: absolute;
  top: 0.4rem;
  left: 0.4rem;
  z-index: 5;
  padding: 0.15rem 0.28rem;
  border-radius: 8px;
  background: rgba(8, 6, 18, 0.88);
  border: 1px solid rgba(251, 191, 36, 0.35);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  transform-origin: center;
}

.hand-badge--pop {
  animation: handPopNudge 0.12s ease;
}

@keyframes handPopNudge {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
}

.vote-strip {
  pointer-events: none;
  text-align: center;
  box-sizing: border-box;
}

.vote-strip--grid {
  position: relative;
  z-index: 3;
  margin-top: 0.35rem;
  padding: 0.35rem 0.45rem 0.45rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: transparent;
}

.vote-strip--solo {
  position: fixed;
  left: 50%;
  bottom: max(0.65rem, env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  z-index: 12;
  padding: 0.35rem 0.65rem 0.5rem;
  min-width: min(92vw, 16rem);
  background: transparent;
}

.vote-strip--interactive {
  pointer-events: auto;
}

.vote-strip__title {
  margin: 0 0 0.15rem;
  font-family: Orbitron, sans-serif;
  font-size: clamp(0.624rem, min(1.8vw, 1.98vh), 0.744rem);
  font-weight: 800;
  letter-spacing: 0.22em;
  color: rgba(226, 232, 240, 0.88);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.65);
}

.vote-strip__target {
  margin: 0 0 0.32rem;
  font-size: clamp(0.744rem, min(2.1vw, 2.28vh), 0.936rem);
  font-weight: 700;
  letter-spacing: 0.14em;
  color: rgba(250, 245, 255, 0.95);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.75);
}

.vote-strip--flash {
  animation: voteStripPulse 0.1s ease-out;
}

/* brightness — не обрізається overflow:hidden на .card-grid */
@keyframes voteStripPulse {
  0% {
    filter: brightness(1.35);
  }
  100% {
    filter: brightness(1);
  }
}

.vote-score {
  margin: 0 0 0.28rem;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.65rem 1rem;
  font-family: Orbitron, sans-serif;
  font-size: clamp(1.02rem, min(2.88vw, 3.12vh), 1.26rem);
  font-weight: 900;
  letter-spacing: 0.06em;
  color: #f8fafc;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.75);
}

.vote-score--solo {
  font-size: clamp(1.104rem, min(3.12vw, 3.36vh), 1.344rem);
}

.vote-score__n {
  display: inline-block;
  white-space: nowrap;
  transform-origin: center;
}

.vote-score__n--bump {
  animation: voteCountBump 0.15s ease;
}

@keyframes voteCountBump {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.15);
  }
}

.vote-strip__voted-only {
  margin: 0.35rem 0 0;
  font-size: clamp(0.864rem, min(2.4vw, 2.64vh), 1.056rem);
  font-weight: 800;
  letter-spacing: 0.12em;
  color: rgba(186, 230, 253, 0.92);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.65);
}

.vote-strip__dramatic {
  margin: 0 0 0.28rem;
  font-family: Orbitron, sans-serif;
  font-size: clamp(0.696rem, min(1.92vw, 2.1vh), 0.864rem);
  font-weight: 900;
  letter-spacing: 0.28em;
  color: #fecaca;
  text-shadow:
    0 0 18px rgba(248, 113, 113, 0.55),
    0 1px 4px rgba(0, 0, 0, 0.75);
}

.vote-tally {
  margin: 0 0 0.28rem;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.35rem 0.5rem;
  font-size: clamp(0.66rem, min(1.74vw, 1.86vh), 0.816rem);
  color: rgba(226, 232, 240, 0.88);
  line-height: 1.3;
}

.vote-tally--solo {
  justify-content: center;
}

.vote-tally__it {
  font-family: Orbitron, sans-serif;
  font-weight: 700;
  white-space: nowrap;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}

.nominee-nom-label {
  margin: 0.1rem 0 0;
  font-size: clamp(0.42rem, min(1.2vw, 1.3vh), 0.52rem);
  font-weight: 900;
  letter-spacing: 0.22em;
  color: rgba(253, 230, 138, 0.95);
}

.nominee-nom-who {
  margin: 0.05rem 0 0.2rem;
  font-family: Orbitron, sans-serif;
  font-size: clamp(0.55rem, min(1.5vw, 1.6vh), 0.72rem);
  font-weight: 800;
  letter-spacing: 0.12em;
  color: rgba(254, 243, 199, 0.98);
}

.nominee-nom-label--hud {
  text-align: right;
  margin-left: auto;
  max-width: 11rem;
}

.nominee-nom-who--hud {
  text-align: right;
  margin-left: auto;
  max-width: 11rem;
}

.nominee-by {
  margin: 0.15rem 0 0;
  font-size: clamp(0.48rem, min(1.35vw, 1.45vh), 0.58rem);
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgba(254, 202, 202, 0.88);
}

.nominee-by--hud {
  margin: 0.2rem 0 0;
  text-align: right;
  max-width: 11rem;
  margin-left: auto;
}

.nominee-solo-kicker {
  margin: 0.15rem 0 0;
  text-align: right;
  font-size: clamp(0.48rem, min(1.3vw, 1.4vh), 0.58rem);
  font-weight: 800;
  letter-spacing: 0.2em;
  color: rgba(254, 202, 202, 0.9);
  text-shadow: 0 0 10px rgba(220, 38, 38, 0.35);
}

.vote-strip__ack {
  margin: 0.45rem 0 0;
  font-size: clamp(0.744rem, min(2.1vw, 2.28vh), 0.96rem);
  font-weight: 800;
  letter-spacing: 0.1em;
  color: #bbf7d0;
  text-shadow:
    0 0 12px rgba(74, 222, 128, 0.45),
    0 1px 4px rgba(0, 0, 0, 0.65);
}

.vote-strip__row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
}

.vote-btn {
  pointer-events: auto;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.35rem 0.65rem;
  border-radius: 12px;
  font-size: clamp(0.936rem, min(2.64vw, 2.88vh), 1.14rem);
  font-weight: 700;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(12, 8, 24, 0.82);
  color: #f1f5f9;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
  transition: transform 0.12s ease, border-color 0.12s ease;
}

.vote-btn:hover:not(:disabled) {
  transform: scale(1.04);
  border-color: rgba(168, 85, 247, 0.45);
}

.vote-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  pointer-events: none;
}

.vote-btn:disabled:hover {
  transform: none;
  border-color: rgba(255, 255, 255, 0.14);
}

.vote-btn--locked:disabled {
  cursor: not-allowed;
}

.vote-btn--picked {
  border-color: rgba(52, 211, 153, 0.85) !important;
  background: rgba(6, 78, 59, 0.55) !important;
  color: #ecfdf5 !important;
  box-shadow:
    0 0 0 2px rgba(74, 222, 128, 0.35),
    0 0 22px rgba(74, 222, 128, 0.35);
  transform: scale(1.03);
}

.vote-btn__lbl {
  font-size: 0.744rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.85;
}

.vote-fake {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.3rem 0.5rem;
  font-size: clamp(1.02rem, min(2.88vw, 3.12vh), 1.2rem);
  opacity: 0.75;
  filter: grayscale(0.2);
}

.card-grid--eliminated {
  border-color: rgba(80, 20, 28, 0.75);
  background: #050308;
  min-height: 200px;
  box-shadow: inset 0 0 64px rgba(0, 0, 0, 0.75);
}

.card-elim-screen {
  position: relative;
  z-index: 2;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 1.25rem 1rem;
  min-height: 220px;
  box-sizing: border-box;
  background: #050308;
  opacity: 1;
}

.card-elim-screen::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  background: #050308;
  opacity: 1;
  pointer-events: none;
}

.card-elim-screen > * {
  position: relative;
  z-index: 1;
}

.card-elim-screen--cut {
  animation:
    deathCutCard 0.48s ease-out both,
    deathFadeFinal 0.85s ease-out 0.45s both;
}

@keyframes deathCutCard {
  0% {
    transform: scale(1);
    filter: brightness(1);
    opacity: 0;
  }
  40% {
    transform: scale(1.05);
    filter: brightness(1.5);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    filter: brightness(1);
    opacity: 1;
  }
}

@keyframes deathFadeFinal {
  0% {
    filter: brightness(1);
    opacity: 1;
  }
  100% {
    filter: brightness(1);
    opacity: 1;
  }
}

.card-elim-screen__art {
  width: min(50%, 120px);
  height: auto;
  margin: 0 0 0.5rem;
  opacity: 0.42;
  filter: drop-shadow(0 0 6px rgba(168, 85, 247, 0.08));
}

.card-elim-screen__title {
  margin: 0;
  font-family: Orbitron, sans-serif;
  font-size: clamp(1.65rem, 5.5vw, 2.35rem);
  font-weight: 900;
  letter-spacing: 0.22em;
  color: #fecaca;
}

.card-elim-screen__hint {
  margin: 0.65rem 0 0;
  font-size: clamp(0.68rem, 2vw, 0.78rem);
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgba(196, 181, 253, 0.42);
  line-height: 1.4;
  max-width: 16rem;
}

.card-elim-screen__slot {
  margin: 1rem 0 0;
  font-size: clamp(1.85rem, 6vw, 2.65rem);
  font-weight: 900;
  font-family: Orbitron, sans-serif;
  color: rgba(248, 250, 252, 0.94);
  letter-spacing: 0.08em;
}

.card-grid-id {
  margin: 0 0 0.25rem;
  font-size: var(--cg-id-fs);
  letter-spacing: 0.14em;
  color: rgba(196, 181, 253, 0.55);
  font-family: 'Orbitron', sans-serif;
}

.card-grid-name {
  margin: 0 0 0.2rem;
  font-size: var(--cg-name-fs);
  font-weight: 700;
  color: #f5f3ff;
  line-height: 1.2;
}

.card-grid-meta {
  margin: 0 0 clamp(0.5rem, min(2vw, 2.2vh), 0.85rem);
  font-size: var(--cg-meta-fs);
  color: rgba(226, 232, 240, 0.9);
}

.placeholder {
  letter-spacing: 0.2em;
  color: rgba(196, 181, 253, 0.45);
}

.stats {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--cg-stat-gap);
}

.stats li {
  margin: 0;
  width: 100%;
}

.stat-cell {
  display: block;
  padding: var(--cg-stat-pad-y) var(--cg-stat-pad-x);
  border-radius: clamp(10px, 1.8vmin, 14px);
  background: rgba(0, 0, 0, 0.38);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: var(--cg-stat-fs);
  font-weight: 600;
  text-align: right;
  line-height: 1.45;
  transition:
    color 0.28s ease,
    border-color 0.28s ease,
    background 0.28s ease;
}

.stat-cell--label {
  color: rgba(148, 140, 180, 0.78);
  font-weight: 700;
  font-size: clamp(0.864rem, min(2.52vw, 3vh), 1.104rem);
  letter-spacing: 0.1em;
  font-family: ui-monospace, 'Cascadia Mono', monospace;
}

.stat-cell--open {
  position: relative;
  overflow: hidden;
  color: #f1f5f9;
  border-color: rgba(168, 85, 247, 0.28);
  text-align: right;
}

.stat-cell--wave {
  animation: revealWave 0.55s ease-out;
}

.stat-cell--drama {
  animation: revealWave 0.85s ease-out;
}

.stat-cell.value--revealed {
  animation: revealWave 0.55s ease-out, revealFlash 0.5s ease;
}

.stat-cell.value--revealed::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(
    120deg,
    transparent 0%,
    rgba(168, 85, 247, 0.28) 45%,
    transparent 90%
  );
  background-size: 220% 100%;
  background-position: -100% 0;
  animation: revealSheen 0.65s ease-out forwards;
}

@keyframes revealSheen {
  0% {
    background-position: -100% 0;
    opacity: 1;
  }
  100% {
    background-position: 200% 0;
    opacity: 0;
  }
}

@keyframes revealFlash {
  0% {
    background-color: rgba(255, 255, 255, 0.45);
    color: #0f172a;
  }
  35% {
    background-color: rgba(255, 255, 255, 0.2);
  }
  100% {
    background-color: transparent;
  }
}

@keyframes revealWave {
  0% {
    opacity: 0;
    filter: blur(8px);
    transform: scale(0.97);
  }
  45% {
    opacity: 1;
    filter: blur(0);
    transform: scale(1.02);
    text-shadow: 0 0 12px rgba(168, 85, 247, 0.45);
  }
  100% {
    opacity: 1;
    transform: scale(1);
    text-shadow: none;
  }
}

.badge-pop-enter-active,
.badge-pop-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.badge-pop-enter-from,
.badge-pop-leave-to {
  opacity: 0;
  transform: scale(0.88);
}

.hud-root {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-height: min(100vh, 100%);
  pointer-events: none;
  box-sizing: border-box;
  background: transparent;
}

.nominee-solo-float {
  position: fixed;
  top: max(0.55rem, env(safe-area-inset-top, 0px));
  right: max(0.55rem, env(safe-area-inset-right, 0px));
  z-index: 9;
  max-width: min(58vw, 15.5rem);
  margin: 0;
  padding: 0.38rem 0.55rem 0.42rem;
  text-align: right;
  pointer-events: none;
  border-radius: var(--hud-br, 12px);
  background: rgba(8, 5, 20, 0.94);
  border: 1px solid rgba(220, 38, 38, 0.42);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
}

.nominee-solo-float__k {
  margin: 0;
  font-size: clamp(0.5rem, min(1.35vw, 1.45vh), 0.62rem);
  font-weight: 800;
  letter-spacing: 0.14em;
  color: rgba(254, 202, 202, 0.95);
  text-transform: uppercase;
}

.nominee-solo-float__nom {
  margin: 0.12rem 0 0;
  font-size: clamp(0.48rem, min(1.25vw, 1.35vh), 0.58rem);
  color: rgba(226, 232, 240, 0.88);
}

.nominee-solo-float__who {
  margin: 0.08rem 0 0;
  font-size: clamp(0.52rem, min(1.4vw, 1.5vh), 0.65rem);
  font-weight: 700;
  color: #fecaca;
}

.idle-wait-cue {
  position: fixed;
  left: 50%;
  bottom: max(4.75rem, min(13vh, 8.5rem));
  transform: translateX(-50%);
  z-index: 7;
  margin: 0;
  padding: 0.28rem 0.75rem;
  border-radius: 999px;
  font-family: 'Orbitron', sans-serif;
  font-size: clamp(0.52rem, min(1.45vw, 1.6vh), 0.66rem);
  font-weight: 800;
  letter-spacing: 0.24em;
  color: rgba(226, 232, 240, 0.78);
  background: rgba(6, 4, 16, 0.72);
  border: 1px solid rgba(168, 85, 247, 0.22);
  pointer-events: none;
  text-shadow: 0 1px 5px rgba(0, 0, 0, 0.55);
}

/**
 * Персональний HUD: vmin/vw/vh — масштаб від розміру екрана.
 * Бічні колонки (bl/br) ширші за верхні (tl/tr).
 */
.hud-root--solo.hud-root--eliminated {
  background: #050308 !important;
  opacity: 1 !important;
}

.hud-root--solo {
  --hud-edge: clamp(0.55rem, min(2vw, 2.6vh), 2.15rem);
  --hud-side-max: min(48vw, clamp(16.5rem, 44vmin, 38rem));
  --hud-top-max: min(52vw, clamp(13rem, 36vmin, 26rem));
  --hud-pad-side: clamp(0.78rem, min(2.8vw, 3.2vh), 1.55rem);
  --hud-pad-top: clamp(0.68rem, min(2.2vw, 2.8vh), 1.25rem);
  /* +20%: характеристики, великий номер слота, таймер, голосування (ті ж класи) */
  --hud-stat-gap: clamp(0.54rem, min(2.04vw, 2.4vh), 1.02rem);
  --hud-stat-pad-y: clamp(0.816rem, min(3.36vw, 3.84vh), 1.62rem);
  --hud-stat-pad-x: clamp(0.9rem, min(3.84vw, 4.32vh), 1.86rem);
  --hud-stat-font: clamp(1.176rem, min(3.96vw, 4.32vh), 1.86rem);
  --hud-name: clamp(1.44rem, min(4.56vw, 5.04vh), 2.34rem);
  --hud-sub: clamp(1.02rem, min(2.9vw, 3.4vh), 1.38rem);
  --hud-slot: clamp(2.7rem, min(9vw, 10.2vh), 5.1rem);
  --hud-timer-ring: clamp(6.18rem, min(16.8vw, 18vh), 9.6rem);
  --hud-timer-fs: clamp(1.056rem, min(3.36vw, 3.6vh), 1.464rem);
  --hud-br: clamp(14px, 2.2vmin, 20px);
}

@media (max-width: 480px) {
  .hud-root--solo {
    --hud-side-max: min(48vw, 17.5rem);
    --hud-stat-font: clamp(1.02rem, min(4.08vw, 4.32vh), 1.38rem);
  }
}

@media (min-width: 1920px) {
  .hud-root--solo {
    --hud-stat-font: clamp(1.26rem, 1.26vw, 1.8rem);
    --hud-side-max: min(40vw, 38rem);
  }
}

/* Глобальна мозаїка: компактніший HUD, більше місця під відео по центру */
.hud-root--solo.hud-root--mosaic {
  --hud-edge: clamp(0.28rem, min(1.4cqw, 1.9cqh), 0.85rem);
  --hud-side-max: min(30cqw, clamp(3.2rem, 30cqmin, 10.5rem));
  --hud-top-max: min(36cqw, clamp(3rem, 26cqmin, 9.5rem));
  --hud-pad-side: clamp(0.32rem, min(1.6cqw, 2cqh), 0.62rem);
  --hud-pad-top: clamp(0.3rem, min(1.4cqw, 1.9cqh), 0.58rem);
  --hud-stat-gap: clamp(0.22rem, min(1.2cqw, 1.5cqh), 0.45rem);
  --hud-stat-pad-y: clamp(0.26rem, min(1.6cqw, 2cqh), 0.52rem);
  --hud-stat-pad-x: clamp(0.28rem, min(1.8cqw, 2.2cqh), 0.55rem);
  --hud-stat-font: clamp(0.36rem, min(2.1cqw, 2.3cqh), 0.62rem);
  --hud-name: clamp(0.48rem, min(2.5cqw, 2.7cqh), 0.78rem);
  --hud-sub: clamp(0.34rem, min(1.65cqw, 1.9cqh), 0.52rem);
  --hud-slot: clamp(0.78rem, min(4.2cqw, 4.8cqh), 1.55rem);
  --hud-timer-ring: clamp(1.65rem, min(7cqw, 8cqh), 3.6rem);
  --hud-timer-fs: clamp(0.36rem, min(1.75cqw, 1.95cqh), 0.55rem);
  --hud-br: clamp(4px, 1.2cqmin, 9px);
}

.hud-root--solo.hud-root--mosaic .vote-strip--solo {
  position: absolute;
  left: 50%;
  bottom: max(0.35rem, 1cqh);
  transform: translateX(-50%);
  min-width: min(92cqw, 11rem);
}

.hud-root--solo.hud-root--mosaic .nominee-solo-float {
  position: absolute;
  top: max(0.35rem, 0.9cqh);
  right: max(0.35rem, 0.9cqw);
  max-width: min(72cqw, 9.5rem);
}

.hud-root--solo.hud-root--mosaic .idle-wait-cue {
  position: absolute;
  left: 50%;
  bottom: max(1.75rem, 7cqh);
  transform: translateX(-50%);
}

.hud-root--solo.hud-root--mosaic.hud-root--vote-target-ambient:not(.hud-root--eliminated)::after {
  position: absolute;
}

.hud-root--solo.hud-root--mosaic .ac-chip {
  bottom: var(--hud-edge);
  max-width: min(82cqw, 7.5rem);
  padding: clamp(0.12rem, 1cqh, 0.22rem) clamp(0.22rem, 1.6cqw, 0.38rem);
  gap: clamp(0.1rem, 0.9cqw, 0.2rem);
}

.hud-root--solo.hud-root--mosaic .ac-chip-ico {
  font-size: clamp(0.42rem, 2cqh, 0.58rem);
}

.hud-root--solo.hud-root--mosaic .ac-chip-t {
  font-size: clamp(0.38rem, 1.85cqh, 0.54rem);
}

.hud-root--solo.hud-root--mosaic .hand-wait-hud {
  margin-bottom: clamp(0.08rem, 0.65cqh, 0.18rem);
  padding: clamp(0.08rem, 0.65cqh, 0.15rem) clamp(0.18rem, 1.3cqw, 0.3rem);
  gap: clamp(0.08rem, 0.85cqw, 0.16rem);
}

.hud-root--solo.hud-root--mosaic .hand-wait-hud__ico {
  font-size: clamp(0.48rem, 1.95cqh, 0.65rem);
}

.hud-root--solo.hud-root--mosaic .hand-wait-hud__txt {
  font-size: clamp(0.32rem, 1.45cqh, 0.46rem);
  letter-spacing: 0.1em;
}

/* Spotlight без спікера: окремий стиль — рамка + м’який glow, без пульсу */
.hud-root--solo.hud-root--spotlight:not(.hud-root--speaker) .hud-block {
  border-color: rgba(168, 85, 247, 0.48);
  box-shadow:
    0 2px 12px rgba(0, 0, 0, 0.32),
    0 0 0 1px rgba(168, 85, 247, 0.38),
    0 0 22px rgba(168, 85, 247, 0.16);
}

.hud-root--solo.hud-root--spotlight:not(.hud-root--speaker) .hud-stat-inner {
  border-color: rgba(168, 85, 247, 0.26);
}

/* Спікер: без outline на весь кадр — акцент лише на блоці з таймером (hud-tr) */
.hud-root--solo.hud-root--speaker:not(.hud-root--eliminated):not(.hud-root--nominated) .hud-block:not(.hud-tr) {
  box-shadow:
    0 2px 14px rgba(0, 0, 0, 0.28),
    0 0 0 1px rgba(168, 85, 247, 0.16),
    0 0 10px rgba(168, 85, 247, 0.06);
}

.hud-block.hud-tr.hud-block--speaker-live {
  border-radius: var(--hud-br);
  animation: hudTrSpeakerGlow 2.1s ease-in-out infinite;
}

.hud-block.hud-tr.hud-block--speaker-live.hud-tr--urgent {
  animation: none;
  box-shadow:
    0 2px 14px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(239, 68, 68, 0.35),
    0 0 14px rgba(239, 68, 68, 0.15);
}

@keyframes hudTrSpeakerGlow {
  0%,
  100% {
    box-shadow:
      0 2px 14px rgba(0, 0, 0, 0.28),
      0 0 0 1px rgba(168, 85, 247, 0.26),
      0 0 14px rgba(168, 85, 247, 0.12);
  }
  50% {
    box-shadow:
      0 2px 18px rgba(0, 0, 0, 0.34),
      0 0 0 1px rgba(216, 180, 254, 0.5),
      0 0 28px rgba(168, 85, 247, 0.28);
  }
}

.hud-root--solo.hud-root--nominated:not(.hud-root--eliminated) {
  outline: 1px solid rgba(220, 38, 38, 0.45);
  outline-offset: 2px;
  animation: nominatedPulseSolo 2.5s ease-in-out infinite;
}

@keyframes nominatedPulseSolo {
  0%,
  100% {
    outline-color: rgba(220, 38, 38, 0.4);
  }
  50% {
    outline-color: rgba(220, 38, 38, 0.62);
  }
}

.hud-root--solo.hud-root--vote-target-ambient:not(.hud-root--eliminated) {
  isolation: isolate;
}

.hud-root--solo.hud-root--vote-target-ambient:not(.hud-root--eliminated)::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: radial-gradient(ellipse at 50% 35%, rgba(220, 38, 38, 0.45) 0%, transparent 55%);
  opacity: 0.05;
}

.hand-wait-hud--pop {
  animation: handPopNudge 0.12s ease;
}

.hud-root--solo.hud-root--nominated:not(.hud-root--eliminated) .hud-block:not(.hud-tr) {
  border-color: rgba(220, 38, 38, 0.35);
  box-shadow:
    0 2px 14px rgba(0, 0, 0, 0.28),
    0 0 0 1px rgba(220, 38, 38, 0.12);
}

.hud-root--solo.hud-root--nominated:not(.hud-root--eliminated) .hud-block.hud-tr:not(.hud-block--speaker-live) {
  border-color: rgba(220, 38, 38, 0.32);
}

.hand-wait-hud {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.35rem;
  margin-bottom: 0.35rem;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  background: rgba(8, 6, 18, 0.88);
  border: 1px solid rgba(251, 191, 36, 0.32);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.28);
}

.hand-wait-hud__ico {
  font-size: clamp(0.78rem, min(2.2vw, 2.4vh), 1rem);
  line-height: 1;
}

.hand-wait-hud__txt {
  font-size: clamp(0.48rem, min(1.4vw, 1.55vh), 0.62rem);
  font-weight: 800;
  letter-spacing: 0.14em;
  color: rgba(254, 243, 199, 0.92);
  white-space: nowrap;
}

.hud-slot-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.22rem;
}

.hud-tr-top {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.35rem;
}

.hud-speak-badge {
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  font-size: clamp(0.52rem, min(1.55vw, 1.75vh), 0.65rem);
  font-weight: 800;
  letter-spacing: 0.12em;
  color: rgba(250, 245, 255, 0.92);
  background: rgba(24, 12, 40, 0.92);
  border: 1px solid rgba(168, 85, 247, 0.4);
  line-height: 1;
  box-shadow: 0 0 14px rgba(168, 85, 247, 0.2);
}

.hud-ring-wrap--urgent,
.hud-ring-wrap.timer--danger {
  animation: timerDangerPulse 0.6s ease-in-out infinite;
}

.hud-timer-label--urgent,
.hud-timer-label.timer--danger {
  color: #ef4444 !important;
  text-shadow:
    0 0 10px rgba(239, 68, 68, 0.45),
    0 1px 3px rgba(0, 0, 0, 0.5) !important;
}

.hud-root--solo .hud-timer-label:not(.hud-timer-label--urgent) {
  text-shadow:
    0 0 12px rgba(168, 85, 247, 0.28),
    0 1px 3px rgba(0, 0, 0, 0.45);
}

.hud-stat-inner.value--revealed {
  animation: revealWave 0.55s ease-out, revealFlash 0.5s ease;
}

.hud-stat-inner.value--revealed::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(
    120deg,
    transparent 0%,
    rgba(168, 85, 247, 0.28) 45%,
    transparent 90%
  );
  background-size: 220% 100%;
  animation: revealSheen 0.65s ease-out forwards;
}

.hud-root--solo.hud-root--speaker:not(.hud-root--eliminated)
  .hud-ring-wrap:not(.hud-ring-wrap--urgent):not(.timer--danger)
  .hud-ring {
  animation: speakerRingPulse 1.6s ease-in-out infinite;
  transform-origin: center;
}

@keyframes speakerRingPulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.04);
  }
}

.elim-solo-screen {
  position: absolute;
  inset: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  padding: clamp(1rem, 4vw, 2rem);
  box-sizing: border-box;
  overflow: hidden;
  background: #050308;
}

.elim-solo-screen--cut {
  animation:
    deathCutSolo 0.48s ease-out both,
    elimSoloFadeFinal 0.85s ease-out 0.45s both;
}

@keyframes elimSoloFadeFinal {
  0% {
    filter: brightness(1);
    opacity: 1;
  }
  100% {
    filter: brightness(0.96);
    opacity: 1;
  }
}

@keyframes deathCutSolo {
  0% {
    transform: scale(1);
    filter: brightness(1);
  }
  40% {
    transform: scale(1.04);
    filter: brightness(1.55);
  }
  100% {
    transform: scale(1);
    filter: brightness(1);
  }
}

.elim-solo-screen__base {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-color: #050308;
  opacity: 1;
  transform-origin: center center;
  animation: elimSoloBgZoom 6s ease-in-out forwards;
}

@keyframes elimSoloBgZoom {
  from {
    transform: scale(1);
  }
  to {
    transform: scale(1.05);
  }
}

.elim-solo-screen__mark {
  position: absolute;
  left: 50%;
  top: 26%;
  transform: translate(-50%, -50%);
  z-index: 1;
  width: min(42vw, 200px);
  height: auto;
  opacity: 0.58;
  pointer-events: none;
  filter: drop-shadow(0 0 10px rgba(168, 85, 247, 0.1));
}

.elim-solo-screen__content {
  position: relative;
  z-index: 2;
  max-width: min(92vw, 420px);
  text-align: center;
  margin-top: clamp(4.5rem, 22vh, 7rem);
  animation: elimSoloIn 0.65s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both;
}

@keyframes elimSoloIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.elim-solo-screen__kicker {
  margin: 0 0 0.5rem;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(196, 181, 253, 0.38);
  font-family: 'Orbitron', sans-serif;
}

.elim-solo-screen__title {
  margin: 0;
  font-family: 'Orbitron', sans-serif;
  font-size: clamp(2.65rem, 11vw, 4.25rem);
  font-weight: 900;
  letter-spacing: 0.14em;
  line-height: 1.05;
  color: #fecaca;
}

.elim-solo-screen__subline {
  margin: 1rem 0 0;
  font-size: clamp(0.88rem, 2.8vw, 1.05rem);
  font-weight: 600;
  letter-spacing: 0.06em;
  color: rgba(203, 213, 225, 0.78);
  line-height: 1.45;
}

.elim-solo-screen__slot {
  margin: 1.35rem 0 0;
  font-size: clamp(1.75rem, 6.5vw, 2.75rem);
  font-weight: 900;
  font-family: 'Orbitron', sans-serif;
  letter-spacing: 0.1em;
  color: rgba(248, 250, 252, 0.95);
}

.hud-root--solo .ac-chip {
  bottom: var(--hud-edge);
  max-width: min(92vw, clamp(18rem, 58vmin, 36rem));
  padding: clamp(0.42rem, min(1.8vw, 2vh), 0.62rem) clamp(0.72rem, min(2.6vw, 2.8vh), 1.15rem)
    clamp(0.42rem, min(1.8vw, 2vh), 0.62rem) clamp(0.55rem, min(2.2vw, 2.4vh), 0.85rem);
}

.ac-chip {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 8;
  display: inline-flex;
  align-items: center;
  gap: clamp(0.35rem, 1.5vmin, 0.55rem);
  border-radius: 999px;
  background: rgba(10, 6, 22, 0.98);
  border: 1px solid rgba(168, 85, 247, 0.42);
  box-shadow:
    0 3px 12px rgba(0, 0, 0, 0.32),
    0 0 18px rgba(168, 85, 247, 0.14);
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}

.ac-chip:not(.ac-chip--used) {
  animation: cardHintPulse 3s ease-in-out infinite;
}

@keyframes cardHintPulse {
  0%,
  100% {
    opacity: 0.88;
    box-shadow:
      0 3px 12px rgba(0, 0, 0, 0.32),
      0 0 14px rgba(168, 85, 247, 0.1);
  }
  50% {
    opacity: 1;
    box-shadow:
      0 3px 12px rgba(0, 0, 0, 0.32),
      0 0 22px rgba(168, 85, 247, 0.22);
  }
}

.ac-chip--used {
  opacity: 0.65;
  border-color: rgba(148, 163, 184, 0.35);
}

.ac-chip-ico {
  font-size: clamp(0.85rem, min(2.6vw, 2.8vh), 1.15rem);
  line-height: 1;
}

.hud-root--solo .ac-chip-t {
  font-size: clamp(0.82rem, min(2.5vw, 2.7vh), 1.12rem);
}

.ac-chip-t {
  font-weight: 700;
  color: #ede9fe;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hud-zones {
  position: absolute;
  inset: 0;
  z-index: 3;
}

.hud-block {
  position: absolute;
  background: rgba(8, 5, 20, 0.98);
  border: 1px solid rgba(168, 85, 247, 0.34);
  box-shadow:
    0 4px 18px rgba(0, 0, 0, 0.38),
    0 0 0 1px rgba(168, 85, 247, 0.06);
  transition:
    border-color 0.35s ease,
    box-shadow 0.35s ease;
}

.hud-root--solo .hud-block {
  border-radius: var(--hud-br);
}

.hud-root--solo .hud-block.hud-tl,
.hud-root--solo .hud-block.hud-tr {
  max-width: var(--hud-top-max);
  padding: var(--hud-pad-top) clamp(0.55rem, min(2vw, 2.4vh), 1rem);
}

.hud-root--solo .hud-block.hud-bl,
.hud-root--solo .hud-block.hud-br {
  max-width: var(--hud-side-max);
  padding: var(--hud-pad-side);
}

.hud-tl {
  top: var(--hud-edge, clamp(0.5rem, 1.4vh, 1.1rem));
  left: var(--hud-edge, clamp(0.5rem, 1.4vw, 1.1rem));
}

.hud-tr {
  top: var(--hud-edge, clamp(0.5rem, 1.4vh, 1.1rem));
  right: var(--hud-edge, clamp(0.5rem, 1.4vw, 1.1rem));
  text-align: right;
}

.hud-bl {
  bottom: var(--hud-edge, clamp(0.5rem, 1.4vh, 1.1rem));
  left: var(--hud-edge, clamp(0.5rem, 1.4vw, 1.1rem));
}

.hud-br {
  bottom: var(--hud-edge, clamp(0.5rem, 1.4vh, 1.1rem));
  right: var(--hud-edge, clamp(0.5rem, 1.4vw, 1.1rem));
  text-align: right;
}

.hud-line {
  margin: 0;
  color: #f5f3ff;
  line-height: 1.3;
}

.hud-root--solo .hud-line--name {
  font-size: var(--hud-name);
}

.hud-line--name {
  font-weight: 700;
}

.hud-root--solo .hud-line--sub {
  font-size: var(--hud-sub);
}

.hud-line--sub {
  margin-top: 0.25rem;
  color: rgba(226, 232, 240, 0.92);
}

.hud-ph {
  letter-spacing: 0.18em;
  color: rgba(196, 181, 253, 0.5);
}

.hud-root--solo .hud-slot {
  font-size: var(--hud-slot);
}

.hud-slot {
  font-weight: 900;
  color: #faf5ff;
  font-family: 'Orbitron', sans-serif;
  line-height: 1;
  text-shadow: 0 0 14px rgba(168, 85, 247, 0.22);
}

.hud-timer-stack {
  margin-top: clamp(0.35rem, min(1.4vw, 1.6vh), 0.55rem);
  display: flex;
  justify-content: flex-end;
}

.hud-root--solo .hud-ring-wrap {
  width: var(--hud-timer-ring);
  height: var(--hud-timer-ring);
}

.hud-ring-wrap {
  position: relative;
  width: 74px;
  height: 74px;
  display: grid;
  place-items: center;
}

.hud-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  transition: background 0.3s linear;
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 3px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 3px));
}

.hud-root--solo .hud-timer-label {
  font-size: var(--hud-timer-fs);
}

.hud-timer-label {
  position: relative;
  z-index: 1;
  font-weight: 800;
  font-family: 'Orbitron', sans-serif;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.55);
}

.hud-root--solo .hud-stat {
  margin-bottom: var(--hud-stat-gap);
}

.hud-stat {
  margin-bottom: 0.4rem;
  width: 100%;
}

.hud-stat:last-child {
  margin-bottom: 0;
}

.hud-root--solo .hud-stat-inner {
  padding: var(--hud-stat-pad-y) var(--hud-stat-pad-x);
  font-size: var(--hud-stat-font);
  border-radius: clamp(10px, 1.8vmin, 14px);
}

.hud-stat-inner {
  display: block;
  padding: 0.45rem 0.58rem;
  border-radius: 11px;
  background: rgba(10, 6, 22, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-weight: 600;
  line-height: 1.38;
  transition:
    color 0.28s ease,
    border-color 0.28s ease;
}

.hud-stat-inner--label {
  color: rgba(148, 140, 180, 0.82);
  font-weight: 700;
  font-size: clamp(0.864rem, min(2.88vw, 3.24vh), 1.14rem);
  letter-spacing: 0.1em;
  font-family: ui-monospace, 'Cascadia Mono', monospace;
}

.hud-br .hud-stat-inner {
  text-align: right;
}

.hud-stat-inner--open {
  position: relative;
  overflow: hidden;
  color: #f1f5f9;
  border-color: rgba(168, 85, 247, 0.3);
}

.hud-stat-inner--wave {
  animation: revealWave 0.55s ease-out;
}

.hud-stat-inner--drama {
  animation: revealWave 0.85s ease-out;
}

.hud-root--drama .hud-block {
  border-color: rgba(185, 28, 28, 0.22);
}
</style>
