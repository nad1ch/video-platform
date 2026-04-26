<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { useI18n } from 'vue-i18n'

defineProps<{
  to: RouteLocationRaw
  authHint: string
}>()

const { t } = useI18n()

const previewTiles = [
  { id: 'host', color: 'violet' },
  { id: 'guest-a', color: 'coral' },
  { id: 'guest-b', color: 'ink' },
  { id: 'guest-c', color: 'olive' },
] as const
</script>

<template>
  <section class="app-call app-call__panel" aria-labelledby="app-call-title">
    <h2 id="app-call-title" class="app-call__title">{{ t('home.sectionVideoCall') }}</h2>

    <RouterLink class="app-call__screen" :to="to" :aria-label="authHint">
      <div class="app-call__tile-grid" aria-hidden="true">
        <span
          v-for="tile in previewTiles"
          :key="tile.id"
          class="app-call__tile"
          :class="`app-call__tile--${tile.color}`"
        >
          <span class="app-call__camera-dot" />
          <span class="app-call__person" />
          <span class="app-call__name-line" />
        </span>
      </div>
    </RouterLink>
  </section>
</template>

<style scoped>
.app-call__panel {
  position: relative;
  display: block;
  max-width: 100%;
  min-height: clamp(11.4rem, 15.3vw, 13.8rem);
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

.app-call__panel::before,
.app-call__panel::after {
  position: absolute;
  border-radius: 999px;
  content: '';
  filter: blur(22px);
  pointer-events: none;
}

.app-call__panel::before {
  left: 24%;
  top: 30%;
  width: 4.2rem;
  height: 4.2rem;
  background: rgba(139, 92, 246, 0.16);
}

.app-call__panel::after {
  right: 14%;
  bottom: 14%;
  width: 5rem;
  height: 5rem;
  background: rgba(124, 77, 219, 0.14);
}

.app-call__title {
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

.app-call__screen {
  position: relative;
  z-index: 1;
  display: block;
  padding: 0.55rem;
  border: 5px solid rgba(255, 255, 255, 0.96);
  border-radius: 1.8rem;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.08), transparent 46%),
    linear-gradient(120deg, rgba(124, 77, 219, 0.096), rgba(60, 36, 99, 0.094)),
    var(--app-home-glass-inner-bg, rgba(60, 36, 99, 0.1));
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.12),
    0 18px 38px rgba(0, 0, 0, 0.16);
  -webkit-backdrop-filter: blur(var(--app-home-glass-blur, 10px)) saturate(1.18);
  backdrop-filter: blur(var(--app-home-glass-blur, 10px)) saturate(1.18);
  color: inherit;
  text-decoration: none;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.app-call__screen:hover {
  transform: translateY(-3px);
  border-color: #fff;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.16),
    0 18px 46px rgba(6, 2, 18, 0.34);
}

.app-call__screen:focus-visible {
  outline: 3px solid rgba(255, 218, 68, 0.86);
  outline-offset: 4px;
}

.app-call__tile-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: clamp(0.55rem, 1.4vw, 0.95rem);
  padding: 0.45rem;
  border-radius: 1rem;
  background: transparent;
}

.app-call__tile {
  position: relative;
  min-height: clamp(2.65rem, 5.4vw, 3.35rem);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 0.55rem;
  background: rgba(139, 92, 246, 0.5);
}

.app-call__camera-dot {
  position: absolute;
  right: 0.75rem;
  top: 0.45rem;
  width: 1rem;
  height: 0.38rem;
  border-radius: 999px;
  background: #6e72f8;
}

.app-call__person {
  position: absolute;
  left: 50%;
  bottom: -0.5rem;
  width: 2.45rem;
  height: 1.8rem;
  border-radius: 1rem 1rem 0.35rem 0.35rem;
  background: #8b5cf6;
  transform: translateX(-50%);
}

.app-call__person::before {
  position: absolute;
  left: 50%;
  top: -1.28rem;
  width: 1rem;
  height: 1rem;
  border-radius: 999px;
  background: #ffa36c;
  content: '';
  transform: translateX(-50%);
}

.app-call__name-line {
  position: absolute;
  left: 0.5rem;
  bottom: 0.55rem;
  width: 1.45rem;
  height: 0.28rem;
  border-radius: 999px;
  background: #f2f4ff;
}

.app-call__tile--coral .app-call__person {
  background: rgba(255, 96, 48, 0.72);
}

.app-call__tile--ink .app-call__person {
  background: rgba(0, 0, 0, 0.56);
}

.app-call__tile--olive .app-call__person {
  background: #6e6c2b;
}

@media (max-width: 580px) {
  .app-call__title {
    font-size: 1.1rem;
  }

  .app-call__tile-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 581px) and (max-width: 1200px) {
  .app-call__panel {
    min-height: clamp(8.8rem, 20vh, 10.4rem);
    padding: 0.9rem;
  }

  .app-call__title {
    margin-bottom: 0.75rem;
    font-size: 1.05rem;
  }

  .app-call__screen {
    border-width: 3px;
  }

  .app-call__tile {
    min-height: clamp(2rem, 5.6vh, 2.6rem);
  }
}

@media (min-width: 581px) and (max-width: 900px) {
  .app-call__panel {
    min-height: auto;
    padding: 1.25rem;
  }

  .app-call__title {
    font-size: 1.25rem;
  }

  .app-call__screen {
    border-width: 4px;
  }

  .app-call__tile {
    min-height: 3rem;
  }
}
</style>
