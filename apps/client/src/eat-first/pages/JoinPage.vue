<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { subscribeToGameRoom, subscribeToPlayers, claimPlayerSlot } from '../services/gameService'
import { getOrCreateDeviceId } from '../utils/deviceId.js'
import { setJoinSessionToken } from '../utils/joinSessionToken.js'
import { useI18n } from 'vue-i18n'
import { normalizeGameRoomPayload } from '../utils/gameRoomNormalize.js'
import { getPersistedGameId, setPersistedGameId } from '../utils/persistedGameId.js'
import { callableApiEnabled } from '../api/callableApi.js'
import { ensureAnonymousAuth } from '../services/authBootstrap.js'
import { callLinkPlayerSlot } from '../api/callableClient.js'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const gameInput = ref('test1')

watch(
  () => route.query.game,
  (g) => {
    if (g != null && String(g).trim()) {
      gameInput.value = String(g).trim()
      return
    }
    gameInput.value = getPersistedGameId() ?? 'test1'
  },
  { immediate: true },
)

onMounted(() => {
  if (typeof window === 'undefined') return
  const g = route.query.game
  if (g != null && String(g).trim()) return
  const p = getPersistedGameId()
  if (p) router.replace({ name: 'eat', query: { view: 'join', game: p } })
})

const gameId = computed(() => {
  const g = String(gameInput.value ?? '').trim()
  return g || 'test1'
})

const players = ref([])
const gameRoomJoin = ref({})
let unsub = null
let unsubRoom = null

watch(
  gameId,
  (gid) => {
    setPersistedGameId(gid)
    players.value = []
    gameRoomJoin.value = {}
    if (unsub) {
      unsub()
      unsub = null
    }
    if (unsubRoom) {
      unsubRoom()
      unsubRoom = null
    }
    unsub = subscribeToPlayers(gid, (list) => {
      players.value = Array.isArray(list) ? list : []
    })
    unsubRoom = subscribeToGameRoom(gid, (d) => {
      gameRoomJoin.value = normalizeGameRoomPayload(d && typeof d === 'object' ? d : {})
    })
  },
  { immediate: true },
)

onUnmounted(() => {
  if (joinToastTimer) clearTimeout(joinToastTimer)
  if (unsub) unsub()
  if (unsubRoom) unsubRoom()
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})

const SLOT_IDS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10']

const slotsForGrid = computed(() => {
  const map = new Map(players.value.map((p) => [String(p.id), p]))
  return SLOT_IDS.map((id) => map.get(id) || { id, name: '', eliminated: false })
})

function slotNum(id) {
  const s = String(id ?? '')
  const m = s.match(/^p(\d+)$/i)
  if (m) return m[1]
  return s.replace(/^p/i, '') || s
}

/** OBS / стрім: без токена (публічне джерело). */
function openPersonalOverlay(pid) {
  router.push({
    name: 'eat',
    query: { view: 'overlay', game: gameId.value, player: String(pid).trim() },
  })
}

/** Глобальна сітка оверлею для OBS (без ?player — глядацька сцена). */
function openGlobalOverlay() {
  router.push({ name: 'eat', query: { view: 'overlay', game: gameId.value } })
}

const joinActionBusy = ref(false)
const joinToast = ref('')
let joinToastTimer = null

const nameModalOpen = ref(false)
const pendingClaimPlayerId = ref('')
const nameModalDraft = ref('')
const nameModalInputRef = ref(null)

watch(nameModalOpen, (open) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = open ? 'hidden' : ''
})

function showJoinToast(msg) {
  joinToast.value = msg
  if (joinToastTimer) clearTimeout(joinToastTimer)
  joinToastTimer = setTimeout(() => {
    joinToastTimer = null
    joinToast.value = ''
  }, 4200)
}

function slotJoinToken(p) {
  const t = p && typeof p.joinToken === 'string' ? p.joinToken.trim() : ''
  return t.length > 0 ? t : ''
}

function slotTakenByOther(p) {
  const tok = slotJoinToken(p)
  if (!tok) return false
  const dev = typeof p.joinDeviceId === 'string' ? p.joinDeviceId.trim() : ''
  return dev.length > 0 && dev !== getOrCreateDeviceId()
}

