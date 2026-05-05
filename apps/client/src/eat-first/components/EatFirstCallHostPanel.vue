<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { createLogger } from '@/utils/logger'
import { efPatchRoom } from '@/eat-first/services/eatFirstTransport'
import { useEatFirstCallShellStore } from '@/stores/eatFirstCallShell'

const log = createLogger('eat-first:call-host-panel')

const props = defineProps<{
  gameId: string
  hostDisplaySeat: number
  playerCount: number
  gamePhase: string
}>()

const { t } = useI18n()
const router = useRouter()
const eatFirstShell = useEatFirstCallShellStore()
const { lastUsedActionCard } = storeToRefs(eatFirstShell)

type EfPhaseKey = 'intro' | 'discussion' | 'voting' | 'final'
const PHASE_KEYS: EfPhaseKey[] = ['intro', 'discussion', 'voting', 'final']

type EfTraitKey = 'gender' | 'age' | 'profession' | 'health' | 'hobby' | 'phobia' | 'fact' | 'baggage'
const TRAIT_KEYS: EfTraitKey[] = [
  'gender',
  'age',
  'profession',
  'health',
  'hobby',
  'phobia',
  'fact',
  'baggage',
]

const EAT_FIRST_HOST_ACTION_EVENT = 'streamassist:eat-first:host-action'

function dispatchHostAction(detail: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  const ev = new CustomEvent(EAT_FIRST_HOST_ACTION_EVENT, { detail })
  window.dispatchEvent(ev)
}

function rerollTraitForAll(traitKey: EfTraitKey): void {
  dispatchHostAction({ action: 'trait-type-reroll-all', traitKey })
}

function rerollAllActionCards(): void {
  dispatchHostAction({ action: 'action-card-reroll', slotId: '*' })
}

const lastUsedCardLine = computed(() => {
  const card = lastUsedActionCard.value
  if (!card || typeof card !== 'object') return ''
  const title = typeof card.title === 'string' ? card.title.trim() : ''
  const slot = typeof card.slotId === 'string' ? card.slotId.trim() : ''
  if (title.length < 1) return ''
  if (slot.length < 1) return title
  return `${slot.toUpperCase()} · ${title}`
})

function traitButtonLabel(key: EfTraitKey): string {
  const map: Record<EfTraitKey, string> = {
    gender: 'Стать',
    age: 'Вік',
    profession: 'Професія',
    health: 'Здоров’я',
    hobby: 'Хобі',
    phobia: 'Фобія',
    fact: 'Факт',
    baggage: 'Багаж',
  }
  return map[key] ?? key
}

const MIN_W = 320
const MARGIN = 8
const DEFAULT_LEFT_INSET = 70
const DEFAULT_BOTTOM_INSET = 25
const PANEL_H = 320
const PANEL_Z = 38

const collapsed = ref(false)
const pos = ref({ x: DEFAULT_LEFT_INSET, y: 400 })
const savedPos = ref<{ x: number; y: number } | null>(null)
const tabAnchorY = ref(200)
const collapsedSide = ref<'left' | 'right'>('left')

const dragging = ref(false)
const dragOrigin = ref({ cx: 0, cy: 0, x: 0, y: 0 })
let dragListenersAttached = false

const panelStyle = computed(() => {
  if (collapsed.value) return {}
  return {
    left: `${pos.value.x}px`,
    top: `${pos.value.y}px`,
    width: `${MIN_W}px`,
    height: `${PANEL_H}px`,
    zIndex: PANEL_Z,
  } as Record<string, string | number>
})

const tabStyle = computed(() => ({
  top: `${tabAnchorY.value}px`,
  [collapsedSide.value]: '0',
  zIndex: PANEL_Z,
}))

const panelCollapseSide = computed<'left' | 'right'>(() => {
  if (typeof window === 'undefined') return 'left'
  return pos.value.x + MIN_W * 0.5 < window.innerWidth * 0.5 ? 'left' : 'right'
})

const collapseArrowPath = computed(() =>
  panelCollapseSide.value === 'left'
    ? 'M14.5 7L9.5 12l5 5M10 12h8'
    : 'M9.5 7l5 5-5 5M6 12h8',
)

