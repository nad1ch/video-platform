<script setup lang="ts">
/**
 * GameTemplatePage — admin-only reusable **Game Room** template.
 *
 * Mounted at `/app/game-template`. Renders the reusable game-call surface
 * (host-last ordering, seat numbering, host toolbar, speaking queue, timer)
 * against the generic `useGameRoomSession` boundary.
 *
 * Today the session boundary is backed by a **temporary local fallback**
 * (single-browser sessionStorage state; no cross-tab / cross-user truth).
 * The page surfaces this via a visible banner. When a server-backed
 * `gameroom:*` WS protocol lands, the boundary will switch transparently
 * to a server adapter — no page changes required.
 *
 * Visual: mirrors production `<CallPage>` 1:1 by reusing the existing
 * `.call-page__*` class set (loaded via the side-effect CSS import below).
 *
 * Hard isolation from production Mafia state: the page joins a
 * `gamecall-lab:`-prefixed signaling room (so it never collides with
 * production Mafia / EatFirst rooms), and the session boundary does not
 * import any Mafia store / composable / WS protocol.
 */

// Side-effect: load the production call-page stylesheet so the
// `.call-page__*` classes used by this page (and by the wrapped
// `<CallControlsDock>`) resolve to their production rules.
import '@/components/call/CallPage.css'

import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useCallSessionStore } from 'call-core'
import AppContainer from '@/components/ui/AppContainer.vue'
import CallControlsDock from '@/components/call/CallControlsDock.vue'
import GameCallShell from '@/components/game-call/GameCallShell.vue'
import GameCallVideoGrid from '@/components/game-call/GameCallVideoGrid.vue'
import DemoMafiaTileOverlay from '@/components/game-call/DemoMafiaTileOverlay.vue'
import GameTimerOverlay, {
  type GameTimerLabels,
} from '@/components/game-call/GameTimerOverlay.vue'
import GameHostActionsBar, {
  type GameHostActionsLabels,
} from '@/components/game-call/GameHostActionsBar.vue'
import GameSpeakingQueueBar, {
  type GameSpeakingQueueLabels,
} from '@/components/game-call/GameSpeakingQueueBar.vue'
import { useGameRoomSession } from '@/composables/game-session/useGameRoomSession'
import type { GameCallTileLike } from '@/components/game-call/gameCallShellContext'
import { useAuth } from '@/composables/useAuth'

const { user } = useAuth()

// ---- Lab room id (with the `gamecall-lab:` namespace prefix) ----

const defaultRoomBase = computed(() => {
  const uid = user.value?.id
  return typeof uid === 'string' && uid.length > 0 ? `demo-${uid.slice(0, 8)}` : 'demo'
})
const roomBaseInput = ref<string>('')
const roomBase = computed(() => {
  const raw = roomBaseInput.value.trim()
  return raw.length > 0 ? raw : defaultRoomBase.value
})
const labRoomId = computed(() => `gamecall-lab:${roomBase.value}`)
// Re-mount the shell when the room id changes (simplest way to switch room).
const shellKey = computed(() => labRoomId.value)

// ---- Generic game-room session ----
//
// Backed by `useGameRoomTemporaryLocalAdapter` today (single-browser
// sessionStorage fallback; see the banner in the template). The page only
// consumes the `GameRoomSession` interface — when a server-backed adapter
// ships, this single import swaps internally with zero page changes.

const callSession = useCallSessionStore()
const { selfPeerId } = storeToRefs(callSession)

const session = useGameRoomSession({ selfPeerId, roomBase })

/**
 * Host-last ordering for `<GameCallVideoGrid :order-tiles>`. The boundary's
 * `orderTilesHostLast` reuses the shared `sortPeerIdsHostLast` pure helper —
 * same as production Mafia.
 */
function orderTilesHostLast(tiles: readonly GameCallTileLike[]): readonly GameCallTileLike[] {
  return session.orderTilesHostLast(tiles)
}

/**
 * "Claim host" affordance visible when no host exists yet. Mirrors the
 * production Mafia client's behaviour: the local user explicitly claims
 * (via `mafia:claim-host` in Mafia; via `session.claimHost()` here). No
 * silent auto-promotion.
 */
const canClaimHost = computed(
  () =>
    session.hostPeerId.value == null &&
    typeof selfPeerId.value === 'string' &&
    selfPeerId.value.length > 0,
)

/**
 * Inline English labels for the shared timer / host actions / speaking
 * queue components. The Game Template route is admin-only and unlocalised,
 * so passing labels objects directly avoids adding new i18n keys for an
 * experimental page.
 */
