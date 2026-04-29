<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { useI18n } from 'vue-i18n'

type AppGameCard = {
  id: string
  title: string
  subtitle?: string
  to?: RouteLocationRaw
  image: string
  imageWebp?: string
  ariaLabel: string
  tone?: 'violet' | 'amber' | 'green' | 'slate'
  prefetch?: () => void
  modalVisual?: 'image' | 'economy-slot'
  comingSoon?: {
    eyebrow: string
    title?: string
    description: string
    status: string
    variant?: 'game' | 'economy'
  }
}

type AppComingSoonCard = AppGameCard & {
  comingSoon: NonNullable<AppGameCard['comingSoon']>
}

const props = defineProps<{
  items: AppGameCard[]
  modalItems?: AppGameCard[]
  lead?: string
  comingSoonItemId?: string | null
}>()

const emit = defineEmits<{
  comingSoonClose: []
}>()

const { t } = useI18n()
const hasItems = computed(() => props.items.length > 0)
const selectedComingSoonItemId = ref<string | null>(null)
const allComingSoonItems = computed(() => [...props.items, ...(props.modalItems ?? [])])
const activeComingSoonItem = computed<AppComingSoonCard | null>(() => {
  const item = allComingSoonItems.value.find((candidate) => candidate.id === selectedComingSoonItemId.value)
  return item?.comingSoon ? (item as AppComingSoonCard) : null
})

watch(
  () => [props.comingSoonItemId, allComingSoonItems.value] as const,
  ([itemId]) => {
    if (!itemId) return
    const item = allComingSoonItems.value.find((candidate) => candidate.id === itemId)
    if (item?.comingSoon) {
      selectedComingSoonItemId.value = item.id
    }
  },
  { immediate: true },
)

function toneClass(tone: AppGameCard['tone']) {
  return `app-game-card--${tone ?? 'violet'}`
}

function prefetchItem(item: AppGameCard): void {
  item.prefetch?.()
}

function modalId(item: AppGameCard, suffix: 'title' | 'desc'): string {
  return `app-game-card-${item.id}-${suffix}`
}

function openComingSoon(item: AppGameCard): void {
  selectedComingSoonItemId.value = item.id
}

function closeComingSoon(): void {
  selectedComingSoonItemId.value = null
  emit('comingSoonClose')
}

const economySlotLetters = Object.freeze(['T', 'W', 'I', 'T', 'C', 'H'] as const)
</script>

<template>
  <section class="app-games" aria-labelledby="app-games-title">
    <div class="app-games__panel">
      <h2 id="app-games-title" class="app-games__title">{{ t('home.sectionGames') }}</h2>
      <p v-if="lead" class="app-games__lead">{{ lead }}</p>

      <div v-if="hasItems" class="app-games__grid">
        <template v-for="item in items" :key="item.id">
          <button
            v-if="item.comingSoon"
            type="button"
            class="app-game-card"
            :class="toneClass(item.tone)"
            :aria-label="item.ariaLabel"
            @click="openComingSoon(item)"
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
          </button>

          <RouterLink
            v-else-if="item.to"
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
        </template>
      </div>

      <p v-else class="app-games__empty" role="status">{{ t('home.emptyGames') }}</p>
    </div>

    <Teleport to="body">
      <Transition name="app-coming-soon-modal">
        <div v-if="activeComingSoonItem" class="app-coming-soon" role="presentation" @keydown.esc="closeComingSoon">
          <button
            type="button"
            class="app-coming-soon__backdrop"
            :aria-label="t('home.comingSoonClose')"
            @click="closeComingSoon"
          />

          <section
            class="app-coming-soon__dialog"
            :class="`app-coming-soon__dialog--${activeComingSoonItem.comingSoon.variant ?? 'game'}`"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="modalId(activeComingSoonItem, 'title')"
            :aria-describedby="modalId(activeComingSoonItem, 'desc')"
            tabindex="-1"
          >
            <button
              type="button"
              class="app-coming-soon__close"
              :aria-label="t('home.comingSoonClose')"
              @click="closeComingSoon"
            >
            </button>

            <div class="app-coming-soon__copy">
              <p class="app-coming-soon__eyebrow">{{ activeComingSoonItem.comingSoon.eyebrow }}</p>
              <h3 :id="modalId(activeComingSoonItem, 'title')" class="app-coming-soon__title">
                {{ activeComingSoonItem.comingSoon.title ?? activeComingSoonItem.title }}
              </h3>
              <p :id="modalId(activeComingSoonItem, 'desc')" class="app-coming-soon__description">
                {{ activeComingSoonItem.comingSoon.description }}
              </p>
            </div>

            <picture
              v-if="activeComingSoonItem.modalVisual !== 'economy-slot'"
              class="app-coming-soon__picture"
              aria-hidden="true"
            >
              <img class="app-coming-soon__image" :src="activeComingSoonItem.image" alt="" decoding="async" />
            </picture>
            <span v-else class="app-coming-soon__economy-slot" aria-hidden="true">
              <span class="app-coming-soon__economy-jackpot">JACKPOT</span>
              <span class="app-coming-soon__economy-cells">
                <span v-for="letter in economySlotLetters" :key="letter" class="app-coming-soon__economy-cell">
                  {{ letter }}
                </span>
              </span>
              <span class="app-coming-soon__economy-underbar app-coming-soon__economy-underbar--left" />
              <span class="app-coming-soon__economy-underbar app-coming-soon__economy-underbar--right" />
              <span class="app-coming-soon__economy-slot-bar" />
              <span class="app-coming-soon__economy-handle">
                <span class="app-coming-soon__economy-handle-stick" />
              </span>
            </span>
          </section>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