function clampPos(): void {
  const vw = window.innerWidth
  const vh = window.innerHeight
  pos.value.x = Math.min(Math.max(MARGIN, pos.value.x), vw - MIN_W - MARGIN)
  pos.value.y = Math.min(Math.max(MARGIN, pos.value.y), vh - PANEL_H - MARGIN)
}

function placeDefault(): void {
  const vw = window.innerWidth
  const vh = window.innerHeight
  pos.value = {
    x: Math.max(MARGIN, Math.min(DEFAULT_LEFT_INSET, vw - MIN_W - MARGIN)),
    y: Math.max(MARGIN, vh - PANEL_H - DEFAULT_BOTTOM_INSET),
  }
}

function onWindowResize(): void {
  clampPos()
  tabAnchorY.value = Math.max(MARGIN, Math.min(pos.value.y + PANEL_H * 0.5, window.innerHeight - MARGIN))
}

function endDrag(): void {
  if (!dragListenersAttached) return
  dragListenersAttached = false
  document.removeEventListener('pointermove', onPointerMoveDrag, true)
  document.removeEventListener('pointerup', onPointerUpDrag, true)
  document.removeEventListener('pointercancel', onPointerUpDrag, true)
  dragging.value = false
}

function onPointerMoveDrag(ev: PointerEvent): void {
  if (!dragging.value) return
  ev.preventDefault()
  pos.value = {
    x: dragOrigin.value.x + (ev.clientX - dragOrigin.value.cx),
    y: dragOrigin.value.y + (ev.clientY - dragOrigin.value.cy),
  }
  clampPos()
}

function onPointerUpDrag(): void {
  endDrag()
}

function onHeadPointerDown(ev: PointerEvent): void {
  if (ev.button !== 0) return
  if (ev.target instanceof Element && ev.target.closest('button, a, input, [data-no-drag]')) return
  ev.preventDefault()
  dragging.value = true
  dragOrigin.value = { cx: ev.clientX, cy: ev.clientY, x: pos.value.x, y: pos.value.y }
  if (!dragListenersAttached) {
    dragListenersAttached = true
    document.addEventListener('pointermove', onPointerMoveDrag, { capture: true, passive: false })
    document.addEventListener('pointerup', onPointerUpDrag, { capture: true })
    document.addEventListener('pointercancel', onPointerUpDrag, { capture: true })
  }
}

function collapsePanel(): void {
  collapsedSide.value = panelCollapseSide.value
  savedPos.value = { ...pos.value }
  tabAnchorY.value = Math.max(MARGIN + 20, Math.min(pos.value.y + PANEL_H * 0.45, window.innerHeight - MARGIN - 20))
  endDrag()
  collapsed.value = true
}

function expandPanel(): void {
  collapsed.value = false
  if (savedPos.value != null) {
    pos.value = { ...savedPos.value }
  } else {
    placeDefault()
  }
  void nextTick(() => clampPos())
}

onMounted(() => {
  placeDefault()
  window.addEventListener('resize', onWindowResize, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
  endDrag()
  if (copyHintTimer != null) clearTimeout(copyHintTimer)
})

// ── Phase tabs ────────────────────────────────────────────────
function isActivePhase(key: EfPhaseKey): boolean {
  return props.gamePhase.toLowerCase() === key
}

function labelForPhase(key: EfPhaseKey): string {
  return t(`gamePhase.${key}`)
}

const phasePending = ref<EfPhaseKey | null>(null)

async function setPhase(key: EfPhaseKey): Promise<void> {
  if (!props.gameId.trim()) return
  if (isActivePhase(key)) return
  if (phasePending.value != null) return
  phasePending.value = key
  try {
    await efPatchRoom(props.gameId.trim(), { gamePhase: key })
  } catch (e) {
    log.warn('set gamePhase failed', e)
  } finally {
    phasePending.value = null
  }
}

// ── OBS copy ─────────────────────────────────────────────────
const copyHint = ref<'idle' | 'ok' | 'err'>('idle')
let copyHintTimer: ReturnType<typeof setTimeout> | null = null

const overlayAbsoluteUrl = computed(() => {
  if (typeof window === 'undefined' || !props.gameId.trim()) return ''
  const href = router.resolve({
    name: 'eat',
    query: { view: 'overlay', game: props.gameId.trim() },
  }).href
  return `${window.location.origin}${href.startsWith('/') ? href : `/${href}`}`
})

function setCopyHint(next: 'idle' | 'ok' | 'err'): void {
  copyHint.value = next
  if (copyHintTimer != null) { clearTimeout(copyHintTimer); copyHintTimer = null }
  if (next === 'idle') return
  copyHintTimer = setTimeout(() => { copyHint.value = 'idle'; copyHintTimer = null }, 2200)
}

async function copyOverlayPageUrl(): Promise<void> {
  const text = overlayAbsoluteUrl.value
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    setCopyHint('ok')
  } catch (e) {
    log.warn('clipboard copy failed', e)
    setCopyHint('err')
  }
}
</script>

