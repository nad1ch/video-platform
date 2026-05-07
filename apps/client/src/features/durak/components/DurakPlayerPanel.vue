<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DurakPlayerRole } from '../core/cardTypes'

const props = defineProps<{
  name: string
  cardCount: number
  isActive?: boolean
  isTheirTurn?: boolean
  role: DurakPlayerRole
}>()

const { t } = useI18n()

const roleLabel = computed(() => (props.role === 'streamer' ? t('durak.roleStreamer') : t('durak.roleChat')))

const turnPill = computed(() => {
  if (!props.isTheirTurn) return null
  return props.role === 'streamer' ? t('durak.yourTurn') : t('durak.chatTurn')
})
</script>

<template>
  <div
    class="durak-player-panel"
    :class="{ 'durak-player-panel--active': isActive, 'durak-player-panel--turn': isTheirTurn }"
  >
    <div class="durak-player-panel__head">
      <span class="durak-player-panel__name">{{ name }}</span>
      <span class="durak-player-panel__role">{{ roleLabel }}</span>
    </div>
    <div class="durak-player-panel__meta">
      <span class="durak-player-panel__count">{{ t('durak.cards', { n: cardCount }) }}</span>
      <span v-if="turnPill" class="durak-player-panel__turn-pill">{{ turnPill }}</span>
    </div>
  </div>
</template>

<style scoped>
.durak-player-panel {
  padding: var(--sa-space-3, 0.75rem) var(--sa-space-4, 1rem);
  border-radius: var(--sa-radius-lg, 12px);
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: color-mix(in srgb, #0f172a 65%, transparent);
  min-width: 0;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.durak-player-panel--active {
  border-color: rgba(52, 211, 153, 0.45);
}

.durak-player-panel--turn {
  box-shadow: 0 0 0 1px rgba(167, 243, 208, 0.35), 0 0 20px rgba(16, 185, 129, 0.15);
}

.durak-player-panel__head {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.durak-player-panel__name {
  font-weight: 700;
  font-size: 0.95rem;
  color: #f1f5f9;
}

.durak-player-panel__role {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(226, 232, 240, 0.55);
}

.durak-player-panel__meta {
  margin-top: var(--sa-space-2, 0.5rem);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.durak-player-panel__count {
  font-size: 0.85rem;
  color: rgba(226, 232, 240, 0.85);
}

.durak-player-panel__turn-pill {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  background: rgba(16, 185, 129, 0.25);
  color: #a7f3d0;
  border: 1px solid rgba(52, 211, 153, 0.4);
}
</style>
