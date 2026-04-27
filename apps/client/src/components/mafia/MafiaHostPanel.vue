<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMafiaGameStore } from '@/stores/mafiaGame'
import { useMafiaPlayersStore } from '@/stores/mafiaPlayers'
import { mafiaGameSeatText } from '@/utils/mafiaSeatLabel'
import type { MafiaNightActionKey, MafiaRole } from '@/utils/mafiaGameTypes'

const { t } = useI18n()
const mafia = useMafiaGameStore()
const mafiaPlayers = useMafiaPlayersStore()
const { nightActions, activeNightActionRole, isMafiaHost, lastNightResult, roleByPeerId, oldMafiaMode } =
  storeToRefs(mafia)

const MAFIA_TEAM: ReadonlySet<MafiaRole> = new Set(['mafia', 'don'])

const visible = computed(() => isMafiaHost.value)

const MIN_W = 281
const MAX_W = 360
/** Enough for header + 3-line role strip + scroller padding; below this only inner area scrolls. */
const MIN_H = 126
const MARGIN = 8
/** Default gap from the viewport’s right edge to the panel (px). */
const DEFAULT_LEFT_INSET = 70
const DEFAULT_BOTTOM_INSET = 25

const collapsed = ref(false)
const size = ref({ w: 281, h: 126 })
/** Default: bottom-right (aligned with public host-panel placement). */
const pos = ref(
  (() => {
    const h = 126
    if (typeof window === 'undefined') {
      return { x: MARGIN, y: 400 }
    }
    return {
      x: Math.max(MARGIN, DEFAULT_LEFT_INSET),
      y: Math.max(MARGIN, window.innerHeight - h - DEFAULT_BOTTOM_INSET),
    }
  })(),
)
/** Snapshot when minimizing — restore on expand. */
const savedSnapshot = ref<{ pos: { x: number; y: number }; size: { w: number; h: number } } | null>(null)
/** Collapsed tab vertical position (px, “center” line for translateY(-50%)). */
const tabAnchorY = ref(200)
const collapsedSide = ref<'left' | 'right'>('left')

const dragging = ref(false)
const dragOrigin = ref({ cx: 0, cy: 0, x: 0, y: 0 })

const resizing = ref(false)
const resizeOrigin = ref({ cx: 0, cy: 0, w: 0, h: 0 })

const panelZ = 38

const panelStyle = computed(() => {
  if (collapsed.value) {
    return {}
  }
  return {
    left: `${pos.value.x}px`,
    top: `${pos.value.y}px`,
    width: `${size.value.w}px`,
    height: `${size.value.h}px`,
    zIndex: panelZ,
  } as Record<string, string | number>
})

const tabStyle = computed(
  () => {
    const side = collapsedSide.value
    return {
      top: `${tabAnchorY.value}px`,
      [side]: '0',
      zIndex: panelZ,
    } as Record<string, string | number>
  },
)

const panelCollapseSide = computed<'left' | 'right'>(() => {
  if (typeof window === 'undefined') {
    return 'left'
  }
  return pos.value.x + size.value.w * 0.5 < window.innerWidth * 0.5 ? 'left' : 'right'
})

const collapseArrowPath = computed(() =>
  panelCollapseSide.value === 'left'
    ? 'M14.5 7L9.5 12l5 5M10 12h8'
    : 'M9.5 7l5 5-5 5M6 12h8',
)

/** Display order: Mafia → Don → Sheriff → Doctor (UI only; store keys unchanged). */
const roleKeys: MafiaNightActionKey[] = ['mafia', 'don', 'sheriff', 'doctor']

const flashRole = ref<MafiaNightActionKey | null>(null)
let nightActionFlashTimer: ReturnType<typeof setTimeout> | undefined

watch(
  nightActions,
  (cur, prev) => {
    if (prev == null) {
      return
    }
    for (const k of roleKeys) {
      if (cur[k] !== prev[k]) {
        flashRole.value = k
        if (nightActionFlashTimer != null) {
          clearTimeout(nightActionFlashTimer)
        }
        nightActionFlashTimer = setTimeout(() => {
          flashRole.value = null
          nightActionFlashTimer = undefined
        }, 120)
        return
      }
    }
  },
)

function labelForKey(k: MafiaNightActionKey): string {
  return t(`mafiaPage.nightRole.${k}`)
}

function valueText(k: MafiaNightActionKey): string {
  const n = nightActions.value[k]
  if (n == null) {
    return t('mafiaPage.nightActionUnset')
  }
  return mafiaGameSeatText(n)
}

