<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import type { Component } from 'vue'
import { RouterView, useRoute } from 'vue-router'

const route = useRoute()

const SignalingDebugPanel: Component | null = import.meta.env.DEV
  ? defineAsyncComponent(() => import('./dev/SignalingDebugPanel.vue'))
  : null

const showSignalingDebug = computed(() => import.meta.env.DEV && route.path === '/')
</script>

<template>
  <div class="app-shell">
    <RouterView />
    <details v-if="SignalingDebugPanel && showSignalingDebug" class="app-shell__debug">
      <summary>Signaling debug</summary>
      <div class="app-shell__debug-body">
        <component :is="SignalingDebugPanel" />
      </div>
    </details>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
}

.app-shell__debug {
  margin: 0 1rem 2rem;
  font-size: 0.85rem;
}

.app-shell__debug-body {
  margin-top: 0.5rem;
}
</style>
