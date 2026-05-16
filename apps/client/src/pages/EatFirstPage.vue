<script setup lang="ts">
import { onMounted } from 'vue'
import '@/eat-first/styles/motion.css'
import { bootstrapEatFirstAuthOnce } from '@/eat-first/bootstrapEatFirst'
import EatFirstCallPage from '@/eat-first/pages/EatFirstCallPage.vue'

onMounted(() => {
  void bootstrapEatFirstAuthOnce()
})
</script>

<template>
  <div class="eat-first-inner">
    <div class="eat-first-route-stack">
      <EatFirstCallPage />
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
</style>
