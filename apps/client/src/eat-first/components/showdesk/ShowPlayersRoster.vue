<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { normalizePlayerSlotId } from '../../utils/playerSlot.js'

const { t } = useI18n()

const props = defineProps({
  players: { type: Array, default: () => [] },
  handsMap: { type: Object, default: () => ({}) },
  currentPlayerId: { type: String, default: '' },
  spotlightPlayerId: { type: String, default: '' },
  speakerId: { type: String, default: '' },
  votingTargetId: { type: String, default: '' },
  votingActive: { type: Boolean, default: false },
  /** Нормалізовані номінації [{ target, by }] */
  nominations: { type: Array, default: () => [] },
  /** games/{gameId}.playersReady — слот → true */
  playersReadyMap: { type: Object, default: () => ({}) },
  /** Вибраний слот для панелі дій */
  selectedPlayerId: { type: String, default: '' },
  /** Режим ведучого: сітка + панель без модалки */
  useHostPanel: { type: Boolean, default: false },
  /** Слоти для чипів «кого номінують» (ціль номінації) */
  playerSlots: { type: Array, default: () => [] },
  /** Слоти, позначені чекбоксом для масових дій (ведучий) */
  bulkSelectedIds: { type: Array, default: () => [] },
  /** Підказка порядку номінацій / черги голосування */
  orderHint: { type: String, default: '' },
  /** Список слотів, що вже віддали голос у поточному раунді */
  votedPlayerIdsThisRound: { type: Array, default: () => [] },
  /**
   * Останній слот черги = останній за номінаціями: спочатку показуємо тих, хто ще не голосував
   * (руки / порядок карток).
   */
  prioritizeNonVoterHands: { type: Boolean, default: false },
})

const emit = defineEmits([
  'open-editor',
  'host-command',
  'update:selectedPlayerId',
  'toggle-nomination',
  'toggle-bulk',
  'apply-ballot-order',
  'bulk-delete-request',
  'bulk-clear',
])

function cardActive(p) {
  const ac = p.activeCard
  if (!ac || typeof ac !== 'object') return false
  return !ac.used
}

function slotNum(id) {
  const s = String(id ?? '')
  const m = s.match(/^p(\d+)$/i)
  if (m) return m[1]
  return s.replace(/^p/i, '') || s
}

function nominatorsFor(pid) {
  const id = String(pid ?? '')
  return props.nominations.filter((n) => String(n.target) === id).map((n) => slotNum(n.by))
}

function nominatorsLine(pid) {
  const nums = nominatorsFor(pid)
  return nums.length ? nums.join(', ') : ''
}

function playerDisplayName(p) {
  const nm = typeof p?.name === 'string' ? p.name.trim() : ''
  return nm.length ? nm : ''
}

/** Під номером слота: нік (якщо є), інакше статуси / «—». */
function cardSubtitle(p) {
  if (p.eliminated === true) return t('roster.eliminated')
  const nm = playerDisplayName(p)
  if (nm) return nm
  if (String(p.id) === String(props.spotlightPlayerId || '').trim()) return t('roster.spotlightStatus')
  return t('roster.statusDash')
}

function cardSubtitleIsName(p) {
  if (p.eliminated === true) return false
  return Boolean(playerDisplayName(p))
}

function isSpeak(p) {
  return p.eliminated !== true && String(p.id) === String(props.speakerId || '').trim()
}

function isVoteTargetCard(p) {
  const sp = String(props.speakerId || '').trim()
  const vt = String(props.votingTargetId || '').trim()
  return (
    p.eliminated !== true &&
    props.votingActive &&
    Boolean(vt) &&
    String(p.id) === vt &&
    String(p.id) !== sp
  )
}

function isNominatedCard(p) {
  return p.eliminated !== true && nominatorsFor(p.id).length > 0
}

function isPlayerReady(p) {
  if (p.eliminated === true) return false
  const m = props.playersReadyMap
  if (!m || typeof m !== 'object') return false
  return m[String(p.id)] === true || m[normalizePlayerSlotId(String(p.id))] === true
}