const timerLabels: GameTimerLabels = {
  countdown: (time) => `Countdown ${time}`,
  durationSec: (n) => `${n} seconds`,
  start: 'Start timer',
  stop: 'Stop timer',
  controlsAria: 'Timer controls',
  durationsAria: 'Timer durations',
}

const hostActionsLabels: GameHostActionsLabels = {
  toolbarAria: 'Host actions',
  muteAllTitle: 'Mute everyone',
  reshuffleTitle: 'Reshuffle seats',
  reshuffleDisabledHint: 'Need at least 2 players to reshuffle',
  swapModeTitle: 'Click two tiles to swap their seats',
  swapModeAria: 'Toggle swap mode',
  reshuffleConfirmTitle: 'Reshuffle seats?',
  reshuffleConfirmBody:
    'This will randomly reassign seats to all non-host players. Continue?',
  reshuffleConfirmProceed: 'Reshuffle',
  reshuffleConfirmCancel: 'Cancel',
}

const speakingQueueLabels: GameSpeakingQueueLabels = {
  containerAria: 'Speaking queue',
  toolbarAria: 'Speaking queue controls',
  speakingModeTitle: 'Click two tiles to add a speaking pair',
  speakingModeAria: 'Toggle speaking mode',
  clearAllTitle: 'Clear the speaking queue',
  chipRemoveTitle: (by, target) => `Remove ${by} → ${target}`,
  chipViewOnlyTitle: (by, target) => `${by} speaks → ${target}`,
}

const canReshuffle = computed(() => {
  // At least 2 non-host, non-kicked peers required for a reshuffle to be
  // meaningful. Mirrors production Mafia's `n >= 2` rule for the old mode.
  let n = 0
  for (const id of Object.keys(session.byPeerId)) {
    if (id === session.hostPeerId.value) continue
    if (session.byPeerId[id]?.kicked) continue
    n += 1
  }
  return n >= 2
})

function onSetMuteAll(muted: boolean): void {
  session.setMuteAll(muted)
}

function onToggleSwapMode(): void {
  session.setInteractionMode('swap')
}

function onToggleSpeakingMode(): void {
  session.setInteractionMode('speaking')
}

// ---- Local-fallback controls panel (collapsed by default; bottom-right) ----
//
// These controls only make sense for the temporary-local adapter (they let
// an admin probe the page without a real cross-tab session). When the
// server-backed adapter ships, the panel can shrink to its diagnostic
// affordances (or disappear entirely).

const controlsPanelOpen = ref(false)
function toggleControlsPanel(): void {
  controlsPanelOpen.value = !controlsPanelOpen.value
}

// ---- Dock-level UI state (passed through to <CallControlsDock>) ----

const micPickerOpen = ref(false)
const camPickerOpen = ref(false)
const speakerPickerOpen = ref(false)
const chatOpen = ref(false)
const audioOutputDeviceId = ref<string | null>(null)

// ---- Shell event hooks ----

function onShellLeft(): void {
  // Keep persisted session state across reload (sessionStorage); only clear
  // ephemeral interaction mode + selection so reconnect is clean.
  session.setInteractionMode('idle')
}
function onShellJoinError(message: string): void {
  console.warn('[game-template] join error:', message)
}
</script>

