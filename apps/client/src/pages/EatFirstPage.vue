<script setup lang="ts">
import { computed, defineAsyncComponent, defineComponent, h, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import '@/eat-first/styles/motion.css'
import { bootstrapEatFirstAuthOnce } from '@/eat-first/bootstrapEatFirst'
import { adminControlTransitionInstant } from '@/eat-first/router.js'
import { eatViewFromRoute } from '@/eat-first'
import { getPersistedGameId } from '@/eat-first/utils/persistedGameId.js'
import JoinPage from '@/eat-first/pages/JoinPage.vue'

const EatPanelLoading = defineComponent({
  name: 'EatPanelLoading',
  setup() {
    return () =>
      h(
        'div',
        {
          class: 'eat-first-panel-loading',
          role: 'status',
          'aria-label': 'Loading',
        },
        [
          h('div', { class: 'eat-first-panel-loading__card' }, [
            h('span', { class: 'eat-first-panel-loading__glow' }),
            h('span', { class: 'eat-first-panel-loading__line eat-first-panel-loading__line--wide' }),
            h('span', { class: 'eat-first-panel-loading__line' }),
            h('span', { class: 'eat-first-panel-loading__line eat-first-panel-loading__line--short' }),
          ]),
        ],
      )
  },
})

const AdminPanel = defineAsyncComponent({
  loader: () => import('@/eat-first/pages/AdminGatePage.vue'),
  loadingComponent: EatPanelLoading,
  delay: 100,
  timeout: 10000,
})
const ControlPanel = defineAsyncComponent({
  loader: () => import('@/eat-first/pages/ControlPage.vue'),
  loadingComponent: EatPanelLoading,
  delay: 100,
  timeout: 10000,
})
const OverlayPanel = defineAsyncComponent({
  loader: () => import('@/eat-first/pages/OverlayPage.vue'),
  loadingComponent: EatPanelLoading,
  delay: 100,
  timeout: 10000,
})

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

.eat-first-panel-loading {
  flex: 1 1 auto;
  min-height: min(32rem, 70vh);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(1rem, 3vw, 2rem);
  box-sizing: border-box;
}

.eat-first-panel-loading__card {
  position: relative;
  width: min(100%, 34rem);
  min-height: 12rem;
  overflow: hidden;
  border-radius: 1.25rem;
  border: 1px solid color-mix(in srgb, var(--sa-color-primary, #a78bfa) 22%, transparent);
  background:
    linear-gradient(135deg, rgb(255 255 255 / 0.08), transparent 44%),
    color-mix(in srgb, var(--sa-color-surface, #161320) 78%, transparent);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.12),
    0 18px 42px rgb(5 3 14 / 0.34);
  padding: 1.4rem;
  display: grid;
  align-content: center;
  gap: 0.75rem;
}

.eat-first-panel-loading__glow {
  position: absolute;
  inset: -40% auto auto -10%;
  width: 18rem;
  height: 18rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--sa-color-primary, #a78bfa) 24%, transparent);
  filter: blur(28px);
  transform: translateZ(0);
}

.eat-first-panel-loading__line {
  position: relative;
  z-index: 1;
  display: block;
  width: 72%;
  height: 0.8rem;
  border-radius: 999px;
  background: linear-gradient(90deg, rgb(255 255 255 / 0.1), rgb(255 255 255 / 0.28), rgb(255 255 255 / 0.1));
  background-size: 220% 100%;
  animation: eatFirstPanelLoadingShimmer 1.25s ease-in-out infinite;
}

.eat-first-panel-loading__line--wide {
  width: 92%;
}

.eat-first-panel-loading__line--short {
  width: 48%;
}

@keyframes eatFirstPanelLoadingShimmer {
  0% {
    background-position: 120% 0;
  }
  100% {
    background-position: -120% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .eat-first-panel-loading__line {
    animation: none;
  }
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
