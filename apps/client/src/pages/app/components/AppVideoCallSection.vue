<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'

defineProps<{
  to: RouteLocationRaw
  authHint: string
}>()

const previewTiles = [
  { id: 'host', color: 'violet' },
  { id: 'guest-a', color: 'coral' },
  { id: 'guest-b', color: 'ink' },
  { id: 'guest-c', color: 'olive' },
] as const
</script>

<template>
  <section class="app-call" aria-labelledby="app-call-title">
    <RouterLink class="app-call__panel" :to="to" :aria-label="authHint">
      <h2 id="app-call-title" class="app-call__title">Videocall</h2>

      <div class="app-call__screen" aria-hidden="true">
        <div class="app-call__tile-grid">
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
      </div>
    </RouterLink>
  </section>
</template>

<style scoped>
.app-call__panel {
  position: relative;
  display: block;
  max-width: 100%;
  min-height: clamp(8rem, 13vw, 9.7rem);
  padding: clamp(1.05rem, 1.8vw, 1.55rem);
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1.8rem;
  background:
    radial-gradient(circle at 22% 22%, rgba(255, 255, 255, 0.2) 0 1px, transparent 1.6px),
    radial-gradient(circle at 36% 46%, rgba(255, 255, 255, 0.16) 0 1px, transparent 1.6px),
    linear-gradient(120deg, rgba(124, 77, 219, 0.26), rgba(60, 36, 99, 0.22)),
    rgba(28, 12, 52, 0.36);
  color: #fff;
  text-decoration: none;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.13),
    inset 0 -1px 0 rgba(255, 255, 255, 0.05),
    0 24px 80px rgba(9, 2, 20, 0.24);
  -webkit-backdrop-filter: blur(22px) saturate(1.08);
  backdrop-filter: blur(22px) saturate(1.08);
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
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

.app-call__panel:hover {
  transform: translateY(-3px);
  border-color: rgba(255, 255, 255, 0.18);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 30px 90px rgba(9, 2, 20, 0.36);
}

.app-call__panel:focus-visible {
  outline: 3px solid rgba(255, 218, 68, 0.86);
  outline-offset: 4px;
}

.app-call__title {
  position: relative;
  z-index: 1;
  margin: 0 0 1.1rem;
  color: #fff;
  font-family: var(--app-home-display, var(--sa-font-display, system-ui, sans-serif));
  font-size: 1.28rem;
  line-height: 1;
  text-align: center;
  text-transform: uppercase;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.app-call__screen {
  position: relative;
  z-index: 1;
  padding: 0.55rem;
  border: 4px solid rgba(255, 255, 255, 0.94);
  border-radius: 1.35rem;
  background:
    linear-gradient(120deg, rgba(124, 77, 219, 0.16), rgba(60, 36, 99, 0.22)),
    rgba(60, 36, 99, 0.54);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.12),
    0 18px 38px rgba(0, 0, 0, 0.16);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
}

.app-call__tile-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: clamp(0.55rem, 1.4vw, 0.95rem);
  padding: 0.45rem;
  border-radius: 1rem;
  background: rgba(60, 36, 99, 0.62);
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
    min-height: clamp(7.2rem, 18vh, 8.8rem);
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
