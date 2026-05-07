<script setup lang="ts">
import { computed } from 'vue'
import type { DurakCard as DurakCardModel } from '../core/cardTypes'
import DurakCard from './DurakCard.vue'

const props = withDefaults(
  defineProps<{
    cards: DurakCardModel[]
    hidden?: boolean
    selectable?: boolean
    selectedCardId?: string | null
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    hidden: false,
    selectable: false,
    selectedCardId: null,
    size: 'md',
  },
)

const emit = defineEmits<{
  select: [id: string]
}>()

const count = computed(() => props.cards.length)

const fanRotate = computed(() => {
  const n = Math.max(count.value, 1)
  const spread = Math.min(42, 8 + n * 5)
  return spread
})

function onCardClick(id: string) {
  if (!props.selectable || props.hidden) return
  emit('select', id)
}
</script>

<template>
  <div class="durak-hand" :class="{ 'durak-hand--hidden': hidden, 'durak-hand--fan': count > 1 }" role="group">
    <div
      v-for="(card, index) in cards"
      :key="card.id"
      class="durak-hand__slot"
      :style="
        count > 1
          ? {
              '--i': index,
              '--n': count,
              '--spread': `${fanRotate}deg`,
            }
          : undefined
      "
    >
      <DurakCard
        :card="card"
        :hidden="hidden"
        :selected="selectable && !hidden && selectedCardId === card.id"
        :disabled="hidden || !selectable"
        :size="size"
        @click="onCardClick(card.id)"
      />
    </div>
  </div>
</template>

<style scoped>
.durak-hand {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 0.15rem;
  min-height: 5.5rem;
  padding-inline: var(--sa-space-3, 0.75rem);
}

.durak-hand--fan .durak-hand__slot {
  margin-inline: -0.55rem;
  transform: rotate(calc((var(--i) - (var(--n) - 1) / 2) * (var(--spread) / max(var(--n), 1))));
  transform-origin: 50% 100%;
  transition: transform 0.2s ease;
}

.durak-hand--fan .durak-hand__slot:hover {
  z-index: 2;
}

.durak-hand--hidden.durak-hand--fan .durak-hand__slot {
  margin-inline: -0.65rem;
}
</style>