<template>
  <div class="page-route game-template-page">
    <AppContainer class="call-page" :flush="true">
      <div class="call-page__shell">
        <section class="call-page__active call-page__active--with-dock">
          <GameCallShell
            :key="shellKey"
            :room-id="labRoomId"
            @left="onShellLeft"
            @join-error="onShellJoinError"
          >
            <template #default="{ ctx, tiles }">
              <!--
                LAB chip indicating the page is admin-only + currently backed
                by the temporary local fallback (browser-only state). The
                pill flips to a quieter style once a server adapter exists.
              -->
              <div
                class="game-template-page__lab-chip"
                aria-label="Experimental — admin only — temporary local fallback"
              >
                <span class="game-template-page__lab-chip-pill">{{
                  session.isTemporaryLocalFallback ? 'LOCAL' : 'LAB'
                }}</span>
                <span class="game-template-page__lab-chip-room" :title="labRoomId">
                  {{ roomBase }}
                </span>
              </div>

              <!--
                Local-fallback banner. Visible whenever the game-room session
                comes from the browser-local adapter (i.e. there's no server
                truth for host/players/queue/timer). Hidden automatically
                when a server-backed adapter is wired in.
              -->
              <div
                v-if="session.isTemporaryLocalFallback"
                class="game-template-page__fallback-banner"
                role="status"
                aria-live="polite"
              >
                <strong>Local fallback:</strong>
                host, seats, queue, and timer are stored in this browser
                only. Other tabs and other users will not see the same state
                until a server-backed game-room session is implemented.
              </div>

              <!--
                Top-center timer overlay (shared with production Mafia via
                <GameTimerOverlay>). The chip is `position: absolute` inside
                its own component, so wrapping in a frame gives it the same
                z-stack as `<MafiaOverlay>` does in /app/mafia.
              -->
              <div class="game-template-page__timer-frame" aria-hidden="false">
                <GameTimerOverlay
                  :timer="session.timer.value"
                  :is-host="session.isLocalUserHost.value"
                  :labels="timerLabels"
                  @start="session.startTimer"
                  @stop="session.stopTimer"
                />
              </div>

              <!--
                Claim-host affordance. Mirrors production Mafia: no implicit
                auto-promotion; a user becomes host only by explicitly
                clicking "Claim host" while the seat is empty.
              -->
              <div
                v-if="canClaimHost"
                class="game-template-page__claim-host"
              >
                <button
                  type="button"
                  class="game-template-page__claim-host-btn"
                  title="Become the room host (no host is currently claimed)"
                  @click="session.claimHost"
                >
                  Claim host
                </button>
              </div>

              <!-- Stage (production class set; CSS comes from CallPage.css). -->
              <GameCallVideoGrid :order-tiles="orderTilesHostLast">
                <template #tile-overlay="{ peerId }">
                  <DemoMafiaTileOverlay
                    :peer-id="peerId"
                    :seat="session.entryFor(peerId)?.seat"
                    :role="session.entryFor(peerId)?.role"
                    :life-state="session.entryFor(peerId)?.lifeState ?? 'alive'"
                    :is-mock-host="session.isLocalUserHost.value"
                    :is-peer-mock-host="session.isHostPeer(peerId)"
                    :swap-selected="session.swapSelectionPeerId.value === peerId"
                    :speaking-draft="
                      session.speakingDraftSeat.value != null &&
                      session.entryFor(peerId)?.seat === session.speakingDraftSeat.value
                    "
                    :speaking-target="
                      session.entryFor(peerId)?.seat != null &&
                      session.speakingTargetSeatSet.value.has(session.entryFor(peerId)!.seat!)
                    "
                    :kicked="session.entryFor(peerId)?.kicked ?? false"
                    :muted="session.entryFor(peerId)?.muted ?? false"
                    @toggle-life="session.toggleLifeFor"
                    @kick="session.kickPeer"
                    @tile-click="session.handleTileClick"
                  />
                </template>
              </GameCallVideoGrid>

              <!-- Production-style bottom cluster + dock. -->
              <div class="call-page__bottom-cluster">
                <div class="call-page__bottom-cluster__left">
                  <!--
                    Speaking-queue HUD (shared with production Mafia via
                    <GameSpeakingQueueBar>). The bar v-if's itself when
                    there is no content + read-only viewer.
                  -->
                  <GameSpeakingQueueBar
                    :segments="session.speakingSegments.value"
                    :speaking-active="session.interactionMode.value === 'speaking'"
                    :show-tools="session.isLocalUserHost.value"
                    :labels="speakingQueueLabels"
                    @toggle-speaking-mode="onToggleSpeakingMode"
                    @remove-pair="session.removeSpeakingPairAt"
                    @clear-all="session.clearSpeakingQueue"
                  />
                </div>
                <div class="call-page__bottom-cluster__center call-page__bottom-cluster__center--speak-dock">
                  <!--
                    Host-only action bar (shared with production Mafia via
                    <GameHostActionsBar>). Mute-all / reshuffle / swap.
                  -->
                  <GameHostActionsBar
                    v-if="session.isLocalUserHost.value"
                    :mute-all-active="session.muteAllVisualActive.value"
                    :can-reshuffle="canReshuffle"
                    :swap-active="session.interactionMode.value === 'swap'"
                    :labels="hostActionsLabels"
                    @set-mute-all="onSetMuteAll"
                    @reshuffle="session.reshuffleSeats"
                    @toggle-swap-mode="onToggleSwapMode"
                  />
                  <CallControlsDock
                    v-model:mic-picker-open="micPickerOpen"
                    v-model:cam-picker-open="camPickerOpen"
                    v-model:speaker-picker-open="speakerPickerOpen"
                    v-model:chat-open="chatOpen"
                    :joining="ctx.joining.value"
                    :mic-enabled="ctx.micEnabled.value"
                    :cam-enabled="ctx.camEnabled.value"
                    :call-deafened="ctx.callDeafened.value"
                    :hand-raised="ctx.handRaised.value"
                    :screen-sharing="ctx.screenSharing.value"
                    :show-media-device-pickers="true"
                    :audio-input-devices="ctx.audioInputDevices.value"
                    :video-input-devices="ctx.videoInputDevices.value"
                    :audio-output-devices="ctx.audioOutputDevices.value"
                    :local-audio-input-device-id="ctx.localAudioInputDeviceId.value"
                    :local-video-input-device-id="ctx.localVideoInputDeviceId.value"
                    :local-audio-output-device-id="audioOutputDeviceId"
                    @toggle-mic="ctx.toggleMic"
                    @toggle-cam="ctx.toggleCam"
                    @toggle-deafen="ctx.toggleCallDeafen"
                    @toggle-raise-hand="ctx.toggleRaiseHand"
                    @toggle-screen-share="ctx.toggleScreenShare"
                    @leave="ctx.leaveCall"
                    @pick-audio-input="(id) => { void ctx.setCallAudioInputDevice(id); micPickerOpen = false }"
                    @pick-video-input="(id) => { void ctx.setCallVideoInputDevice(id); camPickerOpen = false }"
                    @pick-audio-output="(id) => { audioOutputDeviceId = id; speakerPickerOpen = false }"
                  />
                </div>
              </div>

              <!--
                Local-fallback diagnostic panel (collapsed by default).
                Affordances here are admin-only debug helpers — they let an
                admin probe the page without a real cross-tab session.
                They will shrink/disappear when the server-backed adapter
                replaces the local one.
              -->
              <div
                class="game-template-page__mock-panel"
                :class="{ 'game-template-page__mock-panel--open': controlsPanelOpen }"
                role="region"
                aria-label="Game Template local-fallback controls"
              >
                <button
                  type="button"
                  class="game-template-page__mock-toggle"
                  :aria-expanded="controlsPanelOpen"
                  :title="controlsPanelOpen ? 'Hide local-fallback controls' : 'Show local-fallback controls'"
                  @click="toggleControlsPanel"
                >
                  <span aria-hidden="true">🛠</span>
                  <span>{{
                    controlsPanelOpen ? 'Hide controls' : 'Local fallback controls'
                  }}</span>
                </button>

                <div v-if="controlsPanelOpen" class="game-template-page__mock-body">
                  <label class="game-template-page__mock-row">
                    <span class="game-template-page__mock-label">Room</span>
                    <input
                      v-model.trim="roomBaseInput"
                      class="game-template-page__mock-input"
                      type="text"
                      :placeholder="defaultRoomBase"
                      spellcheck="false"
                      autocomplete="off"
                    />
                  </label>

                  <div class="game-template-page__mock-row">
                    <span class="game-template-page__mock-label">Host</span>
                    <button
                      v-if="session.isLocalUserHost.value"
                      type="button"
                      class="game-template-page__mock-btn game-template-page__mock-btn--wide"
                      title="Release host (other peers can then claim it)"
                      @click="session.releaseHost"
                    >
                      Release host
                    </button>
                    <button
                      v-else-if="canClaimHost"
                      type="button"
                      class="game-template-page__mock-btn game-template-page__mock-btn--wide"
                      title="Claim host"
                      @click="session.claimHost"
                    >
                      Claim host
                    </button>
                    <span v-else class="game-template-page__mock-note">
                      Host is held by another peer.
                    </span>
                  </div>

                  <p class="game-template-page__mock-note">
                    Per-tile Role / Life buttons below are diagnostic only;
                    they tweak the local-fallback overlay so an admin can
                    eyeball the host/player view without a second tab.
                  </p>

                  <ul
                    v-if="tiles.length > 0"
                    class="game-template-page__mock-tiles"
                  >
                    <li
                      v-for="t in tiles"
                      :key="t.peerId"
                      class="game-template-page__mock-tile"
                    >
                      <span class="game-template-page__mock-peer">
                        <span v-if="session.isHostPeer(t.peerId)" class="game-template-page__mock-host-badge">H</span>
                        <span v-else-if="session.entryFor(t.peerId)?.seat != null">#{{ session.entryFor(t.peerId)?.seat }}</span>
                        {{ t.peerId.slice(0, 8) }}{{ t.isLocal ? ' (me)' : '' }}
                      </span>
                      <button
                        type="button"
                        class="game-template-page__mock-btn"
                        title="Rotate the placeholder role on this peer"
                        @click="session.rotateRoleFor(t.peerId)"
                      >
                        Role
                      </button>
                      <button
                        type="button"
                        class="game-template-page__mock-btn"
                        title="Toggle life (kill / revive)"
                        @click="session.toggleLifeFor(t.peerId)"
                      >
                        Life
                      </button>
                    </li>
                  </ul>
                  <p v-else class="game-template-page__mock-note">
                    Per-tile controls appear once you (or a second admin tab)
                    join the room.
                  </p>
                </div>
              </div>
            </template>
          </GameCallShell>
        </section>
      </div>
    </AppContainer>
  </div>
