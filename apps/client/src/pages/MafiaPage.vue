<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useCallSessionStore } from 'call-core'
import CallPage from '@/components/call/CallPage.vue'
import GameRoomPageShell from '@/components/game-room/GameRoomPageShell.vue'
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
  <GameRoomPageShell
    route-class="mafia-page"
    :is-view-mode="isViewMode"
    :signaling-warning-visible="showSignalingSessionWarning"
    :signaling-warning-text="t('mafiaPage.signalingSessionMissing')"
  >
    <template #stage>
      <CallPage :mafia-stream-view="isViewMode" />
    </template>
    <template #adapters>
      <MafiaCallAdapter />
    </template>
    <template #host-panel>
      <MafiaHostPanel v-if="showHostTools" />
    </template>
    <template #overlays>
      <MafiaOverlay v-if="showMafiaOverlay" :view-mode="isViewMode" />
    </template>
  </GameRoomPageShell>
</template>