function peerIdForSeat(seat: number): string | undefined {
  const order = mafia.getDisplayNumberingOrder(mafiaPlayers.joinOrder)
  if (seat < 1 || seat > order.length) {
    return undefined
  }
  return order[seat - 1]
}

function roleAtSeat(seat: number | undefined): MafiaRole | undefined {
  if (seat == null || !Number.isInteger(seat) || seat < 1) {
    return undefined
  }
  const pid = peerIdForSeat(seat)
  if (pid == null) {
    return undefined
  }
  return roleByPeerId.value[pid]
}

/**
 * UI-only: sheriff/don check — `mafia` = red thumb down, `peace` = green thumb up, `unknown` = em dash.
 */
function checkResultKindForKey(k: 'sheriff' | 'don'): 'mafia' | 'peace' | 'unknown' {
  const seat = nightActions.value[k]
  if (seat == null) {
    return 'unknown'
  }
  const role = roleAtSeat(seat)
  if (role == null) {
    return 'unknown'
  }
  if (k === 'don') {
    return role === 'sheriff' ? 'peace' : 'mafia'
  }
  return MAFIA_TEAM.has(role) ? 'mafia' : 'peace'
}

function resultGlyphMafia(): string {
  const lr = lastNightResult.value
  if (lr == null) {
    return '—'
  }
  if (lr.saved === true) {
    return '❌'
  }
  if (lr.died != null) {
    return '☠️'
  }
  return '❌'
}

function resultGlyphDoctor(): string {
  const lr = lastNightResult.value
  if (lr == null) {
    return '—'
  }
  if (lr.saved === true) {
    return '❤️'
  }
  return '❌'
}

function resultGlyphForKey(k: MafiaNightActionKey): string {
  if (k === 'mafia') {
    return resultGlyphMafia()
  }
  if (k === 'doctor') {
    return resultGlyphDoctor()
  }
  const kind = checkResultKindForKey(k)
  if (kind === 'unknown') {
    return '—'
  }
  return kind === 'mafia' ? 'thumb-down' : 'thumb-up'
}

function resultDescForKey(k: MafiaNightActionKey): string {
  if (k === 'mafia') {
    const lr = lastNightResult.value
    if (lr == null) {
      return t('mafiaPage.hostPanelResultNone')
    }
    if (lr.saved === true) {
      return t('mafiaPage.hostPanelResultMafiaNoKill')
    }
    if (lr.died != null) {
      return t('mafiaPage.hostPanelResultMafiaKill')
    }
    return t('mafiaPage.hostPanelResultMafiaNoKill')
  }
  if (k === 'doctor') {
    const lr = lastNightResult.value
    if (lr == null) {
      return t('mafiaPage.hostPanelResultNone')
    }
    if (lr.saved === true) {
      return t('mafiaPage.hostPanelResultDoctorSaved')
    }
    return t('mafiaPage.hostPanelResultDoctorNotSaved')
  }
  const seat = nightActions.value[k]
  if (seat == null) {
    return t('mafiaPage.hostPanelResultCheckNone')
  }
  const role = roleAtSeat(seat)
  if (role == null) {
    return t('mafiaPage.hostPanelResultCheckUnknown')
  }
  return MAFIA_TEAM.has(role)
    ? t('mafiaPage.hostPanelResultCheckMafia')
    : t('mafiaPage.hostPanelResultCheckNotMafia')
}

function resultAnimKey(k: MafiaNightActionKey): string {
  const lr = lastNightResult.value
  const n = nightActions.value[k]
  return `${k}-${n ?? 'x'}-${lr?.died ?? ''}-${String(lr?.saved ?? '')}-${resultGlyphForKey(k)}`
}

function isActive(r: MafiaNightActionKey): boolean {
  return activeNightActionRole.value === r
}

function selectNightActionRole(r: MafiaNightActionKey): void {
  mafia.setHostInteractionMode('night')
  mafia.setActiveNightActionRole(r)
}

function maxPanelHeight(): number {
  return Math.max(MIN_H, Math.floor(window.innerHeight * 0.88) - 2 * MARGIN)
}

function clampSize(): void {
  const vw = window.innerWidth
  const maxH = maxPanelHeight()
  size.value.w = Math.min(
    MAX_W,
    Math.max(MIN_W, Math.min(size.value.w, vw - MARGIN - DEFAULT_LEFT_INSET)),
  )
  size.value.h = Math.min(maxH, Math.max(MIN_H, size.value.h))
}

