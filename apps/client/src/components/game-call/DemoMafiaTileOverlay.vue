<script setup lang="ts">
/**
 * DemoMafiaTileOverlay — **placeholder** tile-chrome layer for the Game
 * Template page (Mafia-flavoured seat / role / life / kick badges).
 *
 * Driven by the generic `GameRoomSession` adapter from
 * `composables/game-session/useGameRoomSession` — does NOT import any
 * production Mafia store or composable. Production Mafia continues to use
 * the existing in-tile rendering inside `<ParticipantTile>`; this overlay
 * is a reference design for future tile-overlay extraction (Phase 5e).
 *
 * The "Demo" in the filename is historical and signals "this is the
 * temporary placeholder overlay until tile chrome is extracted from
 * `<ParticipantTile>`". The data flowing in via props is whatever the
 * page adapter provides — local-fallback today, server-backed in the
 * future. No internal state assumes mock vs real.
 *
 * Visual scope:
 *   - top-left seat badge (null seat = no badge; that's the host)
 *   - top-center "HOST" badge when peer is the room host
 *   - top-right role badge (visible to the host viewer only)
 *   - full-tile dead veneer when `lifeState === 'dead'`
 *   - selection ring when this tile is the swap target or speaking draft
 *   - host-only bottom-right action button stack: Kill/Revive + Kick
 *   - whole-tile click target (page interprets via interaction mode)
 *
 * Intentionally OUT OF SCOPE:
 *   - elimination mark icon (large) for the placeholder branch
 *   - elimination background swatches popover
 *   - kill/revive animations
 */

import { computed } from 'vue'
import type {
  GameTileRole,
  GameTileLifeState,
} from '@/composables/game-session/useGameRoomSession'

const props = withDefaults(
  defineProps<{
    peerId: string
    seat?: number | null
    role?: GameTileRole
    lifeState?: GameTileLifeState
    /** When true, the current viewer is the mock host (host UI visible). */
    isMockHost?: boolean
    /** When true, this peer IS the mock host. */
    isPeerMockHost?: boolean
    /** When true, this tile is the host's current swap-mode selection. */
    swapSelected?: boolean
    /** When true, this tile is the speaking-mode draft "by" nominator. */
    speakingDraft?: boolean
    /** When true, this seat appears as a target in the speaking queue. */
    speakingTarget?: boolean
    /** When true, this peer is kicked (rendered with a visual indicator). */
    kicked?: boolean
    /** When true, this peer is mock-muted (rendered with a mute hint). */
    muted?: boolean
  }>(),
  {
    seat: null,
    role: undefined,
    lifeState: 'alive',
    isMockHost: false,
    isPeerMockHost: false,
    swapSelected: false,
    speakingDraft: false,
    speakingTarget: false,
    kicked: false,
    muted: false,
  },
)

const emit = defineEmits<{
  'toggle-life': [peerId: string]
  kick: [peerId: string]
  'tile-click': [peerId: string]
}>()

const showSeat = computed(() => typeof props.seat === 'number' && props.seat > 0)
const showRoleBadge = computed(() => props.isMockHost && typeof props.role === 'string')

function onTileClick(ev: MouseEvent): void {
  // Ignore clicks on interactive children (buttons, etc.)
  const target = ev.target
  if (target instanceof Element && target.closest('button, .game-call-tile-overlay__interactive')) {
    return
  }
  emit('tile-click', props.peerId)
}

function onToggleLifeClick(ev: MouseEvent): void {
  ev.stopPropagation()
  if (!props.isMockHost) return
  emit('toggle-life', props.peerId)
}

function onKickClick(ev: MouseEvent): void {
  ev.stopPropagation()
  if (!props.isMockHost) return
  emit('kick', props.peerId)
}
</script>