.app-games {
  min-width: 0;
  height: 100%;
}

.app-games__panel {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
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

.app-games__lead {
  position: relative;
  z-index: 1;
  margin: -0.35rem 0 1rem;
  color: rgba(230, 233, 255, 0.88);
  font-family: var(--app-home-ui, var(--sa-font-main, system-ui), sans-serif);
  font-size: 0.72rem;
  line-height: 1.35;
  text-align: center;
}

.app-games__grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(3, minmax(6.95rem, 1fr));
  flex: 1 1 auto;
  gap: 0.95rem 1rem;
}

.app-game-card {
  position: relative;
  appearance: none;
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(3.25rem, 4.5vw, 4.2rem);
  align-items: center;
  column-gap: 0.45rem;
  min-height: 0;
  padding: 0.72rem 0.7rem 0.72rem 0.85rem;
  overflow: hidden;
  border: var(--app-home-card-border, 5px) solid rgba(255, 255, 255, 0.96);
  border-radius: 1.77rem;
  background: rgba(36, 17, 58, 0.34);
  color: #fff;
  cursor: pointer;
  font: inherit;
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

  .app-coming-soon-modal-enter-active,
  .app-coming-soon-modal-leave-active,
  .app-coming-soon__close,
  .app-coming-soon-modal-enter-active .app-coming-soon__dialog,
  .app-coming-soon-modal-leave-active .app-coming-soon__dialog {
    transition: none;
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

.app-coming-soon {
  position: fixed;
  inset: 0;
  z-index: 10020;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.app-coming-soon__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background:
    radial-gradient(circle at 50% 25%, rgba(119, 83, 255, 0.24), transparent 36rem),
    rgba(8, 3, 18, 0.72);
  cursor: pointer;
  -webkit-backdrop-filter: blur(7px);
  backdrop-filter: blur(7px);
}

.app-coming-soon__dialog {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(10rem, 26vw, 17rem);
  align-items: start;
  gap: clamp(0.8rem, 2.5vw, 1.5rem);
  width: min(100%, 41rem);
  min-height: clamp(9.5rem, 24vw, 11rem);
  padding: clamp(1rem, 2.3vw, 1.35rem) clamp(1.05rem, 2.6vw, 1.45rem);
  overflow: hidden;
  border: 5px solid rgba(255, 255, 255, 0.97);
  border-radius: clamp(1.15rem, 2.8vw, 1.55rem);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.055), transparent 38%),
    rgba(30, 24, 39, 0.94);
  color: #fff;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    0 24px 70px rgba(0, 0, 0, 0.45);
}

.app-coming-soon__dialog--economy {
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 31rem);
  align-items: center;
  width: min(100%, 63rem);
  min-height: clamp(13rem, 28vw, 16rem);
  padding: clamp(1.35rem, 3vw, 1.8rem);
  border-radius: clamp(1.35rem, 3vw, 1.9rem);
}

