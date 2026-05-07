<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { DurakCard as DurakCardModel, DurakDemoPhase, DurakTablePair } from '../core/cardTypes'
import DurakCard from './DurakCard.vue'

defineProps<{
  tableCards: DurakTablePair[]
  trumpCard: DurakCardModel
  deckCount: number
  phase: DurakDemoPhase
}>()

const { t } = useI18n()
</script>

<template>
  <div class="durak-table" aria-label="Durak table">
    <div class="durak-table__deck-zone">
      <div class="durak-table__pile" aria-hidden="true">
        <span
          v-for="i in Math.min(4, Math.max(1, Math.ceil(deckCount / 8)))"
          :key="i"
          class="durak-table__pile-layer"
          :style="{ transform: `translate(${i * 2}px, ${-i * 2}px)` }"
        />
      </div>
      <div class="durak-table__deck-meta">
        <span class="durak-table__label">{{ t('durak.deck') }}</span>
        <span class="durak-table__count">{{ deckCount }}</span>
      </div>
      <div class="durak-table__trump-wrap">
        <span class="durak-table__label">{{ t('durak.trump') }}</span>
        <div class="durak-table__trump-rotate">
          <DurakCard :card="trumpCard" size="sm" disabled />
        </div>
      </div>
    </div>

    <div class="durak-table__center">
      <p class="durak-table__phase">{{ t(`durak.phase.${phase}`) }}</p>
      <div class="durak-table__slots">
        <div v-for="row in tableCards" :key="row.id" class="durak-table__pair">
          <div class="durak-table__slot">
            <DurakCard :card="row.attacker" size="sm" disabled />
          </div>
          <div class="durak-table__slot durak-table__slot--defense">
            <DurakCard v-if="row.defender" :card="row.defender" size="sm" disabled />
            <div v-else class="durak-table__empty" :aria-label="t('durak.emptyDefender')" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.durak-table {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--sa-space-4, 1rem);
  align-items: stretch;
  min-height: 12rem;
}

@media (max-width: 720px) {
  .durak-table {
    grid-template-columns: 1fr;
  }
}

.durak-table__deck-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sa-space-3, 0.75rem);
  padding: var(--sa-space-3, 0.75rem);
  border-radius: var(--sa-radius-lg, 12px);
  background: color-mix(in srgb, #0f172a 55%, transparent);
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.durak-table__pile {
  position: relative;
  width: 3.25rem;
  height: 4.55rem;
}

.durak-table__pile-layer {
  position: absolute;
  inset: 0;
  border-radius: var(--sa-radius-md, 10px);
  background: linear-gradient(145deg, #1e293b, #0f172a);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.durak-table__deck-meta {
  text-align: center;
}

.durak-table__label {
  display: block;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(226, 232, 240, 0.65);
}

.durak-table__count {
  font-size: 1.35rem;
  font-weight: 700;
  color: #f1f5f9;
}

.durak-table__trump-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
}

.durak-table__trump-rotate {
  transform: rotate(90deg);
  pointer-events: none;
}

.durak-table__center {
  display: flex;
  flex-direction: column;
  gap: var(--sa-space-3, 0.75rem);
  padding: var(--sa-space-3, 0.75rem);
  border-radius: var(--sa-radius-lg, 12px);
  background: color-mix(in srgb, #022c22 35%, transparent);
  border: 1px dashed rgba(52, 211, 153, 0.25);
}

.durak-table__phase {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(167, 243, 208, 0.9);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.durak-table__slots {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sa-space-3, 0.75rem);
  justify-content: center;
  align-items: flex-start;
}

.durak-table__pair {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.durak-table__slot {
  min-width: 3.25rem;
  min-height: 4.55rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.durak-table__empty {
  width: 3.25rem;
  height: 4.55rem;
  border-radius: var(--sa-radius-md, 10px);
  border: 2px dashed rgba(52, 211, 153, 0.35);
  background: rgba(6, 78, 59, 0.25);
}

.durak-table__slot--defense {
  opacity: 0.95;
}
</style>
