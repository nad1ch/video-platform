<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import '@/eat-first/styles/motion.css'
import { bootstrapEatFirstAuthOnce } from '@/eat-first/bootstrapEatFirst'
import { adminControlTransitionInstant } from '@/eat-first/router.js'
import { eatViewFromRoute } from '@/eat-first'
import { getPersistedGameId } from '@/eat-first/utils/persistedGameId.js'
import JoinPage from '@/eat-first/pages/JoinPage.vue'

const AdminPanel = defineAsyncComponent(() => import('@/eat-first/pages/AdminGatePage.vue'))
const ControlPanel = defineAsyncComponent(() => import('@/eat-first/pages/ControlPage.vue'))
const OverlayPanel = defineAsyncComponent(() => import('@/eat-first/pages/OverlayPage.vue'))

const panelByView = {
  join: JoinPage,
  admin: AdminPanel,
  control: ControlPanel,
  overlay: OverlayPanel,
} as const

const route = useRoute()

const currentView = computed(() => eatViewFromRoute(route))

const currentPanel = computed(() => {
  const v = currentView.value
  return panelByView[v] ?? JoinPage
})

/**
 * Стабільний ключ для join: той самий ефективний game id, що й у JoinPage (query.game || persisted || test1).
 * Інакше JoinPage робить router.replace(?game=…) після mount → fullPath змінюється → ключ змінюється →
 * повний remount + out-in анімація («миготіння»).
 */
function joinPanelStableKey(): string {
  const raw = route.query.game
  const fromQuery = raw != null && String(raw).trim() ? String(raw).trim() : ''
  if (fromQuery) {
    return fromQuery
  }
  const persisted = getPersistedGameId()
  if (persisted != null && String(persisted).trim()) {
    return String(persisted).trim()
  }
  return 'test1'
}

/** Не включаємо `player` у ключ: інакше кожна зміна слота в URL повністю перемонтовує ControlPage. */
const routeViewKey = computed(() => {
  if (currentView.value === 'control') {
    const q = route.query
    return ['control', String(q.game ?? ''), String(q.host ?? '')].join('|')
  }
  if (currentView.value === 'join') {
    return `join|${joinPanelStableKey()}`
  }
  return route.fullPath
})

const routeTransition = computed(() => {
  if (currentView.value === 'overlay') return 'route-fade'
  if (adminControlTransitionInstant.value) return 'route-none'
  /* Той самий fade, що й у AppShellLayout (`route-soft`) — без окремого «з’їзду» знизу. */
  return 'route-soft'
})

onMounted(() => {
  void bootstrapEatFirstAuthOnce()
})
</script>

<template>
  <div class="eat-first-inner">
    <div class="eat-first-route-stack">
      <Transition :name="routeTransition">
        <component :is="currentPanel" :key="routeViewKey" />
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.eat-first-inner {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
}

.eat-first-route-stack {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.eat-first-route-stack :deep(.route-soft-enter-active),
.eat-first-route-stack :deep(.route-fade-enter-active) {
  position: relative;
  z-index: 0;
}

.eat-first-route-stack :deep(.route-soft-leave-active),
.eat-first-route-stack :deep(.route-fade-leave-active) {
  position: absolute;
  inset: 0;
  width: 100%;
  z-index: 2;
  pointer-events: none;
}
</style>