</template>

<style scoped>
.game-template-page {
  position: relative;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
}

/*
 * Absolute frame that mirrors `<MafiaOverlay>`'s `.mafia-overlay` wrapper
 * (`inset: 0; z-index: 42`). The shared `<GameTimerOverlay>` chip is
 * `position: absolute` and centers itself horizontally inside this frame.
 */
.game-template-page__timer-frame {
  position: absolute;
  inset: 0;
  z-index: 42;
  pointer-events: none;
}

/* ---- Local-fallback banner (top-center under the timer) ---- */

.game-template-page__fallback-banner {
  position: absolute;
  top: calc(max(0px, env(safe-area-inset-top, 0px)) + 60px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 41;
  max-width: min(560px, calc(100vw - 32px));
  padding: 8px 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 200, 60, 0.5);
  background: rgba(60, 36, 99, 0.85);
  color: #fef3c7;
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
  pointer-events: none;
  user-select: none;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.game-template-page__fallback-banner strong {
  color: #ffd455;
  font-weight: 700;
}

/* ---- Claim-host CTA (centered, visible when no host is claimed) ---- */

.game-template-page__claim-host {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 41;
  pointer-events: none;
}

.game-template-page__claim-host-btn {
  pointer-events: auto;
  padding: 10px 22px;
  border-radius: 999px;
  border: 1px solid rgba(255, 215, 0, 0.6);
  background: rgba(60, 36, 99, 0.85);
  color: #ffd455;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.5px;
  cursor: pointer;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.4);
  transition: transform 0.16s ease, background 0.16s ease;
}

