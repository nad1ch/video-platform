<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import type { Component } from 'vue'
import HelloWorld from './components/HelloWorld.vue'

const SignalingDebugPanel: Component | null = import.meta.env.DEV
  ? defineAsyncComponent(() => import('./dev/SignalingDebugPanel.vue'))
  : null
</script>

<template>
  <component :is="SignalingDebugPanel" v-if="SignalingDebugPanel" />
  <HelloWorld />
</template>