<template>
  <Teleport to="body">
    <!-- Collapsed edge tab -->
    <button
      v-if="collapsed"
      type="button"
      class="ef-host-panel__edge-tab sa-chip-btn sa-chip-btn--on ef-host-panel__edge-tab--pulse"
      :class="{
        'ef-host-panel__edge-tab--left': collapsedSide === 'left',
        'ef-host-panel__edge-tab--right': collapsedSide === 'right',
      }"
      :style="tabStyle"
      :aria-label="t('eatFirstCall.hostPanelOpen')"
      :title="t('eatFirstCall.hostPanelOpen')"
      @click="expandPanel"
    >
      <span class="ef-host-panel__edge-ico" aria-hidden="true">🍽️</span>
    </button>

    <!-- Expanded panel -->
    <aside
      v-else
      class="ef-host-panel ef-host-panel__shell"
      :style="panelStyle"
      :aria-label="t('eatFirstCall.mafiaStyleHostPanelAria')"
    >
      <header class="ef-host-panel__head" @pointerdown="onHeadPointerDown">
        <h2 class="ef-host-panel__title">{{ t('eatFirstCall.leadTitle') }}</h2>
        <div class="ef-host-panel__head-actions" data-no-drag>
          <button
            type="button"
            class="sa-chip-btn ef-host-panel__head-btn ef-host-panel__head-btn--obs"
            :disabled="!gameId.trim()"
            :title="copyHint === 'ok' ? t('eatFirstCall.obsCopied') : t('eatFirstCall.btnObsHelp')"
            :aria-label="t('eatFirstCall.btnObsHelp')"
            @click="copyOverlayPageUrl"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true" focusable="false">
              <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
          <button
            type="button"
            class="sa-chip-btn ef-host-panel__head-btn ef-host-panel__head-btn--collapse"
            :aria-label="t('eatFirstCall.hostPanelCollapse')"
            :title="t('eatFirstCall.hostPanelCollapse')"
            @click="collapsePanel"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              aria-hidden="true"
              focusable="false"
            >
              <path
                :d="collapseArrowPath"
                stroke="currentColor"
                stroke-width="2.25"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
      </header>

      <div class="ef-host-panel__scroller">
        <section
          class="ef-host-panel__section"
          :aria-label="'Остання використана карта'"
        >
          <h3 class="ef-host-panel__section-title">Остання карта</h3>
          <div class="ef-host-panel__last-card">
            <span v-if="lastUsedCardLine.length > 0" class="ef-host-panel__last-card-line">
              {{ lastUsedCardLine }}
            </span>
            <span v-else class="ef-host-panel__last-card-empty">— ще ніхто не зіграв карту —</span>
          </div>
        </section>

        <section class="ef-host-panel__section" aria-label="Перекинути риси для всіх гравців">
          <h3 class="ef-host-panel__section-title">Перекинути для всіх</h3>
          <div class="ef-host-panel__trait-grid">
            <button
              v-for="key in TRAIT_KEYS"
              :key="`reroll-${key}`"
              type="button"
              class="ef-host-panel__trait-btn"
              :title="`Перекинути ${traitButtonLabel(key)} для всіх гравців`"
              :aria-label="`Перекинути ${traitButtonLabel(key)} для всіх гравців`"
              @click="rerollTraitForAll(key)"
            >
              {{ traitButtonLabel(key) }}
            </button>
          </div>
        </section>

        <section class="ef-host-panel__section" aria-label="Активні карти">
          <h3 class="ef-host-panel__section-title">Активні карти</h3>
          <button
            type="button"
            class="ef-host-panel__action-card-btn"
            title="Перекинути активні карти для всіх гравців"
            @click="rerollAllActionCards"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
              <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.8" />
              <circle cx="9" cy="9" r="1.3" fill="currentColor" />
              <circle cx="15" cy="9" r="1.3" fill="currentColor" />
              <circle cx="12" cy="12" r="1.3" fill="currentColor" />
              <circle cx="9" cy="15" r="1.3" fill="currentColor" />
              <circle cx="15" cy="15" r="1.3" fill="currentColor" />
            </svg>
            <span>Перекинути карти всім</span>
          </button>
        </section>

        <section class="ef-host-panel__section" aria-label="Фази гри">
          <h3 class="ef-host-panel__section-title">Фаза</h3>
          <div
            class="ef-host-panel__phase-row"
            role="group"
            :aria-label="t('eatFirstCall.hostPhasesAria')"
          >
            <button
              v-for="key in PHASE_KEYS"
              :key="key"
              type="button"
              class="ef-host-panel__phase-col h-focus-ring"
              :class="{ 'ef-host-panel__phase-col--on': isActivePhase(key) }"
              :disabled="phasePending != null"
              :aria-pressed="isActivePhase(key)"
              :aria-label="labelForPhase(key)"
              :title="labelForPhase(key)"
              @click="setPhase(key)"
            >
              <span class="ef-host-panel__phase-label">{{ labelForPhase(key) }}</span>
              <span class="ef-host-panel__phase-bar" aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>
    </aside>
  </Teleport>