function slotIsMine(p) {
  const tok = slotJoinToken(p)
  if (!tok) return false
  const dev = typeof p.joinDeviceId === 'string' ? p.joinDeviceId.trim() : ''
  return dev === getOrCreateDeviceId()
}

function resetNameModal() {
  nameModalOpen.value = false
  pendingClaimPlayerId.value = ''
  nameModalDraft.value = ''
}

function cancelNameModal() {
  resetNameModal()
}

async function confirmNameModal() {
  const id = pendingClaimPlayerId.value
  if (!id) {
    resetNameModal()
    return
  }
  const displayName = String(nameModalDraft.value ?? '').trim().slice(0, 64)
  resetNameModal()
  await runClaimSlot(id, displayName)
}

/** Панель гравця: зайняття слота + токен у URL. */
async function runClaimSlot(id, displayName) {
  if (!id || joinActionBusy.value) return
  joinActionBusy.value = true
  try {
    const res = await claimPlayerSlot(gameId.value, id, {
      deviceId: getOrCreateDeviceId(),
      name: displayName,
    })
    if (!res.ok) {
      if (res.reason === 'taken') showJoinToast(t('join.slotTakenToast'))
      else if (res.reason === 'no-slot') showJoinToast(t('join.noPlayerDoc'))
      else if (res.reason === 'no-device') showJoinToast(t('join.noDevice'))
      return
    }
    setJoinSessionToken(gameId.value, id, res.token)
    if (callableApiEnabled()) {
      try {
        await ensureAnonymousAuth()
        await callLinkPlayerSlot(gameId.value, id, res.token)
      } catch (e) {
        showJoinToast(e instanceof Error ? e.message : String(e))
        return
      }
    }
    router.push({
      name: 'eat',
      query: { view: 'control', game: gameId.value, player: id, token: res.token },
    })
  } catch (e) {
    showJoinToast(e instanceof Error ? e.message : String(e))
  } finally {
    joinActionBusy.value = false
  }
}

async function openPlayerControl(pid) {
  const id = String(pid ?? '').trim()
  if (!id || joinActionBusy.value) return
  const row = slotsForGrid.value.find((x) => x.id === id) || { id }
  if (slotTakenByOther(row)) {
    showJoinToast(t('join.slotTakenToast'))
    return
  }
  const firstClaim = !slotJoinToken(row)
  if (firstClaim) {
    pendingClaimPlayerId.value = id
    nameModalDraft.value = typeof row.name === 'string' ? row.name : ''
    nameModalOpen.value = true
    await nextTick()
    nameModalInputRef.value?.focus()
    return
  }
  await runClaimSlot(id, '')
}

