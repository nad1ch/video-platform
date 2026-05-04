<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import CallPage from '@/components/call/CallPage.vue'
import { useEatFirstCallStreamView } from '@/composables/eatFirstCallStreamView'
import { normalizeDisplayName } from 'call-core'
import { efEnsureGame } from '@/eat-first/services/eatFirstTransport'
import { setPersistedGameId } from '@/eat-first/utils/persistedGameId.js'

const route = useRoute()
const { isStreamView } = useEatFirstCallStreamView()

watch(
  () => {
    const g = route.query.game
    return typeof g === 'string' ? normalizeDisplayName(g) : ''
  },
  (gameId) => {
    if (!gameId) {
      return
    }
    setPersistedGameId(gameId)
    void efEnsureGame(gameId).catch(() => {
      /* non-blocking: room may appear after CallPage sets `game` in the URL */
    })
  },
  { immediate: true },
)
</script>

<template>
  <div class="eat-first-call-page" data-eat-first-call="1">
    <!-- Host panel and per-tile Eat First chrome attach here in a follow-up PR. -->
    <CallPage :eat-first-stream-view="isStreamView" />
  </div>
</template>

<style scoped>
.eat-first-call-page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
}
</style>