function clampPos(): void {
  const vw = window.innerWidth
  const vh = window.innerHeight
  clampSize()
  pos.value.x = Math.min(Math.max(MARGIN, pos.value.x), vw - size.value.w - MARGIN)
  pos.value.y = Math.min(Math.max(MARGIN, pos.value.y), vh - size.value.h - MARGIN)
}

function placeDefaultUnobstructed(): void {
  clampSize()
  const w = size.value.w
  const h = size.value.h
  const vw = window.innerWidth
  const vh = window.innerHeight
  pos.value = {
    x: Math.max(MARGIN, Math.min(DEFAULT_LEFT_INSET, vw - w - MARGIN)),
    y: Math.max(MARGIN, vh - h - DEFAULT_BOTTOM_INSET),
  }
  clampPos()
}

function onWindowResize(): void {
  clampPos()
  tabAnchorY.value = Math.max(
    MARGIN,
    Math.min(pos.value.y + size.value.h * 0.5, window.innerHeight - MARGIN),
  )
}

let dragListenersAttached = false
let resListenersAttached = false

function endDrag(): void {
  if (!dragListenersAttached) {
    return
  }
  dragListenersAttached = false
  document.removeEventListener('pointermove', onPointerMoveDrag, true)
  document.removeEventListener('pointerup', onPointerUpDrag, true)
  document.removeEventListener('pointercancel', onPointerUpDrag, true)
  dragging.value = false
}

function endResize(): void {
  if (!resListenersAttached) {
    return
  }
  resListenersAttached = false
  document.removeEventListener('pointermove', onPointerMoveResize, true)
  document.removeEventListener('pointerup', onPointerUpResize, true)
  document.removeEventListener('pointercancel', onPointerUpResize, true)
  resizing.value = false
}

function onPointerMoveDrag(ev: PointerEvent): void {
  if (!dragging.value) {
    return
  }
  ev.preventDefault()
  const dx = ev.clientX - dragOrigin.value.cx
  const dy = ev.clientY - dragOrigin.value.cy
  pos.value = {
    x: dragOrigin.value.x + dx,
    y: dragOrigin.value.y + dy,
  }
  clampPos()
}

function onPointerUpDrag(): void {
  endDrag()
}