function showBadgesRow(p) {
  if (p.eliminated === true) return false
  if (isSpeak(p)) return true
  return isVoteTargetCard(p) || isNominatedCard(p)
}

function handUp(p) {
  const id = normalizePlayerSlotId(String(p.id))
  return props.handsMap?.[id] === true
}

const votedSet = computed(() => {
  const s = new Set()
  for (const id of props.votedPlayerIdsThisRound || []) {
    const n = normalizePlayerSlotId(String(id ?? ''))
    if (n) s.add(n)
  }
  return s
})

const playersSorted = computed(() => {
  const list = [...props.players]
  const pri = props.prioritizeNonVoterHands && props.useHostPanel
  const vset = votedSet.value
  list.sort((a, b) => {
    const ida = normalizePlayerSlotId(String(a.id))
    const idb = normalizePlayerSlotId(String(b.id))
    if (pri) {
      const av = vset.has(ida) ? 1 : 0
      const bv = vset.has(idb) ? 1 : 0
      if (av !== bv) return av - bv
    }
    const ah = handUp(a) ? 1 : 0
    const bh = handUp(b) ? 1 : 0
    if (bh !== ah) return bh - ah
    return String(a.id).localeCompare(String(b.id), undefined, { numeric: true, sensitivity: 'base' })
  })
  return list
})

const selectedPlayer = computed(() => {
  const id = String(props.selectedPlayerId || '').trim()
  if (!id) return null
  return props.players.find((p) => String(p.id) === id) || null
})

const selectedEliminated = computed(() => selectedPlayer.value?.eliminated === true)

const spotlightOnSelected = computed(
  () =>
    Boolean(props.selectedPlayerId) &&
    String(props.spotlightPlayerId || '').trim() === String(props.selectedPlayerId),
)

const speakerOnSelected = computed(
  () =>
    Boolean(props.selectedPlayerId) &&
    String(props.speakerId || '').trim() === String(props.selectedPlayerId),
)

function onCardClick(p) {
  if (props.useHostPanel) {
    // Без toggle в «порожнечу»: один клік = вибір слота; зняти вибір можна лише обравши іншого гравця.
    emit('update:selectedPlayerId', String(p.id))
    return
  }
  emit('open-editor', p.id)
}

function openEditorSelected() {
  const id = props.selectedPlayerId
  if (id) emit('open-editor', id)
}

function cmd(type) {
  const id = String(props.selectedPlayerId || '').trim()
  if (!id) return
  emit('host-command', { type, playerId: id })
}

/** Обрана картка = хто виставляє (by); chip = кого виставляють (target). */
function pairActive(slot) {
  const by = String(props.selectedPlayerId || '').trim()
  const tgt = String(slot || '').trim()
  if (!tgt || !by) return false
  return props.nominations.some((n) => String(n.target) === tgt && String(n.by) === by)
}

function toggleNom(targetSlot) {
  const by = String(props.selectedPlayerId || '').trim()
  const target = String(targetSlot || '').trim()
  if (!target || !by || selectedEliminated.value) return
  emit('toggle-nomination', { target, by })
}

function isBulkChecked(pid) {
  const id = String(pid ?? '')
  return props.bulkSelectedIds.some((x) => String(x) === id)
}

function onBulkCheckboxChange(p, ev) {
  ev.stopPropagation()
  emit('toggle-bulk', { id: p.id, checked: ev.target.checked })
}

function onElimCardClick(p) {
  if (!props.useHostPanel) return
  emit('host-command', {
    type: p.eliminated === true ? 'revive-player' : 'eliminate-player',
    playerId: String(p.id),
  })
}

const aliveSlotsForNom = computed(() => {
  const dead = new Set(props.players.filter((p) => p.eliminated === true).map((p) => String(p.id)))
  return props.playerSlots.filter((s) => !dead.has(String(s)))
})
</script>