</template>

<style scoped>
.ef-host-panel__shell {
  position: fixed;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-radius: 12.61px;
  background:
    linear-gradient(135deg, rgb(255 255 255 / 0.12), rgb(255 255 255 / 0.025) 42%, transparent 72%),
    rgb(60 36 99 / 0.41);
  border: 1px solid rgb(255 255 255 / 0.11);
  color: var(--sa-color-text-body);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.18),
    inset 0 -1px 0 rgb(255 255 255 / 0.05),
    0 12px 30px rgb(8 2 20 / 0.28);
  backdrop-filter: blur(10px) saturate(1.18);
  -webkit-backdrop-filter: blur(10px) saturate(1.18);
  pointer-events: auto;
  font-size: 0.75rem;
  line-height: 1.3;
  overflow: hidden;
}

.ef-host-panel {
  margin: 0;
  padding: 0;
}

/* ── Header ─────────────────────────────────────────────────── */
.ef-host-panel__head {
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  gap: 0;
  flex-shrink: 0;
  min-height: 46px;
  padding: 9px 8px 0 15px;
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.ef-host-panel__head:active {
  cursor: grabbing;
}

.ef-host-panel__title {
  margin: 0;
  flex: 1 1 auto;
  min-width: 0;
  font-family: var(--app-home-display, var(--sa-font-display, system-ui, sans-serif));
  font-size: 20px;
  font-weight: 400;
  font-variation-settings: 'YEAR' 1979;
  letter-spacing: 0;
  text-transform: uppercase;
  line-height: 27px;
  color: #fff;
}

.ef-host-panel__head-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 7px;
}

.ef-host-panel__head-btn {
  flex-shrink: 0;
  box-sizing: border-box;
  width: 27px;
  height: 27px;
  min-height: 27px;
  padding: 0;
  line-height: 0;
  font-size: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12.61px;
  border: 0;
  color: #fff;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  transition: background 0.15s ease, box-shadow 0.15s ease;
}

.ef-host-panel__head-btn--obs {
  background: rgb(74 50 116 / 0.69);
  color: rgb(255 255 255 / 0.72);
}

.ef-host-panel__head-btn--obs:hover:not(:disabled) {
  background: rgb(84 57 132 / 0.82);
  color: #fff;
}

.ef-host-panel__head-btn--obs:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.ef-host-panel__head-btn--collapse {
  background: rgb(74 50 116 / 0.69);
  color: rgb(255 255 255 / 0.88);
}

.ef-host-panel__head-btn--collapse:hover {
  background: rgb(84 57 132 / 0.78);
}

/* ── Body ────────────────────────────────────────────────────── */
.ef-host-panel__scroller {
  flex: 1 1 auto;
  min-height: 0;
  padding: 6px 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-sizing: border-box;
  overflow-y: auto;
}

