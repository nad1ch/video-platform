<script setup lang="ts">
/**
 * GameTemplatePage — route component for `/app/game-template`.
 *
 * Fork of `pages/MafiaPage.vue` with the same layout and behaviour but a
 * fully separate component tree:
 *
 *   - mounts `<GameTemplateCallPage>` (fork of `<CallPage>`)
 *   - mounts `<GameTemplateCallAdapter>` (fork of `<MafiaCallAdapter>`)
 *   - mounts `<GameTemplateHostPanel>` (fork of `<MafiaHostPanel>`) for hosts
 *   - mounts `<GameTemplateOverlay>` (fork of `<MafiaOverlay>`)
 *
 * The Mafia store (`useMafiaGameStore`), the `useMafiaViewMode` route helper,
 * and the call-core `useCallSessionStore` are reused on purpose — the
 * initial fork keeps the existing WS protocol / signaling room prefix so
 * the production backend continues to work end-to-end. A future server-
 * side step can introduce a generic `gameroom:` namespace.
 *
 * Class names rename from `mafia-page*` to `game-template-page*` so this
 * page's scoped CSS cannot collide with `MafiaPage.vue` once either side
 * starts diverging visually.
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useCallSessionStore } from 'call-core'
import GameTemplateCallPage from '@/components/game-template/GameTemplateCallPage.vue'
import GameTemplateCallAdapter from '@/components/game-template/GameTemplateCallAdapter.vue'
import GameTemplateHostPanel from '@/components/game-template/GameTemplateHostPanel.vue'
import GameTemplateOverlay from '@/components/game-template/GameTemplateOverlay.vue'
import { useMafiaViewMode } from '@/composables/mafiaStreamViewRoute'
import { useMafiaGameStore } from '@/stores/mafiaGame'
import { useAuth } from '@/composables/useAuth'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { isViewMode } = useMafiaViewMode()
const gameStore = useMafiaGameStore()
const { isMafiaHost, oldMafiaMode } = storeToRefs(gameStore)
const showHostTools = computed(() => !isViewMode.value && isMafiaHost.value)
const showGameOverlay = computed(() => !oldMafiaMode.value || isMafiaHost.value)

const { user } = useAuth()
const callSession = useCallSessionStore()
const { inCall, signalingAuthUserId } = storeToRefs(callSession)

const showSignalingSessionWarning = computed(
  () =>
    !isViewMode.value &&
    inCall.value &&
    user.value != null &&
    signalingAuthUserId.value === null &&
    !isMafiaHost.value,
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
    <GameTemplateCallPage :mafia-stream-view="isViewMode" />
    <GameTemplateCallAdapter />
    <GameTemplateHostPanel v-if="showHostTools" />
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