<template>
  <section class="roster" :class="{ 'roster--embedded': useHostPanel }">
    <h2 v-if="!useHostPanel" class="block-title">{{ t('roster.title') }}</h2>
    <p class="roster-hint">
      {{ useHostPanel ? t('roster.hintPanel') : t('roster.hintClick') }}
    </p>
    <p v-if="useHostPanel && orderHint" class="roster-order-hint">{{ orderHint }}</p>
    <p v-if="useHostPanel && prioritizeNonVoterHands" class="roster-nonvote-hint">{{ t('roster.nonVoterHandsFirst') }}</p>
    <p v-if="useHostPanel" class="roster-bulk-hint">{{ t('roster.bulkHint') }}</p>

    <div class="roster-shell" :class="{ 'roster-shell--panel': useHostPanel }">
      <div class="roster-grid" :class="{ 'roster-grid--host-panel': useHostPanel }">
        <div
          v-for="p in playersSorted"
          :key="p.id"
          class="pcard-shell"
          :class="{
            'pcard-shell--bulk-on': useHostPanel && isBulkChecked(p.id),
            'pcard-shell--host-bulk': useHostPanel && p.eliminated !== true,
          }"
        >
          <label
            v-if="useHostPanel && p.eliminated !== true"
            class="pcard-bulk ui-checkbox"
            :title="t('roster.bulkCheckTitle')"
            @click.stop
          >
            <span class="ui-checkbox__hit">
              <input
                type="checkbox"
                :checked="isBulkChecked(p.id)"
                @change="onBulkCheckboxChange(p, $event)"
              />
              <span class="ui-checkbox__box" aria-hidden="true" />
            </span>
          </label>
          <button
            type="button"
            class="pcard"
            :class="{
              on: p.id === currentPlayerId,
              pick: useHostPanel && String(selectedPlayerId) === String(p.id),
              elim: p.eliminated === true,
              speak: String(speakerId || '').trim() === p.id,
              spot: String(spotlightPlayerId || '').trim() === p.id,
              'pcard--hand': handUp(p),
              'pcard--vote-target':
                votingActive &&
                String(votingTargetId || '').trim() === p.id &&
                p.eliminated !== true &&
                String(speakerId || '').trim() !== p.id,
            }"
            @click="onCardClick(p)"
          >
          <span
            v-if="handUp(p) && p.eliminated !== true"
            class="pcard-hand-corner"
            aria-label="Піднята рука"
            title="Піднята рука"
          >
            ✋
          </span>
          <span
            v-if="isPlayerReady(p)"
            class="pcard-ready-corner"
            :aria-label="t('roster.readyCorner')"
            :title="t('roster.readyCorner')"
          >
            ✓
          </span>
          <span v-if="p.eliminated === true" class="elim-badge" aria-hidden="true">{{ t('roster.eliminated') }}</span>
          <div v-if="useHostPanel" class="pcard-host-top">
            <div v-if="p.eliminated !== true && showBadgesRow(p)" class="pcard-badges">
              <span v-if="isSpeak(p)" class="pcb pcb--speak">{{ t('roster.speaking') }}</span>
              <template v-else>
                <span v-if="isVoteTargetCard(p)" class="pcb pcb--target">{{ t('roster.targetBadge') }}</span>
                <template v-if="isNominatedCard(p)">
                  <span class="pcb pcb--nom">{{ t('roster.nomBadge') }}</span>
                  <span class="pcb pcb--nom-who">{{ nominatorsLine(p.id) }}</span>
                </template>
              </template>
            </div>
            <div v-else class="pcard-badges pcard-badges--reserve" aria-hidden="true" />
          </div>
          <div v-else-if="showBadgesRow(p)" class="pcard-badges">
            <span v-if="isSpeak(p)" class="pcb pcb--speak">{{ t('roster.speaking') }}</span>
            <template v-else>
              <span v-if="isVoteTargetCard(p)" class="pcb pcb--target">{{ t('roster.targetBadge') }}</span>
              <template v-if="isNominatedCard(p)">
                <span class="pcb pcb--nom">{{ t('roster.nomBadge') }}</span>
                <span class="pcb pcb--nom-who">{{ nominatorsLine(p.id) }}</span>
              </template>
            </template>
          </div>
          <span class="num">{{ slotNum(p.id) }}</span>
          <span class="st" :class="{ 'st--name': cardSubtitleIsName(p) }">{{ cardSubtitle(p) }}</span>
          <span v-if="cardActive(p)" class="card-ico" :title="t('roster.activeCardTitle')">🃏</span>
          </button>
          <button
            v-if="useHostPanel"
            type="button"
            class="pcard-elim-btn"
            :class="{ 'pcard-elim-btn--revive': p.eliminated === true }"
            @click.stop="onElimCardClick(p)"
          >
            {{ p.eliminated === true ? t('roster.reviveShort') : t('roster.eliminateShort') }}
          </button>
        </div>
      </div>

      <aside v-if="useHostPanel" class="act-panel">
        <template v-if="bulkSelectedIds.length">
          <p class="act-bulk-meta">{{ t('roster.bulkSelected', { n: bulkSelectedIds.length }) }}</p>
          <button type="button" class="act-btn act-btn--danger" @click="emit('bulk-delete-request')">
            {{ t('roster.bulkDelete', { n: bulkSelectedIds.length }) }}
          </button>
          <button type="button" class="act-btn act-btn--ghost" @click="emit('bulk-clear')">
            {{ t('roster.bulkClear') }}
          </button>
          <hr class="act-divider" />
        </template>
        <button type="button" class="act-btn act-btn--soft act-btn--ballot" @click="emit('apply-ballot-order')">
          {{ t('roster.ballotFromNom') }}
        </button>
        <template v-if="selectedPlayer">
          <p class="act-panel__id">{{ selectedPlayerId }}</p>

          <button type="button" class="act-btn act-btn--soft" @click="openEditorSelected">{{ t('roster.editor') }}</button>

          <template v-if="!selectedEliminated">
            <button v-if="!speakerOnSelected" type="button" class="act-btn" @click="cmd('speaker')">
              {{ t('roster.speaker') }}
            </button>
            <button v-else type="button" class="act-btn" @click="cmd('speaker')">{{ t('roster.speakerOff') }}</button>

            <p class="act-sub">{{ t('roster.nominate') }}</p>
            <p class="act-micro">{{ t('roster.nominateHint') }}</p>
            <div class="act-chips">
              <button
                v-for="slot in aliveSlotsForNom"
                :key="'nom-' + slot"
                type="button"
                class="nchip"
                :class="{ 'nchip--on': pairActive(slot), 'nchip--self': String(slot) === String(selectedPlayerId) }"
                :disabled="String(slot) === String(selectedPlayerId)"
                @click="toggleNom(slot)"
              >
                {{ slotNum(slot) }}
              </button>
            </div>

            <button type="button" class="act-btn" @click="cmd('vote-target')">{{ t('roster.voteTarget') }}</button>
            <button type="button" class="act-btn act-btn--soft" @click="cmd('spotlight')">
              {{ spotlightOnSelected ? t('roster.spotlightOff') : t('roster.spotlight') }}
            </button>
          </template>

          <button type="button" class="act-btn act-btn--danger" @click="cmd('delete-player')">
            {{ t('roster.deletePlayer') }}
          </button>
          <button type="button" class="act-btn act-btn--danger" @click="cmd('reset')">{{ t('roster.reset') }}</button>
        </template>
        <p v-else class="act-empty">{{ t('roster.pickSlot') }}</p>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.roster {
  padding: 1.15rem 1.2rem 1.25rem;
  border-radius: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  margin-bottom: 1.35rem;
  box-shadow: var(--panel-desk-shadow, none);
}

