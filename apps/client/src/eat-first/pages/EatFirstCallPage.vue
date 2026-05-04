<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import CallPage from '@/components/call/CallPage.vue'
import { useEatFirstCallStreamView } from '@/composables/eatFirstCallStreamView'
import { useAuth } from '@/composables/useAuth'
import EatFirstHostPanel from '@/eat-first/components/EatFirstHostPanel.vue'
import EatFirstStatusOverlay from '@/eat-first/components/EatFirstStatusOverlay.vue'
import { useEatFirstCallGameSnapshot } from '@/eat-first/composables/useEatFirstCallGameSnapshot'
import { normalizeDisplayName } from 'call-core'
import { efEnsureGame } from '@/eat-first/services/eatFirstTransport'
import { setPersistedGameId } from '@/eat-first/utils/persistedGameId.js'
import { createLogger } from '@/utils/logger'

const log = createLogger('eat-first:call-page')

const route = useRoute()
const { t } = useI18n()
const auth = useAuth()
const { isStreamView } = useEatFirstCallStreamView()

const gameId = computed(() => {
  const g = route.query.game
  return typeof g === 'string' ? normalizeDisplayName(g) : ''
})

const { ownerUserId, gamePhase, speakingTimer, loading: snapshotLoading } = useEatFirstCallGameSnapshot(gameId)

watch(
  () => gameId.value,
  (gid) => {
    if (!gid) {
      return
    }
    setPersistedGameId(gid)
    void efEnsureGame(gid).catch((e) => {
      log.warn('ensure game failed', e)
    })
  },
  { immediate: true },
)

const prismaId = computed(() => {
  const u = auth.user.value
  if (!u) return ''
  const db = typeof u.dbUserId === 'string' && u.dbUserId.trim().length > 0 ? u.dbUserId.trim() : ''
  if (db) return db
  return typeof u.id === 'string' ? u.id.trim() : ''
})

const isRoomOwner = computed(
  () => Boolean(ownerUserId.value && prismaId.value && ownerUserId.value === prismaId.value),
)

const showHostPanel = computed(
  () => !isStreamView.value && (auth.canEatFirstHost.value === true || isRoomOwner.value),
)

const roleBadgeKey = computed(() => {
  if (isStreamView.value) return 'eatFirstCall.obsBadge'
  if (showHostPanel.value) return 'eatFirstCall.hostBadge'
  return 'eatFirstCall.playerBadge'
})

const timerDisplay = computed(() => {
  const v = speakingTimer.value
  if (v == null) return t('eatFirstCall.timerPlaceholder')
  return String(v)
})
</script>

<template>
  <div class="eat-first-call-page" data-eat-first-call="1">
    <div class="eat-first-call-page__call">
      <CallPage :eat-first-stream-view="isStreamView" />
    </div>
    <EatFirstStatusOverlay
      class="eat-first-call-page__status"
      :game-id="gameId"
      :role-badge-key="roleBadgeKey"
      :game-phase="gamePhase"
      :timer-display="timerDisplay"
      :loading="snapshotLoading"
    />
    <EatFirstHostPanel v-if="showHostPanel" class="eat-first-call-page__host" :game-id="gameId" />
  </div>
</template>

<style scoped>
.eat-first-call-page {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
}

.eat-first-call-page__call {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
