<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import CallPage from '@/components/call/CallPage.vue'
import MafiaHostPanel from '@/components/mafia/MafiaHostPanel.vue'
import MafiaOverlay from '@/components/mafia/MafiaOverlay.vue'
import { useMafiaViewMode } from '@/composables/mafiaStreamViewRoute'
import { useMafiaGameStore } from '@/stores/mafiaGame'

/**
 * `?mode=view` — stream / OBS layout (grid + timer + labels only).
 * Omitted or any other `mode` — host mode (default).
 */
const { isViewMode } = useMafiaViewMode()
const mafiaGame = useMafiaGameStore()
const { isMafiaHost } = storeToRefs(mafiaGame)
const showHostTools = computed(() => !isViewMode.value && isMafiaHost.value)
</script>

<template>
  <div
    class="mafia-page"
    :class="{
      'mafia-page--view-mode': isViewMode,
      'mafia-page--stream-view': isViewMode,
    }"
  >
    <CallPage :mafia-stream-view="isViewMode" />
    <MafiaHostPanel v-if="showHostTools" />
    <MafiaOverlay :view-mode="isViewMode" />
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
</style>
