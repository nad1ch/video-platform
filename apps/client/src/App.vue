<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppFullPageLoader from '@/components/ui/AppFullPageLoader.vue'
import { useAuth } from '@/composables/useAuth'
import { useSaTooltips } from '@/composables/useSaTooltips'
import { routeNavLoadingVisible } from '@/routeNavLoading'
import mainCloudSrc from '@/assets/landing/clouds/cloud-wide-volumetric.webp'
import '@/eat-first/styles/motion.css'

const { t } = useI18n()
const route = useRoute()
const initialAppLoading = ref(true)
const routeLoading = computed(() => routeNavLoadingVisible.value)
const pageLoading = computed(() => initialAppLoading.value || routeLoading.value)

function isVisualCloudRoute(): boolean {
  if (route.name === 'landing' || route.name === 'home') {
    return true
  }
  if (typeof window === 'undefined') {
    return false
  }
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  return path === '/' || path === '/app'
}

function ensureMainCloudPreload(): void {
  if (typeof document === 'undefined') {
    return
  }
  if (document.querySelector(`link[rel="preload"][href="${mainCloudSrc}"]`)) {
    return
  }
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  link.href = mainCloudSrc
  link.type = 'image/webp'
  ;(link as HTMLLinkElement & { fetchPriority?: string }).fetchPriority = 'high'
  document.head.append(link)
}

function waitForMainCloud(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    const img = new Image()
    let done = false
    const finish = () => {
      if (done) {
        return
      }
      done = true
      resolve()
    }
    img.onload = finish
    img.onerror = finish
    img.decoding = 'async'
    ;(img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = 'high'
    img.src = mainCloudSrc
    window.setTimeout(finish, 2500)
  })
}

if (isVisualCloudRoute()) {
  ensureMainCloudPreload()
}

useSaTooltips()

onMounted(async () => {
  try {
    await Promise.all([
      useAuth().refresh(),
      isVisualCloudRoute() ? waitForMainCloud() : Promise.resolve(),
    ])
  } finally {
    initialAppLoading.value = false
  }
})
</script>

<template>
  <div class="app-root">
    <AppFullPageLoader
      :visible="pageLoading"
      :aria-label="t('app.routeLoadingAria')"
      :label="initialAppLoading ? t('loader.default') : ''"
    />
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