.block-title {
  margin: 0 0 0.55rem;
  font-size: 0.88rem;
  font-weight: 800;
  color: var(--text-heading);
  font-family: 'Orbitron', sans-serif;
  letter-spacing: 0.06em;
}

.roster-hint {
  margin: 0 0 1.05rem;
  font-size: 0.65rem;
  line-height: 1.35;
  color: var(--text-muted);
}

.roster-order-hint {
  margin: -0.4rem 0 0.45rem;
  font-size: 0.62rem;
  line-height: 1.35;
  color: var(--text-cyan-strong, #7dd3fc);
  font-weight: 700;
}

.roster-nonvote-hint {
  margin: -0.15rem 0 0.5rem;
  font-size: 0.58rem;
  line-height: 1.35;
  color: var(--text-highlight);
  font-weight: 800;
  letter-spacing: 0.05em;
}

.roster-bulk-hint {
  margin: 0 0 0.55rem;
  font-size: 0.58rem;
  line-height: 1.3;
  color: var(--text-muted);
}

.pcard-shell {
  position: relative;
  /* Не даємо слоту стиснутись у «смужку» поруч з панеллю ведучого. */
  min-width: min(100%, 7.25rem);
}

.pcard-shell--bulk-on .pcard {
  border-color: var(--border-cyan-strong, rgba(94, 231, 223, 0.55));
  box-shadow: 0 0 0 1px rgba(94, 231, 223, 0.2);
}

.pcard-bulk {
  position: absolute;
  left: 0.12rem;
  top: 0.12rem;
  z-index: 5;
  margin: 0;
  cursor: pointer;
}

.pcard-bulk.ui-checkbox {
  --ui-check-size: 1.05rem;
}

.act-bulk-meta {
  margin: 0 0 0.4rem;
  font-size: 0.62rem;
  font-weight: 800;
  color: var(--text-highlight);
}

.act-divider {
  margin: 0.65rem 0;
  border: none;
  border-top: 1px solid var(--border-subtle);
}

.act-btn--ghost {
  border: 1px dashed var(--border-subtle);
  background: transparent;
  color: var(--text-muted);
}

.roster--embedded {
  padding: 0;
  margin-bottom: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  border-radius: 0;
}

.roster--embedded .roster-hint {
  margin-top: 0;
}

.roster-shell {
  display: block;
}

.roster-shell--panel {
  display: grid;
  grid-template-columns: 1fr minmax(200px, 38%);
  gap: 0.75rem;
  align-items: start;
}

@media (max-width: 720px) {
  .roster-shell--panel {
    grid-template-columns: 1fr;
  }
}

.roster-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 0.45rem;
}