.app-coming-soon__close {
  position: absolute;
  top: 0.75rem;
  right: 0.85rem;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.86);
  cursor: pointer;
  font: inherit;
  pointer-events: auto;
  touch-action: manipulation;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;
}

.app-coming-soon__close:hover {
  border-color: rgba(255, 255, 255, 0.34);
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  transform: scale(1.04);
}

.app-coming-soon__close:active {
  transform: scale(0.96);
}

.app-coming-soon__close::before,
.app-coming-soon__close::after {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0.88rem;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
  content: '';
  transform-origin: center;
}

.app-coming-soon__close::before {
  transform: translate(-50%, -50%) rotate(45deg);
}

.app-coming-soon__close::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}

.app-coming-soon__copy {
  position: relative;
  z-index: 1;
  min-width: 0;
  padding-top: 0.12rem;
}

.app-coming-soon__eyebrow {
  margin: 0 0 1.25rem;
  color: rgba(255, 255, 255, 0.84);
  font-family: var(--app-home-display, var(--sa-font-display, system-ui, sans-serif));
  font-size: clamp(0.58rem, 0.9vw, 0.7rem);
  font-variation-settings: 'YEAR' 1979;
  line-height: 1;
  text-transform: lowercase;
}

.app-coming-soon__title {
  margin: 0;
  color: #fff;
  font-family: var(--app-home-display, var(--sa-font-display, system-ui, sans-serif));
  font-size: clamp(1.15rem, 2.8vw, 1.85rem);
  font-weight: 400;
  font-variation-settings: 'YEAR' 1979;
  line-height: 1.08;
  text-shadow: 0 4px 14px rgba(0, 0, 0, 0.34);
}

.app-coming-soon__dialog--economy .app-coming-soon__title {
  font-size: clamp(1.45rem, 3.1vw, 2rem);
}

.app-coming-soon__description {
  max-width: 29rem;
  margin: 0.95rem 0 0;
  color: rgba(255, 255, 255, 0.92);
  font-family: var(--app-home-ui, var(--sa-font-main, system-ui), sans-serif);
  font-size: clamp(0.62rem, 1.1vw, 0.78rem);
  line-height: 1.18;
  white-space: pre-line;
}

.app-coming-soon__dialog--economy .app-coming-soon__description {
  max-width: 34rem;
  font-size: clamp(0.74rem, 1.15vw, 0.96rem);
  line-height: 1.22;
}

.app-coming-soon__picture {
  position: relative;
  z-index: 1;
  display: block;
  align-self: center;
  justify-self: center;
  width: clamp(7rem, 18vw, 11.5rem);
  height: clamp(5rem, 14vw, 8rem);
  opacity: 1;
}

.app-coming-soon__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: auto;
  filter: drop-shadow(0 8px 8px rgba(0, 0, 0, 0.28));
}

.app-coming-soon__economy-slot {
  --economy-modal-u: calc(min(31rem, 48vw) / 429.19);
  position: relative;
  z-index: 1;
  display: block;
  width: calc(var(--economy-modal-u) * 429.19);
  height: calc(var(--economy-modal-u) * 128);
  justify-self: end;
}

.app-coming-soon__economy-jackpot {
  position: absolute;
  left: calc(var(--economy-modal-u) * 122.34);
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: calc(var(--economy-modal-u) * 142.031);
  height: calc(var(--economy-modal-u) * 35.156);
  border: calc(var(--economy-modal-u) * 3.75) solid #7c4ddb;
  border-radius: calc(var(--economy-modal-u) * 18);
  box-sizing: border-box;
  background: rgba(255, 59, 48, 0.64);
  color: #fff;
  font-family: var(--app-home-jackpot, 'Arbutus', serif);
  font-size: calc(var(--economy-modal-u) * 19.5);
  letter-spacing: 0.04em;
  line-height: 1;
}

.app-coming-soon__economy-cells {
  position: absolute;
  left: 0;
  top: calc(var(--economy-modal-u) * 22.87);
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  overflow: hidden;
  width: calc(var(--economy-modal-u) * 391.5);
  height: calc(var(--economy-modal-u) * 70.5);
  border: calc(var(--economy-modal-u) * 4.5) solid #66388f;
  border-radius: calc(var(--economy-modal-u) * 18);
  box-sizing: border-box;
  background: #c9d6ff;
}