function scrollToPlayerSlots() {
  requestAnimationFrame(() => {
    document.getElementById('player-slots')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function goAdmin() {
  router.push({ name: 'eat', query: { view: 'admin', game: gameId.value } })
}

function applyGameFromInput() {
  router.replace({ name: 'eat', query: { view: 'join', game: gameId.value } })
}

const globalOverlayUrl = computed(() => {
  const h = router.resolve({ name: 'eat', query: { view: 'overlay', game: gameId.value } }).href
  if (typeof window === 'undefined') return h
  return new URL(h, window.location.origin).href
})

const TRAIT_KEYS = ['profession', 'health', 'phobia', 'luggage', 'fact', 'quirk']

function slotOverlayOpen(p) {
  if (!p || p.eliminated === true) return false
  if (p.demographicsRevealed === true) return true
  if (p.demographicsRevealed === undefined && p.identityRevealed === true) return true
  return TRAIT_KEYS.some((k) => {
    const c = p[k]
    return c && typeof c === 'object' && c.revealed === true
  })
}

function handUpJoin(pid) {
  const h = gameRoomJoin.value?.hands
  if (!h || typeof h !== 'object') return false
  return h[String(pid)] === true
}
</script>

<template>
  <div class="join">
    <header class="join-hero anim-fade-in">
      <p class="eyebrow">{{ $t('join.eyebrow') }}</p>
      <h1 class="title">{{ $t('game.title') }}</h1>
      <p class="lead">
        {{ $t('join.lead') }}
      </p>
    </header>

    <ol class="join-steps anim-fade-in" style="animation-delay: 40ms">
      <li><span class="join-steps__n">1</span> {{ $t('join.step1') }}</li>
      <li><span class="join-steps__n">2</span> {{ $t('join.step2') }}</li>
      <li><span class="join-steps__n">3</span> {{ $t('join.step3') }}</li>
    </ol>

    <div class="game-bar anim-fade-in" style="animation-delay: 80ms" data-onb="join-game-bar">
      <label class="lbl" for="gid">{{ $t('join.gameId') }}</label>
      <div class="game-row">
        <input id="gid" v-model="gameInput" type="text" class="inp" autocomplete="off" />
        <button type="button" class="btn-go" @click="applyGameFromInput">OK</button>
      </div>
    </div>

    <section class="roles roles--clean" aria-labelledby="roles-title" data-onb="join-roles">
      <h2 id="roles-title" class="roles-title">{{ $t('join.whoTitle') }}</h2>
      <p class="roles-hint">{{ $t('join.whoHint') }}</p>
      <div class="cta-grid anim-stagger">
        <button type="button" class="cta cta--play" style="--stagger-index: 0" @click="scrollToPlayerSlots">
          <span class="cta-ico" aria-hidden="true">🎤</span>
          <span class="cta-t">{{ $t('join.ctaPlayer') }}</span>
          <span class="cta-d">{{ $t('join.ctaPlayerSub') }}</span>
        </button>
        <button type="button" class="cta cta--host" style="--stagger-index: 1" @click="goAdmin">
          <span class="cta-ico" aria-hidden="true">🎮</span>
          <span class="cta-t">{{ $t('join.ctaHost') }}</span>
          <span class="cta-d">{{ $t('join.ctaHostSub') }}</span>
        </button>
        <button
          type="button"
          class="cta cta--obs"
          style="--stagger-index: 2"
          @click="openGlobalOverlay"
        >
          <span class="cta-ico" aria-hidden="true">🎥</span>
          <span class="cta-t">{{ $t('join.ctaObs') }}</span>
          <span class="cta-d">{{ $t('join.ctaObsSub') }}</span>
        </button>
      </div>
    </section>

    <section
      class="obs-hint anim-fade-in"
      style="animation-delay: 0.12s"
      aria-labelledby="obs-hint-title"
      data-onb="join-obs"
    >
      <h2 id="obs-hint-title" class="obs-hint__title">{{ $t('join.obsTitle') }}</h2>
      <ol class="obs-hint__list">
        <li>{{ $t('join.obs1') }}</li>
        <li>{{ $t('join.obs2') }}</li>
        <li>{{ $t('join.obs3') }}</li>
        <li>{{ $t('join.obs4') }}</li>
      </ol>
      <p class="obs-hint__url">
        <span class="obs-hint__url-label">{{ $t('join.obsUrlLabel') }}</span>
        <code class="obs-hint__code">{{ globalOverlayUrl }}</code>
      </p>
    </section>

    <section
      id="player-slots"
      class="cards-wrap anim-fade-in"
      style="animation-delay: 0.16s"
      aria-labelledby="slots-title"
      data-onb="join-slots"
    >
      <h2 id="slots-title" class="sec-title">{{ $t('join.slotsTitle') }}</h2>
      <p class="sec-sub sec-sub--emph">
        {{ $t('join.slotsSub') }}
      </p>
      <div class="cards">
        <div
          v-for="p in slotsForGrid"
          :key="p.id"
          class="pcard anim-scale-in"
          :class="{
            elim: p.eliminated === true,
            'pcard--empty': !(p.name && String(p.name).trim()),
            'pcard--taken': slotTakenByOther(p),
            'pcard--mine': slotIsMine(p),
          }"
        >
          <span class="num">{{ $t('join.slot', { n: slotNum(p.id) }) }}</span>
          <span class="nm">{{ (p.name && String(p.name).trim()) || $t('join.noName') }}</span>
          <span v-if="p.eliminated" class="badge">{{ $t('join.eliminated') }}</span>
          <span v-else-if="slotTakenByOther(p)" class="badge badge--taken">{{ $t('join.slotTaken') }}</span>
          <span v-else-if="slotIsMine(p)" class="badge badge--mine">{{ $t('join.youAreHere') }}</span>
          <div class="pcard-status-row">
            <span
              class="pcard-ov"
              :class="{ 'pcard-ov--open': slotOverlayOpen(p) }"
              :title="slotOverlayOpen(p) ? $t('join.overlayOpenTitle') : $t('join.overlayClosedTitle')"
            >
              {{ slotOverlayOpen(p) ? $t('join.overlayOpen') : $t('join.overlayClosed') }}
            </span>
            <span v-if="handUpJoin(p.id)" class="pcard-hand" :title="$t('join.handUp')">✋</span>
          </div>
          <div class="pcard-actions">
            <button
              type="button"
              class="pcard-btn pcard-btn--primary"
              :disabled="joinActionBusy || p.eliminated === true || slotTakenByOther(p)"
              @click="openPlayerControl(p.id)"
            >
              {{
                p.eliminated === true
                  ? $t('join.eliminated')
                  : slotTakenByOther(p)
                    ? $t('join.slotTaken')
                    : slotIsMine(p)
                      ? $t('join.openPanel')
                      : $t('join.claimSlot')
              }}
            </button>
            <button
              type="button"
              class="pcard-btn"
              :disabled="p.eliminated === true"
              @click="openPersonalOverlay(p.id)"
            >
              {{ $t('join.obsOverlayBtn') }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="joinToast" class="join-toast" role="status">{{ joinToast }}</div>
    </Teleport>

    <Teleport to="body">
      <div v-if="nameModalOpen" class="join-name-modal" role="presentation">
        <button type="button" class="join-name-modal__backdrop" :aria-label="t('join.nameModalCancel')" @click="cancelNameModal" />
        <div
          class="join-name-modal__panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="'join-name-modal-title'"
          :aria-describedby="'join-name-modal-desc'"
          tabindex="-1"
          @click.stop
        >
          <p id="join-name-modal-title" class="join-name-modal__eyebrow">{{ t('join.nameModalTitle') }}</p>
          <p id="join-name-modal-desc" class="join-name-modal__hint">{{ t('join.promptNameOptional') }}</p>
          <input
            id="join-name-input"
            ref="nameModalInputRef"
            v-model="nameModalDraft"
            type="text"
            class="join-name-modal__input"
            maxlength="64"
            autocomplete="nickname"
            :aria-label="t('join.nameModalPlaceholder')"
            :placeholder="t('join.nameModalPlaceholder')"
            @keydown.enter.prevent="confirmNameModal"
            @keydown.escape.prevent="cancelNameModal"
          />
          <div class="join-name-modal__actions">
            <button type="button" class="join-name-modal__btn join-name-modal__btn--ghost" @click="cancelNameModal">
              {{ t('join.nameModalCancel') }}
            </button>
            <button type="button" class="join-name-modal__btn join-name-modal__btn--primary" @click="confirmNameModal">
              {{ t('join.nameModalContinue') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.join {
  position: relative;
  min-height: 100vh;
  box-sizing: border-box;
  padding: clamp(1.5rem, 4vw, 2.5rem) clamp(1rem, 3vw, 1.75rem) 3.5rem;
  max-width: min(75rem, 100%);
  margin: 0 auto;
  font-family: var(--font-body);
  color: var(--text-body);
  overflow-x: hidden;
  /* Короткий fade блоків після маршруту — близько до `route-soft` у шеллі. */
  --motion-duration: 0.14s;
}

.join-hero,
.join-steps,
.game-bar,
.roles,
.cards-wrap,
.obs-hint {
  position: relative;
  z-index: 1;
}

.join-hero {
  margin-bottom: clamp(1.5rem, 4vw, 2.5rem);
  text-align: center;
}

.game-bar,
.roles,
.cards-wrap,
.obs-hint {
  margin-top: clamp(1.35rem, 3.8vw, 2.15rem);
}

.join-steps {
  list-style: none;
  margin: 0 auto;
  padding: 0.85rem 1rem;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  max-width: 26rem;
  box-sizing: border-box;
}

.join-steps li {
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
  margin: 0;
  padding: 0.35rem 0;
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--text-body);
  border-bottom: 1px solid var(--join-step-border);
}

.join-steps li:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.join-steps__n {
  flex-shrink: 0;
  width: 1.35rem;
  height: 1.35rem;
  display: inline-grid;
  place-items: center;
  border-radius: 8px;
  font-size: 0.68rem;
  font-weight: 800;
  font-family: var(--font-display);
  color: var(--text-heading);
  background: var(--accent-fill);
  border: 1px solid var(--border-strong);
}

.roles {
  margin-bottom: 0;
}

.roles--clean {
  border: none;
  box-shadow: none;
  background: transparent;
  padding: 0;
}

.roles-title {
  margin: 0 0 0.35rem;
  text-align: center;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  font-family: var(--font-display);
  color: var(--text-muted);
}

.roles-hint {
  margin: 0 0 1rem;
  text-align: center;
  font-size: 0.78rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.eyebrow {
  margin: 0;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.title {
  margin: 0.5rem 0 0.4rem;
  font-family: var(--font-display);
  font-size: clamp(1.4rem, 4.5vw, 1.85rem);
  font-weight: 800;
  color: var(--text-title);
  line-height: 1.15;
}

.lead {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.5;
  color: var(--text-secondary);
  max-width: 34rem;
  margin-inline: auto;
}

.game-bar {
  margin-bottom: 0;
  padding: 1.1rem 1.25rem;
  border-radius: 16px;
  background: var(--bg-card-solid);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-card, 0 0 24px var(--accent-glow));
}

.lbl {
  display: block;
  margin-bottom: 0.4rem;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.game-row {
  display: flex;
  gap: 0.5rem;
}

.inp {
  flex: 1;
  padding: 0.6rem 0.75rem;
  border-radius: 12px;
  border: 1px solid var(--border-input);
  background: var(--bg-input);
  color: var(--text-body);
  font-size: 0.9rem;
}

.btn-go {
  padding: 0.6rem 1.1rem;
  border-radius: 12px;
  border: 1px solid var(--accent);
  background: var(--accent-fill);
  color: var(--text-main);
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.btn-go:hover {
  transform: scale(1.04);
}

/* «Хто ти зараз?»: на широкому екрані — 3 картки в один ряд */
.cta-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.85rem;
}

@media (min-width: 560px) {
  .cta-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 900px) {
  .cta-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.obs-hint {
  margin-bottom: 0;
  padding: 1.2rem 1.3rem 1.35rem;
  border-radius: 16px;
  border: 1px solid var(--border-cyan);
  background: var(--bg-obs-hint);
  box-shadow: 0 0 20px var(--glow-vote);
}

.obs-hint__title {
  margin: 0 0 0.65rem;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-cyan);
  font-family: Orbitron, sans-serif;
}

.obs-hint__list {
  margin: 0;
  padding-left: 1.15rem;
  font-size: 0.84rem;
  line-height: 1.55;
  color: var(--text-cyan-body);
}

.obs-hint__list li {
  margin-bottom: 0.35rem;
}

.obs-hint__list strong {
  color: var(--text-cyan-strong);
  font-weight: 600;
}

.obs-hint__url {
  margin: 1rem 0 0;
}

.obs-hint__url-label {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.obs-hint__code {
  display: block;
  padding: 0.55rem 0.65rem;
  border-radius: 10px;
  font-size: 0.72rem;
  line-height: 1.4;
  word-break: break-all;
  background: var(--bg-code);
  border: 1px solid var(--border-subtle);
  color: var(--text-code);
}

.cta {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  column-gap: 0.85rem;
  row-gap: 0.15rem;
  padding: 1rem 1.15rem;
  text-align: left;
  border-radius: 16px;
  border: 1px solid var(--cta-border);
  background: var(--cta-bg);
  color: inherit;
  cursor: pointer;
  transition:
    transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.28s ease,
    box-shadow 0.28s ease;
}

.cta:hover:not(:disabled) {
  transform: translateY(-5px);
  border-color: var(--border-strong);
  box-shadow:
    0 10px 28px var(--shadow-deep),
    0 0 36px var(--glow-purple-lg);
}

.cta--obs:hover:not(:disabled) {
  box-shadow:
    0 10px 28px var(--shadow-deep),
    0 0 40px var(--glow-cyan-lg);
  border-color: var(--border-cyan-strong);
}

.cta--soon,
.cta--soon:disabled {
  cursor: not-allowed;
  opacity: 0.72;
  transform: none;
  box-shadow: none;
}

.cta--soon:disabled:hover {
  transform: none;
  border-color: var(--cta-border);
  box-shadow: none;
}

.cta-coming-badge {
  display: inline-block;
  margin-inline-start: 0.45rem;
  padding: 0.12rem 0.4rem;
  border-radius: 999px;
  font-size: 0.52rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  vertical-align: middle;
  border: 1px solid var(--border-cyan-strong);
  color: var(--text-cyan-strong);
  background: rgba(34, 211, 238, 0.08);
}

.cta--play:hover {
  box-shadow:
    0 10px 28px var(--shadow-deep),
    0 0 40px var(--glow-green-lg);
  border-color: rgba(74, 222, 128, 0.42);
}

.cta--host:hover {
  box-shadow:
    0 10px 28px var(--shadow-deep),
    0 0 40px var(--glow-amber-lg);
  border-color: rgba(251, 191, 36, 0.45);
}

.cta-ico {
  grid-row: span 2;
  font-size: 1.65rem;
  line-height: 1;
  align-self: center;
}

.cta-t {
  font-size: 0.95rem;
  font-weight: 700;
  font-family: Orbitron, sans-serif;
  color: var(--text-title);
}

.cta-d {
  font-size: 0.78rem;
  color: var(--text-secondary);
  line-height: 1.35;
}

.cards-wrap {
  padding: 1.15rem 1.2rem 1.3rem;
  border-radius: 18px;
  border: 1px solid var(--border-strong);
  background: var(--bg-card-solid);
  box-shadow: var(--shadow-card, none);
}

.sec-title {
  margin: 0 0 0.65rem;
  font-size: 0.9rem;
  font-weight: 700;
  font-family: Orbitron, sans-serif;
  color: var(--text-heading);
}

.sec-sub {
  margin: 0 0 1.15rem;
  font-size: 0.78rem;
  color: var(--text-muted);
  line-height: 1.45;
}

.sec-sub--emph {
  color: var(--text-secondary);
  max-width: 40rem;
}

.sec-sub--emph strong {
  color: var(--text-heading);
}

.empty {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

/* «Обери свій слот»: на великому екрані — 5×2 (два рядки), далі адаптивно */
.cards {
  display: grid;
  gap: 0.85rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (min-width: 520px) {
  .cards {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 720px) {
  .cards {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 900px) {
  .cards {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

.pcard {
  text-align: left;
  padding: 0.95rem 1rem 0.85rem;
  border-radius: 14px;
  border: 1px solid var(--border-panel);
  background: var(--pcard-bg);
  color: inherit;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  box-shadow: var(--shadow-card, none);
}

.pcard--empty .nm {
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.78rem;
}

.pcard-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem;
  flex-wrap: wrap;
  min-height: 1.35rem;
}

.pcard-ov {
  font-size: 0.55rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.22rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
  background: rgba(0, 0, 0, 0.22);
}

.pcard-ov--open {
  border-color: var(--reveal-on-border);
  color: var(--reveal-on-text);
  background: var(--reveal-on-bg);
}

.pcard-hand {
  font-size: 0.9rem;
  line-height: 1;
  filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.35));
}

.pcard-actions {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.25rem;
  padding-top: 0.55rem;
  border-top: 1px solid var(--border-subtle);
}

.pcard-btn {
  width: 100%;
  padding: 0.45rem 0.55rem;
  border-radius: 10px;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid var(--border-input);
  background: var(--bg-muted);
  color: var(--text-body);
  transition:
    transform 0.12s ease,
    border-color 0.15s ease;
}

.pcard-btn:hover {
  transform: scale(1.02);
  border-color: var(--border-strong);
}

.pcard-btn--primary {
  border-color: var(--border-strong);
  background: var(--accent-fill);
  color: var(--text-title);
  font-weight: 800;
}

.pcard.elim {
  opacity: 0.55;
  border-color: rgba(185, 28, 28, 0.35);
}

.pcard.elim .pcard-btn {
  opacity: 0.5;
  pointer-events: none;
}

.num {
  font-family: Orbitron, sans-serif;
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  color: var(--text-muted);
}

.nm {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--text-title);
}

.badge {
  font-size: 0.58rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--error-text);
  align-self: flex-start;
}

.badge--taken {
  color: var(--error-text);
}

.badge--mine {
  color: var(--reveal-on-text, #4ade80);
}

.pcard--taken {
  border-color: rgba(120, 120, 120, 0.4);
}

.pcard--mine {
  border-color: var(--reveal-on-border, rgba(74, 222, 128, 0.45));
  box-shadow: 0 0 0 1px rgba(74, 222, 128, 0.12);
}

.pcard-btn:disabled,
.pcard-btn--primary:disabled {
  opacity: 0.48;
  cursor: not-allowed;
  transform: none;
  pointer-events: none;
}

.join-name-modal {
  position: fixed;
  inset: 0;
  z-index: 12000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  animation: join-name-modal-in 0.22s ease both;
}

@keyframes join-name-modal-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.join-name-modal__backdrop {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 0;
  border: none;
  cursor: pointer;
  background: radial-gradient(ellipse 120% 80% at 50% 40%, rgba(88, 28, 135, 0.45), rgba(15, 10, 28, 0.88));
}

.join-name-modal__panel {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 22rem;
  padding: 1.35rem 1.35rem 1.15rem;
  border-radius: 16px;
  border: 1px solid var(--border-strong, rgba(196, 181, 253, 0.28));
  background: linear-gradient(165deg, var(--bg-card, #1f1830) 0%, rgba(30, 22, 48, 0.98) 100%);
  box-shadow:
    0 0 0 1px rgba(168, 85, 247, 0.12),
    0 24px 56px rgba(0, 0, 0, 0.55);
  outline: none;
}

.join-name-modal__eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  font-family: var(--font-display);
  color: var(--text-muted);
}

.join-name-modal__hint {
  margin: 0 0 1rem;
  font-size: 0.82rem;
  line-height: 1.5;
  color: var(--text-body);
}

.join-name-modal__input {
  width: 100%;
  box-sizing: border-box;
  margin: 0 0 1.1rem;
  padding: 0.65rem 0.85rem;
  border-radius: 12px;
  border: 1px solid var(--border-input);
  background: var(--bg-input);
  color: var(--text-body);
  font-size: 0.92rem;
  font-weight: 600;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.join-name-modal__input::placeholder {
  color: var(--text-muted);
  font-weight: 500;
}

.join-name-modal__input:focus {
  outline: none;
  border-color: var(--accent, #a78bfa);
  box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.22);
}

.join-name-modal__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}

.join-name-modal__btn {
  margin: 0;
  padding: 0.5rem 1rem;
  border-radius: 11px;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  cursor: pointer;
  border: 1px solid transparent;
  transition:
    transform 0.12s ease,
    filter 0.15s ease,
    border-color 0.15s ease;
}

.join-name-modal__btn--ghost {
  border-color: var(--border-subtle);
  background: transparent;
  color: var(--text-muted);
}

.join-name-modal__btn--ghost:hover {
  border-color: var(--border-strong);
  color: var(--text-title);
}

.join-name-modal__btn--primary {
  border-color: var(--border-strong);
  background: var(--accent-fill);
  color: var(--text-title);
}

.join-name-modal__btn--primary:hover {
  transform: scale(1.02);
  filter: brightness(1.06);
}

.join-name-modal__btn:focus-visible {
  outline: 2px solid var(--accent, #a78bfa);
  outline-offset: 2px;
}

.join-toast {
  position: fixed;
  bottom: 1.25rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  max-width: min(22rem, calc(100vw - 2rem));
  padding: 0.75rem 1rem;
  border-radius: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-card, 0 8px 28px rgba(0, 0, 0, 0.35));
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-body);
  pointer-events: none;
}
</style>