/* Запас під scale(1.03) при hover, щоби світіння рамки не ловив overflow батьківського блоку. */
.roster-grid--host-panel {
  padding: 0.4rem 0.3rem;
  margin: -0.15rem -0.1rem 0;
  /* Більші клітинки → 3–4 рядки при ~10 слотах замість одного довгого ряду. */
  grid-template-columns: repeat(auto-fill, minmax(9.75rem, 1fr));
  gap: 0.55rem 0.5rem;
}

.roster-grid--host-panel .pcard-shell {
  min-width: min(100%, 9.75rem);
  border-radius: 12px;
  overflow: visible;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  gap: 0.22rem;
}

.roster-grid--host-panel .pcard {
  height: 7.05rem;
  min-height: 7.05rem;
  max-height: 7.05rem;
  padding: 0.52rem 0.44rem 0.52rem;
  gap: 0.26rem;
  justify-content: flex-start;
}

.pcard-elim-btn {
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 0.26rem 0.35rem;
  border-radius: 10px;
  border: 1px solid rgba(248, 113, 113, 0.45);
  font-size: 0.5rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  background: rgba(127, 29, 29, 0.65);
  color: #fecaca;
  line-height: 1.2;
  transition:
    transform 0.12s ease,
    border-color 0.15s;
}

.pcard-elim-btn:hover {
  transform: scale(1.02);
  border-color: rgba(252, 165, 165, 0.65);
}