.ef-host-panel__section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ef-host-panel__section-title {
  margin: 0;
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgb(255 255 255 / 0.55);
}

.ef-host-panel__last-card {
  padding: 6px 9px;
  background: rgb(74 50 116 / 0.55);
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.25;
  color: #fff;
  word-break: break-word;
}

.ef-host-panel__last-card-line {
  font-weight: 500;
}

.ef-host-panel__last-card-empty {
  color: rgb(255 255 255 / 0.55);
  font-style: italic;
}

.ef-host-panel__trait-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
}

.ef-host-panel__trait-btn {
  padding: 5px 4px;
  font-size: 10px;
  line-height: 1.1;
  text-transform: none;
  font-weight: 500;
  color: #fff;
  background: rgb(74 50 116 / 0.69);
  border: 0;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.12s ease, transform 0.1s ease;
}

.ef-host-panel__trait-btn:hover {
  background: rgb(102 56 143 / 0.85);
}

.ef-host-panel__trait-btn:active {
  transform: scale(0.97);
}

.ef-host-panel__action-card-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 10px;
  border: 0;
  border-radius: 8px;
  background: linear-gradient(135deg, rgb(140 99 220 / 0.92), rgb(64 38 124 / 0.95));
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.15s ease;
}

.ef-host-panel__action-card-btn:hover {
  box-shadow: 0 4px 14px rgb(20 8 50 / 0.45);
}

.ef-host-panel__action-card-btn:active {
  transform: scale(0.98);
}

.ef-host-panel__phase-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: stretch;
  gap: 3px;
  width: 100%;
  box-sizing: border-box;
}

.ef-host-panel__phase-col {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin: 0;
  padding: 7px 4px 6px;
  font: inherit;
  color: var(--sa-color-text-body);
  background: rgb(74 50 116 / 0.69);
  border: 0;
  border-radius: 12.61px;
  cursor: default;
  user-select: none;
  text-align: center;
  transition: background 0.12s ease, box-shadow 0.12s ease;
}

.ef-host-panel__phase-col--on {
  background: rgb(102 56 143 / 0.73);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.12);
}

.ef-host-panel__phase-label {
  font-family: var(--app-home-ui, 'Marmelad', var(--sa-font-main, system-ui, sans-serif));
  font-size: 12px;
  font-weight: 400;
  line-height: 1.1;
  color: #fff;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Yellow bar under active phase — mirrors Mafia role underline */
.ef-host-panel__phase-bar {
  display: block;
  width: 18px;
  height: 3px;
  border-radius: 2px;
  background: #ffd455;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.ef-host-panel__phase-col--on .ef-host-panel__phase-bar {
  opacity: 1;
}

/* ── Collapsed edge tab ─────────────────────────────────────── */
.ef-host-panel__edge-tab {
  position: fixed;
  min-width: 2.4rem;
  min-height: 2.4rem;
  padding: 0.35rem 0.45rem;
  transform: translateY(-50%);
  pointer-events: auto;
  box-shadow: 0 0 0 1px var(--sa-color-border, transparent);
}

.ef-host-panel__edge-tab--left {
  border-radius: 0 var(--ui-control-compact-radius, 8px) var(--ui-control-compact-radius, 8px) 0;
}

.ef-host-panel__edge-tab--right {
  border-radius: var(--ui-control-compact-radius, 8px) 0 0 var(--ui-control-compact-radius, 8px);
}

.ef-host-panel__edge-ico {
  display: block;
  font-size: 1.1rem;
  line-height: 1;
}

@media (prefers-reduced-motion: no-preference) {
  .ef-host-panel__edge-tab--pulse {
    animation: ef-host-edge-glow 2.4s ease-in-out infinite;
  }
}

@keyframes ef-host-edge-glow {
  0%, 100% {
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--sa-color-primary) 32%, var(--sa-color-border)),
      0 0 10px color-mix(in srgb, var(--sa-color-primary) 12%, transparent);
  }
  50% {
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--sa-color-primary) 48%, var(--sa-color-border)),
      0 0 16px color-mix(in srgb, var(--sa-color-primary) 20%, transparent);
  }
}
</style>
