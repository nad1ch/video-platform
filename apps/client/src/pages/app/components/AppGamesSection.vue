<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { useI18n } from 'vue-i18n'

type AppGameCard = {
  id: string
  title: string
  subtitle?: string
  to: RouteLocationRaw
  image: string
  imageWebp?: string
  ariaLabel: string
  tone?: 'violet' | 'amber' | 'green' | 'slate'
  prefetch?: () => void
}

const props = defineProps<{
  items: AppGameCard[]
}>()

const { t } = useI18n()
const hasItems = computed(() => props.items.length > 0)

function toneClass(tone: AppGameCard['tone']) {
  return `app-game-card--${tone ?? 'violet'}`
}

function prefetchItem(item: AppGameCard): void {
  item.prefetch?.()
}
</script>

<template>
  <section class="app-games" aria-labelledby="app-games-title">
    <div class="app-games__panel">
      <h2 id="app-games-title" class="app-games__title">{{ t('home.sectionGames') }}</h2>

      <div v-if="hasItems" class="app-games__grid">
        <RouterLink
          v-for="item in items"
          :key="item.id"
          class="app-game-card"
          :class="toneClass(item.tone)"
          :to="item.to"
          :aria-label="item.ariaLabel"
          @mouseenter="prefetchItem(item)"
          @focus="prefetchItem(item)"
        >
          <span class="app-game-card__copy">
            <span class="app-game-card__title">{{ item.title }}</span>
            <span v-if="item.subtitle" class="app-game-card__subtitle">{{ item.subtitle }}</span>
          </span>
          <span class="app-game-card__visual" aria-hidden="true">
            <picture class="app-game-card__picture">
              <source v-if="item.imageWebp" :srcset="item.imageWebp" type="image/webp" />
              <img class="app-game-card__image" :src="item.image" alt="" loading="lazy" decoding="async" />
            </picture>
          </span>
        </RouterLink>
      </div>

      <p v-else class="app-games__empty" role="status">{{ t('home.emptyGames') }}</p>
    </div>
  </section>
</template>

<style scoped>
.app-games {
  min-width: 0;
}

.app-games__panel {
  position: relative;
  min-height: clamp(23rem, 30.6vw, 27.6rem);
  padding: 1.15rem 1rem 1.2rem;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 1.8rem;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.035), transparent 34%),
    rgba(18, 8, 34, 0.015);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.24),
    inset 0 -1px 0 rgba(255, 255, 255, 0.08),
    0 14px 36px rgba(11, 3, 23, 0.34);
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
}

.app-games__panel::before,
.app-games__panel::after {
  display: none;
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
  font-family: var(--app-home-display, var(--sa-font-display, system-ui, sans-serif));
  font-size: 1.28rem;
  font-weight: 400;
  font-variation-settings: 'YEAR' 1979;
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
  gap: 0.95rem 1rem;
}

.app-game-card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(3.25rem, 4.5vw, 4.2rem);
  align-items: center;
  column-gap: 0.45rem;
  min-height: 6.8rem;
  padding: 0.72rem 0.7rem 0.72rem 0.85rem;
  overflow: hidden;
  border: 5px solid rgba(255, 255, 255, 0.96);
  border-radius: 1.77rem;
  background: rgba(36, 17, 58, 0.34);
  color: #fff;
  text-decoration: none;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 -1px 0 rgba(255, 255, 255, 0.03),
    0 10px 24px rgba(6, 2, 18, 0.2);
  -webkit-backdrop-filter: blur(var(--app-home-glass-blur, 10px)) saturate(1.18);
  backdrop-filter: blur(var(--app-home-glass-blur, 10px)) saturate(1.18);
  transition:
    border-color 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.app-game-card::before,
.app-game-card::after {
  display: none;
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
  background: rgba(54, 27, 83, 0.42);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 14px 32px rgba(6, 2, 18, 0.3),
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
  max-width: 100%;
  gap: 0.24rem;
}

.app-game-card__title {
  color: #fff;
  font-family: var(--app-home-display, var(--sa-font-display, system-ui, sans-serif));
  font-size: clamp(0.82rem, 1.08vw, 1.02rem);
  font-weight: 400;
  font-variation-settings: 'YEAR' 1979;
  line-height: 1.08;
  overflow-wrap: normal;
  text-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
  word-break: normal;
}

.app-game-card__subtitle {
  color: rgba(255, 255, 255, 0.7);
  font-family: var(--app-home-ui, var(--sa-font-main, system-ui), sans-serif);
  font-size: 0.7rem;
  font-weight: 400;
  line-height: 1.15;
  text-transform: uppercase;
}

.app-game-card__visual {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: clamp(3.25rem, 4.5vw, 4.2rem);
  flex-shrink: 0;
  transform-origin: center;
  transition: transform 0.25s ease;
}

.app-game-card:hover .app-game-card__visual {
  transform: rotate(-5deg) scale(1.1);
}

.app-game-card__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 8px 12px rgba(0, 0, 0, 0.24));
}

.app-game-card__picture {
  display: block;
  width: 100%;
  height: 100%;
}

.app-game-card--amber .app-game-card__visual {
  filter: drop-shadow(0 0 10px rgba(255, 163, 108, 0.2));
}

.app-game-card--green .app-game-card__visual {
  filter: drop-shadow(0 0 10px rgba(34, 197, 94, 0.18));
}

.app-game-card--slate .app-game-card__visual {
  filter: drop-shadow(0 0 10px rgba(148, 163, 184, 0.17));
}

@media (prefers-reduced-motion: reduce) {
  .app-game-card__visual {
    transition: none;
  }

  .app-game-card:hover .app-game-card__visual {
    transform: none;
  }
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

@media (max-width: 1200px) {
  .app-games__panel {
    min-height: clamp(22rem, 47vh, 27rem);
    padding: 1rem 1.15rem 1.1rem;
  }

  .app-games__title {
    margin-bottom: 0.85rem;
    font-size: 1.05rem;
  }

  .app-games__grid {
    gap: 0.75rem;
  }

  .app-game-card {
    min-height: 5.7rem;
    border-width: 3px;
    border-radius: 1.1rem;
    padding: 0.65rem 0.75rem;
    grid-template-columns: minmax(0, 1fr) 3rem;
  }

  .app-game-card__title {
    font-size: 0.78rem;
  }

  .app-game-card__visual {
    height: 3rem;
  }
}

@media (max-width: 900px) {
  .app-games__panel {
    min-height: auto;
    padding: 1.25rem 1.4rem;
  }

  .app-games__title {
    font-size: 1.25rem;
  }

  .app-game-card {
    min-height: 6.4rem;
    border-width: 4px;
    border-radius: 1.25rem;
    padding: 0.8rem 1rem;
    grid-template-columns: minmax(0, 1fr) 4rem;
  }

  .app-game-card__title {
    font-size: 0.95rem;
  }

  .app-game-card__visual {
    height: 4rem;
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