function onHeadPointerDown(ev: PointerEvent): void {
  if (ev.button !== 0) {
    return
  }
  const el = ev.target
  if (el instanceof Element && el.closest('button, a, input, textarea, select, [data-no-maid-drag]')) {
    return
  }
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

function onPointerMoveResize(ev: PointerEvent): void {
  if (!resizing.value) {
    return
  }
  ev.preventDefault()
  const dx = ev.clientX - resizeOrigin.value.cx
  const dy = ev.clientY - resizeOrigin.value.cy
  const maxH = maxPanelHeight()
  size.value = {
    w: Math.min(MAX_W, Math.max(MIN_W, resizeOrigin.value.w + dx)),
    h: Math.min(maxH, Math.max(MIN_H, resizeOrigin.value.h + dy)),
  }
  const vw = window.innerWidth
  size.value.w = Math.min(size.value.w, vw - MARGIN - DEFAULT_LEFT_INSET)
  clampPos()
}

function onPointerUpResize(): void {
  endResize()
}

function onResizePointerDown(ev: PointerEvent): void {
  if (ev.button !== 0) {
    return
  }
  ev.preventDefault()
  ev.stopPropagation()
  resizing.value = true
  resizeOrigin.value = {
    cx: ev.clientX,
    cy: ev.clientY,
    w: size.value.w,
    h: size.value.h,
  }
  if (!resListenersAttached) {
    resListenersAttached = true
    document.addEventListener('pointermove', onPointerMoveResize, { capture: true, passive: false })
    document.addEventListener('pointerup', onPointerUpResize, { capture: true })
    document.addEventListener('pointercancel', onPointerUpResize, { capture: true })
  }
}

function collapsePanel(): void {
  collapsedSide.value = panelCollapseSide.value
  savedSnapshot.value = {
    pos: { ...pos.value },
    size: { ...size.value },
  }
  tabAnchorY.value = Math.max(
    MARGIN + 20,
    Math.min(
      pos.value.y + size.value.h * 0.45,
      window.innerHeight - MARGIN - 20,
    ),
  )
  endDrag()
  endResize()
  collapsed.value = true
}

function expandPanel(): void {
  const s = savedSnapshot.value
  collapsed.value = false
  if (s != null) {
    pos.value = { ...s.pos }
    size.value = { ...s.size }
  } else {
    placeDefaultUnobstructed()
  }
  void nextTick(() => {
    clampPos()
  })
}

function clearHostPanelSelections(): void {
  mafia.clearNightActions()
}

onMounted(() => {
  placeDefaultUnobstructed()
  window.addEventListener('resize', onWindowResize, { passive: true })
})

onBeforeUnmount(() => {
  if (nightActionFlashTimer != null) {
    clearTimeout(nightActionFlashTimer)
  }
  window.removeEventListener('resize', onWindowResize)
  endDrag()
  endResize()
})

watch(visible, (v) => {
  if (!v) {
    endDrag()
    endResize()
  }
})
</script>

<template>
  <Teleport v-if="visible" to="body">
    <button
      v-if="collapsed"
      type="button"
      class="mafia-host-panel__edge-tab sa-chip-btn mafia-host-panel__edge-tab--pulse"
      :class="{
        'sa-chip-btn--on': true,
        'mafia-host-panel__edge-tab--left': collapsedSide === 'left',
        'mafia-host-panel__edge-tab--right': collapsedSide === 'right',
      }"
      :style="tabStyle"
      :aria-label="t('mafiaPage.hostPanelOpen')"
      :title="t('mafiaPage.hostPanelOpen')"
      @click="expandPanel"
    >
      <span class="mafia-host-panel__edge-ico" aria-hidden="true">🎭</span>
    </button>

    <aside
      v-else
      class="mafia-host-panel mafia-host-panel__shell"
      :style="panelStyle"
      :aria-label="t('mafiaPage.hostPanelTitle')"
    >
      <header
        class="mafia-host-panel__head"
        @pointerdown="onHeadPointerDown"
      >
        <span class="mafia-host-panel__grip" aria-hidden="true" />
        <h2 class="mafia-host-panel__title">{{ t('mafiaPage.hostPanelTitle') }}</h2>
        <div class="mafia-host-panel__head-actions" data-no-maid-drag>
          <button
            type="button"
            class="sa-chip-btn mafia-host-panel__collapse-action mafia-host-panel__collapse-action--clear"
            :aria-label="t('mafiaPage.clearNightActionsTitle')"
            :title="t('mafiaPage.clearNightActionsTitle')"
            @click="clearHostPanelSelections"
          >
            <svg
              class="mafia-host-panel__collapse-ico"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                stroke-width="2.25"
                stroke-linecap="round"
              />
            </svg>
          </button>
          <button
            type="button"
            class="sa-chip-btn mafia-host-panel__collapse-action mafia-host-panel__collapse-action--collapse"
            :aria-label="t('mafiaPage.hostPanelCollapse')"
            :title="t('mafiaPage.hostPanelCollapse')"
            @click="collapsePanel"
          >
            <svg
              class="mafia-host-panel__collapse-ico mafia-host-panel__collapse-ico--arrow"
              :class="`mafia-host-panel__collapse-ico--arrow-${panelCollapseSide}`"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              aria-hidden="true"
              focusable="false"
            >
              <path
                :d="collapseArrowPath"
                fill="none"
                stroke="currentColor"
                stroke-width="2.25"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
      </header>

      <div class="mafia-host-panel__scroller">
        <div
          class="mafia-host-panel__night-row"
          role="group"
          :aria-label="t('mafiaPage.nightActionsTitle')"
        >
          <button
            v-for="r in roleKeys"
            :key="r"
            type="button"
            class="mafia-host-panel__role-col h-focus-ring"
            :class="{
              'mafia-host-panel__role-col--on': isActive(r),
              'mafia-host-panel__role-col--flash': flashRole === r,
            }"
            :aria-pressed="isActive(r)"
            :aria-label="t('mafiaPage.hostPanelSetActiveColumnTitle', { role: labelForKey(r) })"
            :title="t('mafiaPage.hostPanelSetActiveColumnTitle', { role: labelForKey(r) })"
            @click="selectNightActionRole(r)"
          >
            <span class="mafia-host-panel__role-label">{{ labelForKey(r) }}</span>
            <span
              class="mafia-host-panel__role-value"
            >{{ valueText(r) }}</span>
            <Transition v-if="!oldMafiaMode" name="mhp-res" mode="out-in">
              <span
                :key="resultAnimKey(r)"
                class="mafia-host-panel__role-result"
                :class="{
                  'mafia-host-panel__role-result--check-icons': r === 'sheriff' || r === 'don',
                }"
                :title="resultDescForKey(r)"
                :aria-label="resultDescForKey(r)"
                role="img"
              >
                <template v-if="r === 'sheriff' || r === 'don'">
                  <span
                    v-if="checkResultKindForKey(r) === 'unknown'"
                    class="mafia-host-panel__check-unknown"
                  >—</span>
                  <svg
                    v-else-if="checkResultKindForKey(r) === 'peace'"
                    class="mafia-host-panel__check-icon mafia-host-panel__check-icon--peace"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M7 10v12" />
                    <path
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M15 4.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"
                    />
                  </svg>
                  <svg
                    v-else
                    class="mafia-host-panel__check-icon mafia-host-panel__check-icon--mafia"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M17 14V2" />
                    <path
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"
                    />
                  </svg>
                </template>
                <template v-else>{{ resultGlyphForKey(r) }}</template>
              </span>
            </Transition>
          </button>
        </div>
      </div>
      <div
        class="mafia-host-panel__resize"
        :aria-label="t('mafiaPage.hostPanelResizeHint')"
        @pointerdown="onResizePointerDown"
      />
    </aside>
  </Teleport>
