<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppFullPageLoader from '@/components/ui/AppFullPageLoader.vue'
import { useAuth } from '@/composables/useAuth'
import { routeNavLoadingDepth } from '@/routeNavLoading'
import '@/eat-first/styles/motion.css'

const { t } = useI18n()
const routeLoading = computed(() => routeNavLoadingDepth.value > 0)

onMounted(() => {
  void useAuth().refresh()
})
</script>

<template>
  <div class="app-root">
    <AppFullPageLoader :visible="routeLoading" :aria-label="t('app.routeLoadingAria')" label="" />
    <RouterView />
  </div>
</template>

<style scoped>
.app-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: var(--font-body, var(--sa-font-main, var(--sans)));
}
</style>
