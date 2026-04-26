<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { useI18n } from 'vue-i18n'
import EconomySlotBanner from '@/pages/app/components/EconomySlotBanner.vue'

defineProps<{
  to: RouteLocationRaw
}>()

const { t } = useI18n()
</script>

<template>
  <section class="app-economy app-economy__panel" aria-labelledby="app-economy-title">
    <h2 id="app-economy-title" class="app-economy__title">{{ t('home.sectionEconomy') }}</h2>

    <EconomySlotBanner class="app-economy__banner" :to="to" />
  </section>
</template>

<style scoped>
.app-economy__panel {
  position: relative;
  display: block;
  max-width: 100%;
  min-height: clamp(10.4rem, 14.1vw, 12.7rem);
  padding: clamp(1.05rem, 1.8vw, 1.55rem);
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 1.8rem;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.035), transparent 34%),
    rgba(18, 8, 34, 0.015);
  color: #fff;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.24),
    inset 0 -1px 0 rgba(255, 255, 255, 0.08),
    0 18px 58px rgba(11, 3, 23, 0.42);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
}

.app-economy__title {
  position: relative;
  z-index: 1;
  margin: 0 0 1.1rem;
  color: #fff;
  font-family: var(--app-home-display, var(--sa-font-display, system-ui, sans-serif));
  font-size: 1.28rem;
  font-weight: 400;
  font-variation-settings: 'YEAR' 1979;
  line-height: 1;
  text-align: center;
  text-transform: uppercase;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.app-economy__banner {
  position: relative;
  z-index: 1;
  width: 100%;
}

@media (max-width: 620px) {
  .app-economy__title {
    font-size: 1.1rem;
  }
}

@media (min-width: 621px) and (max-width: 1200px) {
  .app-economy__panel {
    min-height: clamp(8.8rem, 20vh, 10.4rem);
    padding: 0.9rem;
  }

  .app-economy__title {
    margin-bottom: 0.75rem;
    font-size: 1.05rem;
  }
}

@media (min-width: 621px) and (max-width: 900px) {
  .app-economy__panel {
    min-height: auto;
    padding: 1.25rem;
  }

  .app-economy__title {
    font-size: 1.25rem;
  }
}
</style>
