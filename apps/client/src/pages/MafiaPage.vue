<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useCallSessionStore } from 'call-core'
import CallPage from '@/components/call/CallPage.vue'
import MafiaCallAdapter from '@/components/mafia/adapters/MafiaCallAdapter.vue'
import MafiaHostPanel from '@/components/mafia/MafiaHostPanel.vue'
import MafiaOverlay from '@/components/mafia/MafiaOverlay.vue'
import { useMafiaViewMode } from '@/composables/mafiaStreamViewRoute'
import { useMafiaGameStore } from '@/stores/mafiaGame'
import { useAuth } from '@/composables/useAuth'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { isViewMode } = useMafiaViewMode()
const mafiaGame = useMafiaGameStore()
const { isMafiaHost, oldMafiaMode } = storeToRefs(mafiaGame)
const showHostTools = computed(() => !isViewMode.value && isMafiaHost.value)
const showMafiaOverlay = computed(() => !oldMafiaMode.value || isMafiaHost.value)

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
    class="mafia-page"
    :class="{
      'mafia-page--view-mode': isViewMode,
      'mafia-page--stream-view': isViewMode,
    }"
  >
    <div
      v-if="showSignalingSessionWarning"
      class="mafia-page__signaling-warning"
      role="alert"
    >
      {{ t('mafiaPage.signalingSessionMissing') }}
    </div>
    <CallPage :mafia-stream-view="isViewMode" />
    <MafiaCallAdapter />
    <MafiaHostPanel v-if="showHostTools" />
    <MafiaOverlay v-if="showMafiaOverlay" :view-mode="isViewMode" />
  </div>
</template>

<style scoped>
.mafia-page {
  position: relative;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
  max-height: 100%;
  overflow: hidden;
}

.mafia-page__signaling-warning {
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
  .mafia-page :deep(.call-page__tile-wrap:hover:not(.call-page__tile-wrap--pinned)) {
    z-index: 50;
  }
}
</style>
