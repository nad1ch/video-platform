<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted } from 'vue'
import type { Component } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const route = useRoute()

onMounted(() => {
  void useAuth().refresh()
})

const SignalingDebugPanel: Component | null = import.meta.env.DEV
  ? defineAsyncComponent(() => import('./dev/SignalingDebugPanel.vue'))
  : null

const showSignalingDebug = computed(() => import.meta.env.DEV && route.path === '/call')
</script>

<template>
  <div class="app-root">
    <RouterView />
    <details v-if="SignalingDebugPanel && showSignalingDebug" class="app-root__debug">
      <summary>Signaling debug</summary>
      <div class="app-root__debug-body">
        <component :is="SignalingDebugPanel" />
      </div>
    </details>
  </div>
</template>

<style scoped>
.app-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: var(--font-body, var(--sa-font-main, var(--sans)));
}

.app-root__debug {
  margin: 0 1rem 2rem;
  font-size: 0.85rem;
}

.app-root__debug-body {
  margin-top: 0.5rem;
}
</style>