.pcard-elim-btn--revive {
  border-color: rgba(74, 222, 128, 0.45);
  background: rgba(22, 101, 52, 0.45);
  color: #bbf7d0;
}

.pcard-elim-btn--revive:hover {
  border-color: rgba(52, 211, 153, 0.65);
}

.pcard-host-top {
  width: 100%;
  min-height: 1.32rem;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  margin-bottom: 0.12rem;
  flex-shrink: 0;
}

.roster-grid--host-panel .pcard-badges {
  min-height: 1.12rem;
  margin-bottom: 0;
}

.pcard-badges--reserve {
  min-height: 1.12rem;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  visibility: hidden;
  pointer-events: none;
}

.roster-grid--host-panel .num {
  font-size: 1.75rem;
}

.roster-grid--host-panel .st {
  font-size: 0.66rem;
  white-space: normal;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  line-height: 1.32;
  min-height: 2.64em;
  word-break: break-word;
}

.roster-grid--host-panel .st--name {
  font-size: 0.82rem;
  letter-spacing: 0.03em;
}

.roster-grid--host-panel .pcb {
  font-size: 0.52rem;
}

.roster-grid--host-panel .pcb--nom {
  font-size: 0.47rem;
}

.roster-grid--host-panel .pcb--nom-who {
  font-size: 0.45rem;
  -webkit-line-clamp: 1;
  line-clamp: 1;
}

.roster-grid--host-panel .elim-badge {
  font-size: 0.55rem;
  top: 0.24rem;
}

.roster-grid--host-panel .card-ico {
  font-size: 0.82rem;
  top: 0.22rem;
  right: 0.26rem;
}

.roster-grid--host-panel .pcard-hand-corner {
  font-size: 1.08rem;
}

.roster-grid--host-panel .pcard-ready-corner {
  font-size: 0.84rem;
}

.pcard-badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.2rem;
  margin-bottom: 0.15rem;
  min-height: 1rem;
}

.pcb {
  padding: 0.1rem 0.28rem;
  border-radius: 4px;
  font-size: 0.45rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  line-height: 1.2;
  white-space: nowrap;
}

.pcb--speak {
  color: #faf5ff;
  background: rgba(109, 40, 217, 0.75);
  border: 1px solid rgba(196, 181, 253, 0.55);
  box-shadow: 0 0 8px rgba(168, 85, 247, 0.35);
}

.pcb--target {
  color: #fecaca;
  background: rgba(127, 29, 29, 0.65);
  border: 1px solid rgba(248, 113, 113, 0.45);
}

.pcb--nom {
  color: #fde68a;
  background: rgba(120, 53, 15, 0.5);
  border: 1px solid rgba(251, 191, 36, 0.35);
  font-size: 0.42rem;
}

.pcb--nom-who {
  color: #fef3c7;
  background: rgba(55, 35, 10, 0.55);
  border: 1px solid rgba(251, 191, 36, 0.25);
  font-size: 0.4rem;
  font-weight: 800;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pcard-hand-corner {
  position: absolute;
  left: 0.2rem;
  top: 0.2rem;
  z-index: 6;
  font-size: 1rem;
  line-height: 1;
  filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.55));
  pointer-events: none;
}

/* Чекбокс масового виділення зліва зверху — руку зсуваємо, щоб не ховалась під ним. */
.pcard-shell--host-bulk .pcard-hand-corner {
  left: 1.4rem;
  top: 0.14rem;
}

.pcard-ready-corner {
  position: absolute;
  right: 0.22rem;
  top: 0.22rem;
  z-index: 3;
  font-size: 0.78rem;
  font-weight: 900;
  line-height: 1;
  color: rgba(187, 247, 208, 0.95);
  filter: drop-shadow(0 0 6px rgba(74, 222, 128, 0.45));
  pointer-events: none;
}

.pcard {
  position: relative;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  min-height: 4.85rem;
  padding: 0.45rem 0.35rem 0.5rem;
  border-radius: 12px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-muted);
  color: var(--text-body);
  cursor: pointer;
  transition:
    transform 0.15s ease,
    border-color 0.15s,
    box-shadow 0.15s;
}