<template>
  <div
    class="demo-tile-overlay"
    :class="{
      'demo-tile-overlay--dead': lifeState === 'dead',
      'demo-tile-overlay--swap-selected': swapSelected,
      'demo-tile-overlay--speaking-draft': speakingDraft,
      'demo-tile-overlay--speaking-target': speakingTarget,
      'demo-tile-overlay--host-peer': isPeerMockHost,
      'demo-tile-overlay--kicked': kicked,
    }"
    @click="onTileClick"
  >
    <!-- Selection ring layer (visual only, click-through) -->
    <div class="demo-tile-overlay__ring" aria-hidden="true" />

    <!-- Top-left: seat badge (only for non-host peers) -->
    <span
      v-if="showSeat"
      class="demo-tile-overlay__seat"
      aria-hidden="true"
    >{{ seat }}</span>

    <!-- Top-center: HOST badge (only on the mock host's tile) -->
    <span
      v-if="isPeerMockHost"
      class="demo-tile-overlay__host-badge"
      aria-label="Mock host"
    >HOST</span>

    <!-- Top-right: role badge (only visible to the mock host viewer) -->
    <span
      v-if="showRoleBadge"
      class="demo-tile-overlay__role"
      :title="role"
      aria-hidden="true"
    >{{ role }}</span>

    <!-- Mute indicator (small, bottom-left) -->
    <span
      v-if="muted"
      class="demo-tile-overlay__mute-hint"
      aria-label="Mock-muted"
      title="Mock-muted"
    >🔇</span>

    <!-- Kicked indicator (large, center) -->
    <div
      v-if="kicked"
      class="demo-tile-overlay__kicked"
      aria-label="Removed from table"
    >REMOVED</div>

    <!-- Dead veneer (full-tile dim overlay) -->
    <div
      v-if="lifeState === 'dead'"
      class="demo-tile-overlay__veneer"
      aria-hidden="true"
    />

    <!-- Host-only bottom-right action stack -->
    <div v-if="isMockHost && !isPeerMockHost" class="demo-tile-overlay__actions">
      <button
        type="button"
        class="demo-tile-overlay__action game-call-tile-overlay__interactive"
        :aria-label="lifeState === 'dead' ? 'Revive (mock)' : 'Kill (mock)'"
        :title="lifeState === 'dead' ? 'Revive (mock)' : 'Kill (mock)'"
        @click.stop="onToggleLifeClick"
      >
        {{ lifeState === 'dead' ? 'Revive' : 'Kill' }}
      </button>
      <button
        v-if="!kicked"
        type="button"
        class="demo-tile-overlay__action demo-tile-overlay__action--danger game-call-tile-overlay__interactive"
        aria-label="Kick from table (mock)"
        title="Kick from table (mock)"
        @click.stop="onKickClick"
      >
        Kick
      </button>
    </div>
  </div>
</template>

<style scoped>
.demo-tile-overlay {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  cursor: default;
}

/* Selection / state ring */
.demo-tile-overlay__ring {
  position: absolute;
  inset: 4px;
  border-radius: 10px;
  pointer-events: none;
  border: 2px solid transparent;
  transition: border-color 120ms ease-out, box-shadow 120ms ease-out;
}

.demo-tile-overlay--swap-selected .demo-tile-overlay__ring {
  border-color: rgba(255, 200, 60, 0.85);
  box-shadow: 0 0 0 1px rgba(255, 200, 60, 0.45), 0 0 18px rgba(255, 200, 60, 0.3);
}
.demo-tile-overlay--speaking-draft .demo-tile-overlay__ring {
  border-color: rgba(170, 120, 240, 0.85);
  box-shadow: 0 0 0 1px rgba(170, 120, 240, 0.45), 0 0 18px rgba(170, 120, 240, 0.3);
}
.demo-tile-overlay--speaking-target .demo-tile-overlay__ring {
  border-color: rgba(120, 200, 120, 0.7);
  box-shadow: 0 0 0 1px rgba(120, 200, 120, 0.35);
}
.demo-tile-overlay--host-peer .demo-tile-overlay__ring {
  border-color: rgba(255, 215, 0, 0.45);
}

/* Seat badge (top-left) */
.demo-tile-overlay__seat {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 2;
  min-width: 24px;
  height: 24px;
  padding: 0 8px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  line-height: 24px;
  text-align: center;
  user-select: none;
}

/* HOST badge (top-center) */
.demo-tile-overlay__host-badge {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 215, 0, 0.85);
  color: #1a1a22;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1px;
  user-select: none;
}

/* Role badge (top-right, host view only) */
.demo-tile-overlay__role {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(120, 60, 200, 0.6);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  user-select: none;
}

/* Mute indicator (bottom-left, small) */
.demo-tile-overlay__mute-hint {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 2;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  user-select: none;
}

/* Kicked overlay (large, central) */
.demo-tile-overlay__kicked {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 4;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(180, 60, 60, 0.85);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 1.5px;
  user-select: none;
}

/* Dead veneer (full-tile dim) */
.demo-tile-overlay__veneer {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: rgba(15, 15, 20, 0.55);
  backdrop-filter: grayscale(0.5);
  -webkit-backdrop-filter: grayscale(0.5);
  pointer-events: none;
}

/* Host action stack (bottom-right) */
.demo-tile-overlay__actions {
  position: absolute;
  bottom: 8px;
  right: 8px;
  z-index: 3;
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.demo-tile-overlay__action {
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 120, 120, 0.5);
  background: rgba(120, 30, 30, 0.7);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}

.demo-tile-overlay__action:hover {
  background: rgba(160, 40, 40, 0.85);
}

.demo-tile-overlay--dead .demo-tile-overlay__action {
  border-color: rgba(120, 220, 120, 0.5);
  background: rgba(30, 90, 30, 0.7);
}
.demo-tile-overlay--dead .demo-tile-overlay__action:hover {
  background: rgba(50, 130, 50, 0.85);
}

.demo-tile-overlay__action--danger {
  border-color: rgba(220, 100, 100, 0.55);
  background: rgba(70, 20, 20, 0.7);
}
.demo-tile-overlay__action--danger:hover {
  background: rgba(110, 30, 30, 0.85);
}
</style>
