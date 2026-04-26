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
  display: flex;
  flex-direction: column;
  max-width: 100%;
  height: 100%;
  min-height: clamp(8.2rem, 10.6vw, 9.45rem);
  padding: clamp(0.58rem, 1vw, 0.78rem) clamp(0.75rem, 1.25vw, 1rem) clamp(0.68rem, 1.15vw, 0.88rem);
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
    0 14px 36px rgba(11, 3, 23, 0.34);
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
}

.app-economy__title {
  position: relative;
  z-index: 1;
  margin: -0.05rem 0 0.4rem;
  color: #fff;
  font-family: var(--app-home-display, var(--sa-font-display, system-ui, sans-serif));
  font-size: clamp(1.12rem, 1.62vw, 1.46rem);
  font-weight: 400;
  font-variation-settings: 'YEAR' 1979;
  line-height: 1.16;
  text-align: center;
  text-transform: uppercase;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.app-economy__banner {
  position: relative;
  z-index: 1;
  width: 100%;
  margin-top: auto;
  margin-bottom: clamp(0.35rem, 0.45vw, 0.55rem);
}

@media (max-width: 620px) {
  .app-economy__title {
    font-size: 1.1rem;
  }
}

@media (min-width: 621px) and (max-width: 1200px) {
  .app-economy__panel {
    min-height: clamp(7rem, 16vh, 8.6rem);
    padding: 0.9rem;
  }

  .app-economy__banner {
    margin-bottom: 0.45rem;
  }

  .app-economy__title {
    margin-bottom: 0.75rem;
    font-size: 1.05rem;
  }
}

@media (min-width: 621px) and (max-width: 900px) {
  .app-economy__panel {
    height: auto;
    min-height: auto;
    padding: 1.25rem;
  }

  .app-economy__banner {
    margin-bottom: 0;
  }

  .app-economy__title {
    font-size: 1.25rem;
  }
}
</style>
