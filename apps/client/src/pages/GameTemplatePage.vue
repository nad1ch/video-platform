<script setup lang="ts">
/**
 * GameTemplatePage — route component for `/app/game-template`.
 *
 * Runs on the generic GameRoom client layer end-to-end:
 *   - `<GameTemplateCallPage>` — fork of CallPage wired to
 *     `gameroom:*` WS, `useGameRoomHostSignaling`,
 *     `useGameRoomAudioMixSignaling`, `useGameRoomCallHostUi`, and
 *     `useGameTemplateGameStore` / `useGameTemplatePlayersStore`.
 *   - `<GameTemplateCallAdapter>` — speaking-hint state via
 *     `useGameRoomSpeakingHint`.
 *   - `<GameTemplateOverlay>` — timer chip via the generic store.
 *
 * Intentionally NOT mounted: a host panel. The Mafia host panel was a
 * role + night-action grid; the generic protocol has no roles or night
 * actions. Host actions (mute-all, reshuffle, swap-mode toggle) and the
 * speaking-queue HUD live in the CallPage fork's bottom-cluster.
 *
 * View-mode detection is `useGameRoomViewMode`, gated on
 * `route.name === 'game-template'`.
 *
 * Layout / signaling-warning banner / hover-elevation `:deep()` rule
 * are owned by `<GameRoomPageShell>`, shared with `/app/mafia`.
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useCallSessionStore } from 'call-core'
import GameRoomPageShell from '@/components/game-room/GameRoomPageShell.vue'
import GameTemplateCallPage from '@/components/game-template/GameTemplateCallPage.vue'
import GameTemplateCallAdapter from '@/components/game-template/GameTemplateCallAdapter.vue'
import GameTemplateOverlay from '@/components/game-template/GameTemplateOverlay.vue'
import { useGameRoomViewMode } from '@/composables/gameRoomStreamViewRoute'
import { useGameTemplateGameStore } from '@/stores/gameTemplateGame'
import { useAuth } from '@/composables/useAuth'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { isViewMode } = useGameRoomViewMode()
const gameStore = useGameTemplateGameStore()
const { isGameRoomHost } = storeToRefs(gameStore)
/**
 * Generic timer overlay is always visible — there's no old/new Mafia
 * mode equivalent to gate it on. View-mode tabs still see the chip.
 */
const showGameOverlay = computed(() => true)

const { user } = useAuth()
const callSession = useCallSessionStore()
const { inCall, signalingAuthUserId } = storeToRefs(callSession)

const showSignalingSessionWarning = computed(
  () =>
    !isViewMode.value &&
    inCall.value &&
    user.value != null &&
    signalingAuthUserId.value === null &&
    !isGameRoomHost.value,
)
</script>

<template>
  <GameRoomPageShell
    route-class="game-template-page"
    :is-view-mode="isViewMode"
    :signaling-warning-visible="showSignalingSessionWarning"
    :signaling-warning-text="t('mafiaPage.signalingSessionMissing')"
  >
    <template #stage>
      <GameTemplateCallPage :game-room-stream-view="isViewMode" />
    </template>
    <template #adapters>
      <GameTemplateCallAdapter />
    </template>
    <template #overlays>
      <GameTemplateOverlay v-if="showGameOverlay" :view-mode="isViewMode" />
    </template>
  </GameRoomPageShell>
</template>