.pcard:hover {
  transform: scale(1.03);
  border-color: rgba(168, 85, 247, 0.45);
  box-shadow: 0 0 20px rgba(168, 85, 247, 0.2);
}

.pcard.on {
  border-color: rgba(168, 85, 247, 0.65);
  box-shadow: 0 0 18px rgba(168, 85, 247, 0.25);
}

.pcard.pick:not(.elim) {
  border-color: rgba(52, 211, 153, 0.55);
  box-shadow: 0 0 20px rgba(45, 212, 191, 0.22);
}

.pcard--hand:not(.elim) {
  border-color: rgba(251, 191, 36, 0.35);
  box-shadow: 0 0 12px rgba(251, 191, 36, 0.12);
}

.pcard--vote-target:not(.elim):not(.speak) {
  border: 2px solid rgba(239, 68, 68, 0.7);
  box-shadow:
    0 0 25px rgba(239, 68, 68, 0.3),
    inset 0 0 10px rgba(239, 68, 68, 0.2);
}

.pcard--vote-target:not(.elim) .st {
  color: rgba(252, 165, 165, 0.95);
}

.pcard.speak:not(.elim) {
  border-color: rgba(168, 85, 247, 0.55);
  box-shadow: 0 0 22px rgba(168, 85, 247, 0.35);
  animation: neonPulse 2s ease-in-out infinite;
}

.pcard.spot:not(.elim):not(.speak) {
  border-color: rgba(251, 191, 36, 0.45);
}

.pcard.elim {
  position: relative;
  opacity: 0.55;
  border-color: rgba(127, 29, 29, 0.55);
  background: linear-gradient(160deg, rgba(40, 10, 14, 0.92), rgba(0, 0, 0, 0.55));
  box-shadow: inset 0 0 48px rgba(0, 0, 0, 0.65);
}

.pcard.elim::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  background: rgba(0, 0, 0, 0.35);
  pointer-events: none;
}

/* Не робимо relative абсолютні кутки / бейдж — інакше «ВИБУВ» потрапляє в потік і зсуває .num */
.pcard.elim > *:not(.elim-badge):not(.card-ico):not(.pcard-hand-corner):not(.pcard-ready-corner) {
  position: relative;
  z-index: 1;
}

/** Після базового .pcard.elim — вибір / редактор на вибулих без зовнішнього glow за край картки. */
.pcard.elim.pick {
  border-color: rgba(45, 212, 191, 0.45);
  box-shadow:
    inset 0 0 0 2px rgba(45, 212, 191, 0.55),
    inset 0 0 44px rgba(0, 0, 0, 0.62);
}

.pcard.elim.on {
  border-color: rgba(168, 85, 247, 0.45);
  box-shadow:
    inset 0 0 0 2px rgba(168, 85, 247, 0.38),
    inset 0 0 44px rgba(0, 0, 0, 0.62);
}

.pcard.elim.on.pick {
  border-color: rgba(45, 212, 191, 0.5);
  box-shadow:
    inset 0 0 0 2px rgba(45, 212, 191, 0.58),
    inset 0 0 36px rgba(88, 28, 135, 0.25),
    inset 0 0 44px rgba(0, 0, 0, 0.55);
}

.pcard.elim:hover {
  transform: none;
  border-color: rgba(127, 29, 29, 0.65);
  box-shadow: inset 0 0 48px rgba(0, 0, 0, 0.65);
}

.pcard.elim.pick:hover {
  transform: none;
  border-color: rgba(45, 212, 191, 0.55);
  box-shadow:
    inset 0 0 0 2px rgba(45, 212, 191, 0.62),
    inset 0 0 44px rgba(0, 0, 0, 0.62);
}

.pcard.elim.on:hover:not(.pick) {
  transform: none;
  border-color: rgba(168, 85, 247, 0.52);
  box-shadow:
    inset 0 0 0 2px rgba(168, 85, 247, 0.42),
    inset 0 0 44px rgba(0, 0, 0, 0.62);
}

