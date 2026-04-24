<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

type AppGameCard = {
  id: string
  title: string
  subtitle?: string
  to: RouteLocationRaw
  image: string
  ariaLabel: string
  tone?: 'violet' | 'amber' | 'green' | 'slate'
}

const props = defineProps<{
  items: AppGameCard[]
}>()

const hasItems = computed(() => props.items.length > 0)

function toneClass(tone: AppGameCard['tone']) {
  return `app-game-card--${tone ?? 'violet'}`
}
</script>

<template>
  <section class="app-games" aria-labelledby="app-games-title">
    <div class="app-games__panel">
      <h2 id="app-games-title" class="app-games__title">Games</h2>

      <div v-if="hasItems" class="app-games__grid">
        <RouterLink
          v-for="item in items"
          :key="item.id"
          class="app-game-card"
          :class="toneClass(item.tone)"
          :to="item.to"
          :aria-label="item.ariaLabel"
        >
          <span class="app-game-card__copy">
            <span class="app-game-card__title">{{ item.title }}</span>
            <span v-if="item.subtitle" class="app-game-card__subtitle">{{ item.subtitle }}</span>
          </span>
          <span class="app-game-card__visual" aria-hidden="true">
            <img class="app-game-card__image" :src="item.image" alt="" loading="lazy" decoding="async" />
          </span>
        </RouterLink>
      </div>

      <p v-else class="app-games__empty" role="status">No games available yet.</p>
    </div>
  </section>
</template>

<style scoped>
.app-games {
  min-width: 0;
}

.app-games__panel {
  position: relative;
  min-height: 100%;
  padding: clamp(1.35rem, 2.5vw, 2rem);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1.8rem;
  background:
    radial-gradient(circle at 28% 14%, rgba(255, 255, 255, 0.18) 0 1px, transparent 1.6px),
    radial-gradient(circle at 78% 22%, rgba(255, 255, 255, 0.18) 0 1px, transparent 1.6px),
    linear-gradient(120deg, rgba(124, 77, 219, 0.24), rgba(60, 36, 99, 0.2));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.07),
    0 24px 80px rgba(9, 2, 20, 0.28);
  backdrop-filter: blur(18px);
}

.app-games__panel::before,
.app-games__panel::after {
  position: absolute;
  border-radius: 999px;
  content: '';
  pointer-events: none;
  filter: blur(24px);
}

.app-games__panel::before {
  right: 15%;
  top: 4%;
  width: 5.4rem;
  height: 5.4rem;
  background: rgba(139, 92, 246, 0.18);
}

.app-games__panel::after {
  right: -1.5rem;
  bottom: 18%;
  width: 6.5rem;
  height: 6.5rem;
  background: rgba(124, 77, 219, 0.2);
}

.app-games__title {
  position: relative;
  z-index: 1;
  margin: 0 0 1rem;
  color: #fff;
  font-family: var(--sa-font-display, system-ui, sans-serif);
  font-size: 1.35rem;
  line-height: 1;
  text-align: center;
  text-transform: uppercase;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.app-games__grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(0.85rem, 1.8vw, 1rem);
}

.app-game-card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  min-height: clamp(5.9rem, 9vw, 6.8rem);
  padding: 0.85rem 1rem;
  overflow: hidden;
  border: 4px solid rgba(255, 255, 255, 0.92);
  border-radius: 1.45rem;
  background:
    radial-gradient(circle at 5% 7%, rgba(255, 255, 255, 0.9) 0 1px, transparent 1.5px),
    radial-gradient(circle at 45% 36%, rgba(255, 255, 255, 0.22) 0 1px, transparent 1.5px),
    linear-gradient(120deg, rgba(124, 77, 219, 0.16), rgba(60, 36, 99, 0.22));
  color: #fff;
  text-decoration: none;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 14px 36px rgba(6, 2, 18, 0.24);
  transition:
    border-color 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.app-game-card::before,
.app-game-card::after {
  position: absolute;
  border-radius: 999px;
  content: '';
  filter: blur(16px);
  pointer-events: none;
}

.app-game-card::before {
  right: 1.9rem;
  top: 0.6rem;
  width: 3.2rem;
  height: 3.2rem;
  background: rgba(139, 92, 246, 0.16);
}

.app-game-card::after {
  right: -0.2rem;
  bottom: 0.2rem;
  width: 3.9rem;
  height: 3.9rem;
  background: rgba(124, 77, 219, 0.14);
}

.app-game-card:hover {
  transform: translateY(-3px);
  border-color: #fff;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 18px 46px rgba(6, 2, 18, 0.34),
    0 0 0 1px rgba(255, 255, 255, 0.16);
}

.app-game-card:focus-visible {
  outline: 3px solid rgba(255, 218, 68, 0.86);
  outline-offset: 4px;
}

.app-game-card__copy,
.app-game-card__visual {
  position: relative;
  z-index: 1;
}

.app-game-card__copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 0.24rem;
}

.app-game-card__title {
  color: #fff;
  font-family: var(--sa-font-display, system-ui, sans-serif);
  font-size: 0.95rem;
  line-height: 1.08;
  text-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
}

.app-game-card__subtitle {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.7rem;
  font-weight: 800;
  line-height: 1.15;
  text-transform: uppercase;
}

.app-game-card__visual {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: clamp(3.45rem, 6vw, 4.85rem);
  height: clamp(3.45rem, 6vw, 4.85rem);
  flex-shrink: 0;
}

.app-game-card__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 12px 16px rgba(0, 0, 0, 0.28));
}

.app-game-card--amber .app-game-card__visual {
  filter: drop-shadow(0 0 14px rgba(255, 163, 108, 0.24));
}

.app-game-card--green .app-game-card__visual {
  filter: drop-shadow(0 0 14px rgba(34, 197, 94, 0.22));
}

.app-game-card--slate .app-game-card__visual {
  filter: drop-shadow(0 0 14px rgba(148, 163, 184, 0.2));
}

.app-games__empty {
  position: relative;
  z-index: 1;
  padding: 1.4rem;
  border: 1px dashed rgba(255, 255, 255, 0.35);
  border-radius: 1.2rem;
  color: rgba(255, 255, 255, 0.72);
  text-align: center;
}

@media (max-width: 1020px) {
  .app-games__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .app-games__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .app-games__panel {
    padding: 1rem;
    border-radius: 1.35rem;
  }

  .app-games__title {
    font-size: 1.1rem;
  }

  .app-game-card__title {
    font-size: 0.9rem;
  }

  .app-games__grid {
    grid-template-columns: 1fr;
  }
}
</style>
