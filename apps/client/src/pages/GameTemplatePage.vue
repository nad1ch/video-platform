<script setup lang="ts">
/**
 * GameTemplatePage — route component for `/app/game-template`.
 *
 * Phase 3C: switched off the Mafia client stack. Now uses the generic
 * GameRoom client layer end-to-end:
 *   - `<GameTemplateCallPage>` (fork of CallPage, wired to GameRoomWs)
 *   - `<GameTemplateCallAdapter>` (speaking-hint via `useGameRoomSpeakingHint`)
 *   - `<GameTemplateOverlay>` (timer via `useGameTemplateGameStore`)
 *
 * The Mafia-only `<GameTemplateHostPanel>` (role + night-action grid) was
 * REMOVED in Phase 3C — the generic protocol has no roles or night
 * actions. Host actions (mute-all, reshuffle, swap-mode toggle) and the
 * speaking-queue HUD continue to mount from the CallPage fork's
 * bottom-cluster, unchanged.
 *
 * View-mode detection is now `useGameRoomViewMode` (route name
 * `'game-template'`); the previous Phase 2 widening of
 * `mafiaStreamViewRoute` was reverted in this PR.
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useCallSessionStore } from 'call-core'
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
  <div
    class="game-template-page"
    :class="{
      'game-template-page--view-mode': isViewMode,
      'game-template-page--stream-view': isViewMode,
    }"
  >
    <div
      v-if="showSignalingSessionWarning"
      class="game-template-page__signaling-warning"
      role="alert"
    >
      {{ t('mafiaPage.signalingSessionMissing') }}
    </div>
    <GameTemplateCallPage :game-room-stream-view="isViewMode" />
    <GameTemplateCallAdapter />
    <GameTemplateOverlay v-if="showGameOverlay" :view-mode="isViewMode" />
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
  max-height: 100%;
  overflow: hidden;
}

.game-template-page__signaling-warning {
  flex: 0 0 auto;
  margin: 0 12px 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(180, 60, 60, 0.2);
  border: 1px solid rgba(255, 120, 120, 0.45);
  color: #fbeaea;
  font-size: 0.9rem;
  line-height: 1.35;
}

@media (hover: hover) {
  .game-template-page :deep(.call-page__tile-wrap:hover:not(.call-page__tile-wrap--pinned)) {
    z-index: 50;
  }
}
</style>