.elim-badge {
  position: absolute;
  top: 0.2rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  padding: 0.12rem 0.35rem;
  border-radius: 6px;
  font-size: 0.5rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  color: #fecaca;
  background: rgba(127, 29, 29, 0.92);
  border: 1px solid rgba(248, 113, 113, 0.45);
  line-height: 1;
  white-space: nowrap;
}

@keyframes neonPulse {
  0%,
  100% {
    box-shadow: 0 0 16px rgba(168, 85, 247, 0.28);
  }
  50% {
    box-shadow: 0 0 28px rgba(168, 85, 247, 0.5);
  }
}

.num {
  font-family: 'Orbitron', sans-serif;
  font-size: 1.35rem;
  font-weight: 900;
  color: var(--text-title);
  line-height: 1;
}

.st {
  width: 100%;
  max-width: 100%;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.st--name {
  text-transform: none;
  letter-spacing: 0.02em;
  font-weight: 600;
  font-size: 0.62rem;
}

.pcard.speak .st {
  color: #e9d5ff;
}

.pcard.elim .st {
  color: #fecaca;
}

.card-ico {
  position: absolute;
  top: 0.25rem;
  right: 0.3rem;
  font-size: 0.75rem;
  line-height: 1;
  filter: drop-shadow(0 0 6px rgba(168, 85, 247, 0.5));
}

.act-panel {
  position: sticky;
  top: 0.5rem;
  padding: 0.75rem 0.8rem;
  border-radius: 14px;
  background: var(--bg-card-solid);
  border: 1px solid var(--border-strong);
  box-shadow: 0 8px 28px var(--shadow-deep);
}

.act-panel__id {
  margin: 0 0 0.6rem;
  font-family: 'Orbitron', sans-serif;
  font-size: 1.1rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  color: var(--text-heading);
  text-align: center;
}

.act-sub {
  margin: 0.65rem 0 0.2rem;
  font-size: 0.72rem;
  font-weight: 800;
  color: #fde68a;
}

.act-micro {
  margin: 0 0 0.35rem;
  font-size: 0.58rem;
  font-weight: 600;
  color: rgba(148, 163, 184, 0.85);
}

.act-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-bottom: 0.55rem;
}

.nchip {
  min-width: 2.1rem;
  padding: 0.28rem 0.4rem;
  border-radius: 8px;
  font-family: 'Orbitron', sans-serif;
  font-size: 0.72rem;
  font-weight: 800;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.4);
  color: #cbd5e1;
  transition: transform 0.1s ease;
}

.nchip:hover:not(:disabled) {
  transform: scale(1.06);
  border-color: rgba(251, 191, 36, 0.4);
}

.nchip--on {
  border-color: rgba(251, 191, 36, 0.65);
  background: rgba(120, 53, 15, 0.55);
  color: #fef3c7;
  box-shadow: 0 0 12px rgba(251, 191, 36, 0.2);
}

.nchip:disabled,
.nchip--self {
  opacity: 0.35;
  cursor: not-allowed;
}

.act-btn {
  display: block;
  width: 100%;
  margin-bottom: 0.38rem;
  padding: 0.48rem 0.55rem;
  border-radius: 10px;
  font-size: 0.74rem;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
  border: 1px solid var(--border-input);
  background: var(--bg-card-soft);
  color: var(--text-body);
  transition:
    transform 0.1s ease,
    border-color 0.15s;
}

.act-btn:hover {
  transform: scale(1.01);
  border-color: rgba(168, 85, 247, 0.45);
}

.act-btn--soft {
  font-size: 0.7rem;
  opacity: 0.95;
}

.act-btn--danger {
  border-color: rgba(248, 113, 113, 0.35);
  color: #fecaca;
}

.act-empty {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-muted);
  text-align: center;
  padding: 1.2rem 0.25rem;
}
</style>
