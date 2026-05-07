<script setup lang="ts">
import type { DurakPlayerCount } from '../core/durakModes'
import { DURAK_PLAYER_COUNTS } from '../core/durakModes'

defineProps<{
  modelValue: DurakPlayerCount
  legend: string
  note?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [DurakPlayerCount] }>()

function pick(n: DurakPlayerCount) {
  emit('update:modelValue', n)
}
</script>

<template>
  <div class="durak-count">
    <p class="durak-count__legend" :id="'durak-player-count-legend'">{{ legend }}</p>
    <div
      class="durak-count__row"
      role="radiogroup"
      :aria-labelledby="'durak-player-count-legend'"
    >
      <button
        v-for="n in DURAK_PLAYER_COUNTS"
        :key="n"
        type="button"
        class="durak-count__btn"
        :class="{ 'durak-count__btn--on': modelValue === n }"
        :aria-checked="modelValue === n"
        role="radio"
        @click="pick(n)"
      >
        {{ n }}
      </button>
    </div>
    <p v-if="note" class="durak-count__note">{{ note }}</p>
  </div>
</template>

<style scoped>
.durak-count {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  min-width: 0;
}

.durak-count__legend {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 700;
  color: rgba(226, 232, 240, 0.92);
}

.durak-count__row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.durak-count__btn {
  min-width: 2.75rem;
  padding: 0.5rem 0.65rem;
  border-radius: var(--sa-radius-md, 10px);
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: color-mix(in srgb, #0f172a 78%, transparent);
  color: #e2e8f0;
  font-size: 0.95rem;
  font-weight: 800;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;
}

.durak-count__btn:hover {
  border-color: rgba(129, 140, 248, 0.55);
}

.durak-count__btn:focus-visible {
  outline: 2px solid rgba(129, 140, 248, 0.85);
  outline-offset: 2px;
}

.durak-count__btn--on {
  border-color: rgba(52, 211, 153, 0.65);
  background: color-mix(in srgb, #134e4a 55%, #0f172a);
  color: #a7f3d0;
  box-shadow: 0 0 0 1px rgba(45, 212, 191, 0.2);
}

.durak-count__note {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.4;
  color: rgba(226, 232, 240, 0.55);
  max-width: 36rem;
}
</style>