.game-template-page__claim-host-btn:hover {
  background: rgba(80, 50, 120, 0.95);
  transform: translateY(-1px);
}

/* ---- LAB chip (top-left of stage, absolute, unobtrusive) ---- */

.game-template-page__lab-chip {
  position: absolute;
  top: 12px;
  left: 16px;
  z-index: 30;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.6);
  color: #f4f4f8;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.4px;
  pointer-events: none;
  user-select: none;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.game-template-page__lab-chip-pill {
  padding: 1px 6px;
  border-radius: 6px;
  background: #4a3274;
  color: #ffd455;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
}

.game-template-page__lab-chip-room {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  opacity: 0.85;
}

/* ---- Floating mock-controls panel (bottom-right, collapsed by default) ---- */

.game-template-page__mock-panel {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 60;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  max-width: 320px;
  font-size: 12px;
  color: #f4f4f8;
  pointer-events: none;
}

.game-template-page__mock-panel > * {
  pointer-events: auto;
}

.game-template-page__mock-toggle {
  align-self: flex-end;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.7);
  color: #f4f4f8;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.3px;
  cursor: pointer;
  user-select: none;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.game-template-page__mock-toggle:hover {
  background: rgba(0, 0, 0, 0.85);
  border-color: rgba(255, 255, 255, 0.22);
}

.game-template-page__mock-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(15, 17, 24, 0.9);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  max-height: min(60vh, 480px);
  overflow: auto;
}

.game-template-page__mock-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.game-template-page__mock-label {
  flex: 0 0 auto;
  min-width: 36px;
  font-size: 11px;
  opacity: 0.75;
}

.game-template-page__mock-input {
  flex: 1 1 auto;
  min-width: 0;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  font-family: inherit;
  font-size: 12px;
}

.game-template-page__mock-note {
  margin: 0;
  font-size: 11px;
  line-height: 1.35;
  opacity: 0.7;
}

.game-template-page__mock-tiles {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.game-template-page__mock-tile {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  align-items: center;
  gap: 4px;
}

.game-template-page__mock-peer {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  opacity: 0.85;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.game-template-page__mock-host-badge {
  display: inline-block;
  padding: 0 4px;
  border-radius: 4px;
  background: rgba(255, 215, 0, 0.85);
  color: #1a1a22;
  font-family: inherit;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.game-template-page__mock-btn {
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 10px;
  cursor: pointer;
  white-space: nowrap;
}

.game-template-page__mock-btn:hover {
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.22);
}

.game-template-page__mock-btn--wide {
  flex: 1 1 auto;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
}
</style>
