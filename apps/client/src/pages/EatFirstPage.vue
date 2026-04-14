<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import '@/eat-first/styles/motion.css'
import { bootstrapEatFirstAuthOnce } from '@/eat-first/bootstrapEatFirst'
import { adminControlTransitionInstant } from '@/eat-first/router.js'
import { useSeoCanonical } from '@/eat-first/composables/useSeoCanonical.js'
import { eatViewFromRoute } from '@/eat-first/eatFirstRouteUtils.js'

const JoinPanel = defineAsyncComponent(() => import('@/eat-first/pages/JoinPage.vue'))
const AdminPanel = defineAsyncComponent(() => import('@/eat-first/pages/AdminGatePage.vue'))
const ControlPanel = defineAsyncComponent(() => import('@/eat-first/pages/ControlPage.vue'))
const OverlayPanel = defineAsyncComponent(() => import('@/eat-first/pages/OverlayPage.vue'))

const panelByView = {
  join: JoinPanel,
  admin: AdminPanel,
  control: ControlPanel,
  overlay: OverlayPanel,
} as const

useSeoCanonical()

const route = useRoute()

const currentView = computed(() => eatViewFromRoute(route))

const currentPanel = computed(() => {
  const v = currentView.value
  return panelByView[v] ?? JoinPanel
})

/** Не включаємо `player` у ключ: інакше кожна зміна слота в URL повністю перемонтовує ControlPage. */
const routeViewKey = computed(() => {
  if (currentView.value === 'control') {
    const q = route.query
    return ['control', String(q.game ?? ''), String(q.host ?? '')].join('|')
  }
  return route.fullPath
})

const routeTransition = computed(() => {
  if (currentView.value === 'overlay') return 'route-fade'
  if (adminControlTransitionInstant.value) return 'route-none'
  return 'route-slide'
})

onMounted(() => {
  void bootstrapEatFirstAuthOnce()
})
</script>

<template>
  <div class="eat-first-inner">
    <Transition :name="routeTransition" mode="out-in">
      <component :is="currentPanel" :key="routeViewKey" />
    </Transition>
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
</style>