.app-coming-soon__economy-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-right: calc(var(--economy-modal-u) * 0.75) solid #b3c2f5;
  background: #f7f8ff;
  color: rgba(87, 38, 130, 0.77);
  font-family: var(--app-home-jackpot, 'Arbutus', serif);
  font-size: calc(var(--economy-modal-u) * 40.5);
  line-height: 1;
}

.app-coming-soon__economy-cell:last-child {
  border-right: 0;
}

.app-coming-soon__economy-underbar {
  position: absolute;
  top: calc(var(--economy-modal-u) * 112.5);
  width: calc(var(--economy-modal-u) * 33);
  height: calc(var(--economy-modal-u) * 6);
  border-radius: calc(var(--economy-modal-u) * 3);
  background: rgba(255, 59, 48, 0.51);
}

.app-coming-soon__economy-underbar--left {
  left: calc(var(--economy-modal-u) * 87.19);
}

.app-coming-soon__economy-underbar--right {
  left: calc(var(--economy-modal-u) * 277.69);
}

.app-coming-soon__economy-slot-bar {
  position: absolute;
  left: calc(var(--economy-modal-u) * 143.25);
  top: calc(var(--economy-modal-u) * 85.12);
  width: calc(var(--economy-modal-u) * 105);
  height: calc(var(--economy-modal-u) * 21);
  border: calc(var(--economy-modal-u) * 2.25) solid #fff;
  border-radius: calc(var(--economy-modal-u) * 10.5);
  box-sizing: border-box;
  background: rgba(60, 36, 99, 0.62);
}

.app-coming-soon__economy-handle {
  position: absolute;
  left: calc(var(--economy-modal-u) * 409.21);
  top: calc(var(--economy-modal-u) * 30.94);
  width: calc(var(--economy-modal-u) * 19.688);
  height: calc(var(--economy-modal-u) * 66.094);
  border-radius: calc(var(--economy-modal-u) * 9);
  background: rgba(150, 131, 180, 0.63);
}

.app-coming-soon__economy-handle::before {
  position: absolute;
  left: calc(var(--economy-modal-u) * -1.4);
  top: calc(var(--economy-modal-u) * -30.94);
  width: calc(var(--economy-modal-u) * 22.5);
  height: calc(var(--economy-modal-u) * 22.5);
  border-radius: 999px;
  background: radial-gradient(circle at 35% 35%, #ff786b, #d83c34 65%);
  content: '';
}

.app-coming-soon__economy-handle-stick {
  position: absolute;
  left: calc(var(--economy-modal-u) * 6.28);
  top: calc(var(--economy-modal-u) * -16.32);
  width: calc(var(--economy-modal-u) * 6);
  height: calc(var(--economy-modal-u) * 43.5);
  border-radius: calc(var(--economy-modal-u) * 3);
  background: #1a1133;
}

.app-coming-soon-modal-enter-active,
.app-coming-soon-modal-leave-active {
  transition: opacity 0.18s ease;
}

.app-coming-soon-modal-enter-active .app-coming-soon__dialog,
.app-coming-soon-modal-leave-active .app-coming-soon__dialog {
  transition: transform 0.18s ease;
}

.app-coming-soon-modal-enter-from,
.app-coming-soon-modal-leave-to {
  opacity: 0;
}

.app-coming-soon-modal-enter-from .app-coming-soon__dialog,
.app-coming-soon-modal-leave-to .app-coming-soon__dialog {
  transform: translateY(10px) scale(0.98);
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
    grid-template-rows: repeat(3, minmax(5.9rem, 1fr));
    gap: 0.75rem;
  }

  .app-game-card {
    min-height: 0;
    border-width: var(--app-home-card-border, 3px);
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
    border-width: var(--app-home-card-border, 4px);
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
    grid-template-rows: none;
  }

  .app-coming-soon__dialog {
    grid-template-columns: 1fr;
    min-height: 14rem;
    text-align: left;
  }

  .app-coming-soon__picture {
    width: 7.5rem;
    height: 5.5rem;
    justify-self: start;
  }

  .app-coming-soon__dialog--economy {
    min-height: 24rem;
  }

  .app-coming-soon__economy-slot {
    --economy-modal-u: calc(min(21rem, 78vw) / 429.19);
    justify-self: start;
    margin-top: 0.75rem;
  }
}
</style>