</template>

<style scoped>
/* Card shell: same token stack as `call-floating-surface` / `CallPage` dock, but `var(--sa-radius-sm)` (panel, not pill). */
.mafia-host-panel__shell {
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

.mhp-res-enter-active,
.mhp-res-leave-active {
  transition: opacity 0.22s ease;
}

.mhp-res-enter-from,
.mhp-res-leave-to {
  opacity: 0;
}

.mafia-host-panel {
  /* outer uses panelStyle; inner layout */
  margin: 0;
  padding: 0;
}

.mafia-host-panel__head {
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  gap: 0;
  flex-shrink: 0;
  min-height: 46px;
  padding: 9px 8px 0 15px;
  margin: 0;
  border-bottom: 0;
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.mafia-host-panel__head:active {
  cursor: grabbing;
}

.mafia-host-panel__grip {
  display: none;
}

.mafia-host-panel__head-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 7px;
}

.mafia-host-panel__title {
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

.mafia-host-panel__collapse-action {
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
  background: rgb(74 50 116 / 0.69);
  color: #fff;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}

.mafia-host-panel__collapse-action:hover:not(:disabled) {
  color: #fff;
  box-shadow: none;
}

.mafia-host-panel__collapse-action--clear {
  background: rgb(169 45 47 / 0.62);
  color: rgb(255 255 255 / 0.72);
}

.mafia-host-panel__collapse-action--clear:hover:not(:disabled) {
  background: rgb(169 45 47 / 0.74);
}

.mafia-host-panel__collapse-action--collapse {
  background: rgb(74 50 116 / 0.69);
  color: rgb(255 255 255 / 0.88);
}

.mafia-host-panel__collapse-action--collapse:hover:not(:disabled) {
  background: rgb(84 57 132 / 0.78);
}

.mafia-host-panel__back-ico {
  display: block;
  width: 27px;
  height: 27px;
  pointer-events: none;
}

.mafia-host-panel__collapse-ico {
  display: block;
  flex-shrink: 0;
  pointer-events: none;
}

.mafia-host-panel__collapse-ico--arrow {
  width: 17px;
  height: 17px;
}

.mafia-host-panel__collapse-action--collapse .mafia-host-panel__collapse-ico--arrow {
  transform: translateX(-1px);
}

.mafia-host-panel__collapse-action--collapse .mafia-host-panel__collapse-ico--arrow-right {
  transform: translateX(1px);
}

.mafia-host-panel__scroller {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  overflow-y: hidden;
  overflow-x: hidden;
  /* Symmetric insets + extra bottom so role glow / resize grip do not read as “cut off.” */
  padding: 0 4px 4px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-sizing: border-box;
  -webkit-overflow-scrolling: touch;
}

.mafia-host-panel__night-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: stretch;
  gap: 3px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  /* Keeps the bottom rounded shell visible under selected-column glow. */
  padding-bottom: 0;
}

.mafia-host-panel__role-col {
  box-sizing: border-box;
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  margin: 0;
  padding: 6px 4px 5px;
  font: inherit;
  overflow: visible;
  color: var(--sa-color-text-body);
  background: rgb(74 50 116 / 0.69);
  border: 0;
  border-radius: 12.61px;
  cursor: pointer;
  user-select: none;
  text-align: center;
  transition:
    background 0.12s ease,
    border-color 0.12s ease,
    box-shadow 0.12s ease;
}

.mafia-host-panel__role-col:hover {
  background: rgb(84 57 132 / 0.76);
}

.mafia-host-panel__role-col--on {
  background: rgb(102 56 143 / 0.73);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.12);
}

.mafia-host-panel__role-col--flash {
  background: color-mix(in srgb, var(--sa-color-primary) 20%, transparent);
}

.mafia-host-panel__role-col--flash .mafia-host-panel__role-value {
  animation: mhp-value-bump 0.38s ease;
}

.mafia-host-panel__role-label {
  font-family: var(--app-home-ui, 'Marmelad', var(--sa-font-main, system-ui, sans-serif));
  font-size: 12px;
  font-weight: 400;
  line-height: 1.1;
  letter-spacing: 0;
  color: #fff;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mafia-host-panel__role-value {
  display: block;
  font-family: var(--app-home-counter, 'Coda Caption', var(--sa-font-display, system-ui, sans-serif));
  font-size: 18px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: #ffd455;
  min-height: 18px;
}

.mafia-host-panel__role-col:not(.mafia-host-panel__role-col--on) .mafia-host-panel__role-value {
  color: #ffd455;
  opacity: 1;
}

.mafia-host-panel__role-result {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 0.7rem;
  line-height: 1;
  min-height: 0.8rem;
  padding: 0;
  opacity: 0.8;
  filter: grayscale(0.1);
}

.mafia-host-panel__role-result--check-icons {
  filter: none;
  opacity: 1;
  line-height: 0;
}

.mafia-host-panel__check-unknown {
  font-size: 0.7rem;
  line-height: 1;
  opacity: 0.75;
  color: color-mix(in srgb, var(--sa-color-text-muted) 90%, #fff);
}

.mafia-host-panel__check-icon {
  display: block;
  width: 0.86rem;
  height: 0.86rem;
  margin: 0 auto;
}

.mafia-host-panel__check-icon--peace {
  color: #22c55e;
}

.mafia-host-panel__check-icon--mafia {
  color: #ef4444;
}

@media (prefers-reduced-motion: reduce) {
  .mafia-host-panel__role-col--flash .mafia-host-panel__role-value {
    animation: none;
  }
  .mhp-res-enter-active,
  .mhp-res-leave-active {
    transition: none;
  }
}

@keyframes mhp-value-bump {
  0%,
  100% {
    transform: scale(1);
  }
  45% {
    transform: scale(1.2);
  }
}

.mafia-host-panel__resize {
  display: none;
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 0.9rem;
  height: 0.9rem;
  cursor: nwse-resize;
  touch-action: none;
  z-index: 1;
  background: linear-gradient(
    135deg,
    transparent 0%,
    transparent 50%,
    color-mix(in srgb, var(--sa-color-text-muted) 45%, transparent) 50%,
    color-mix(in srgb, var(--sa-color-text-muted) 45%, transparent) 100%
  );
  background-size: 0.4rem 0.4rem;
  background-repeat: no-repeat;
  background-position: bottom 1px right 1px;
  opacity: 0.5;
  border-bottom-right-radius: calc(var(--sa-radius-sm) - 2px);
  pointer-events: auto;
}

.mafia-host-panel__resize:hover {
  opacity: 0.9;
}

.mafia-host-panel__edge-tab {
  position: fixed;
  min-width: 2.4rem;
  min-height: 2.4rem;
  padding: 0.35rem 0.45rem;
  transform: translateY(-50%);
  pointer-events: auto;
  box-shadow: 0 0 0 1px var(--sa-color-border, transparent);
}

.mafia-host-panel__edge-tab--right {
  border-radius: var(--ui-control-compact-radius, 8px) 0 0 var(--ui-control-compact-radius, 8px);
}

.mafia-host-panel__edge-tab--left {
  border-radius: 0 var(--ui-control-compact-radius, 8px) var(--ui-control-compact-radius, 8px) 0;
}

.mafia-host-panel__edge-ico {
  display: block;
  font-size: 1.1rem;
  line-height: 1;
}

@media (prefers-reduced-motion: no-preference) {
  .mafia-host-panel__edge-tab--pulse {
    animation: mafia-host-edge-glow 2.4s ease-in-out infinite;
  }
}

@keyframes mafia-host-edge-glow {
  0%,
  100% {
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
