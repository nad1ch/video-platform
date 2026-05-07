<script setup lang="ts">
import type { DurakCard as DurakCardModel } from '../core/cardTypes'

const props = withDefaults(
  defineProps<{
    card: DurakCardModel
    hidden?: boolean
    selected?: boolean
    disabled?: boolean
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    hidden: false,
    selected: false,
    disabled: false,
    size: 'md',
  },
)

const emit = defineEmits<{
  click: [id: string]
}>()

function onClick() {
  if (props.disabled) return
  emit('click', props.card.id)
}

const suitSymbol: Record<DurakCardModel['suit'], string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
}

const isRed = (s: DurakCardModel['suit']) => s === 'hearts' || s === 'diamonds'
</script>

<template>
  <button
    type="button"
    class="durak-card"
    :class="[
      `durak-card--${size}`,
      { 'durak-card--hidden': hidden, 'durak-card--selected': selected, 'durak-card--disabled': disabled },
    ]"
    :disabled="disabled"
    :aria-label="hidden ? 'Hidden card' : `${card.rank} of ${card.suit}`"
    @click="onClick"
  >
    <template v-if="hidden">
      <span class="durak-card__back" aria-hidden="true">
        <span class="durak-card__back-inner" />
      </span>
    </template>
    <template v-else>
      <span class="durak-card__corner durak-card__corner--tl" :class="{ 'durak-card__suit--red': isRed(card.suit) }">
        <span class="durak-card__rank">{{ card.rank }}</span>
        <span class="durak-card__suit">{{ suitSymbol[card.suit] }}</span>
      </span>
      <span class="durak-card__center" :class="{ 'durak-card__suit--red': isRed(card.suit) }" aria-hidden="true">
        {{ suitSymbol[card.suit] }}
      </span>
      <span class="durak-card__corner durak-card__corner--br" :class="{ 'durak-card__suit--red': isRed(card.suit) }">
        <span class="durak-card__rank">{{ card.rank }}</span>
        <span class="durak-card__suit">{{ suitSymbol[card.suit] }}</span>
      </span>
    </template>
  </button>
</template>

<style scoped>
.durak-card {
  position: relative;
  flex-shrink: 0;
  border: none;
  padding: 0;
  cursor: pointer;
  border-radius: var(--sa-radius-md, 10px);
  background: linear-gradient(165deg, #f8fafc 0%, #e2e8f0 45%, #cbd5e1 100%);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.65) inset,
    0 4px 12px rgba(0, 0, 0, 0.35);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
  color: #0f172a;
  font-family: ui-sans-serif, system-ui, sans-serif;
}

.durak-card--sm {
  width: 2.5rem;
  height: 3.5rem;
  font-size: 0.65rem;
}

.durak-card--md {
  width: 3.25rem;
  height: 4.55rem;
  font-size: 0.78rem;
}

.durak-card--lg {
  width: 3.85rem;
  height: 5.35rem;
  font-size: 0.88rem;
}

.durak-card:hover:not(.durak-card--disabled):not(.durak-card--hidden) {
  transform: translateY(-6px) scale(1.02);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.75) inset,
    0 10px 22px rgba(0, 0, 0, 0.45);
}

.durak-card--selected {
  outline: 2px solid color-mix(in srgb, var(--sa-color-primary, #8b5cf6) 85%, white);
  outline-offset: 2px;
  transform: translateY(-4px);
}

.durak-card--disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

.durak-card--hidden {
  cursor: default;
  background: linear-gradient(145deg, #1e3a5f 0%, #0f172a 50%, #172554 100%);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.08) inset,
    0 4px 14px rgba(0, 0, 0, 0.5);
}

.durak-card--hidden:hover {
  transform: none;
}

.durak-card__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: inherit;
}

.durak-card__back-inner {
  width: 72%;
  height: 82%;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background:
    repeating-linear-gradient(
      -12deg,
      transparent,
      transparent 4px,
      rgba(148, 163, 184, 0.12) 4px,
      rgba(148, 163, 184, 0.12) 5px
    ),
    linear-gradient(160deg, rgba(99, 102, 241, 0.25), transparent);
}

.durak-card__corner {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.05;
  font-weight: 700;
}

.durak-card__corner--tl {
  top: 0.28em;
  left: 0.32em;
}

.durak-card__corner--br {
  bottom: 0.28em;
  right: 0.32em;
  transform: rotate(180deg);
}

.durak-card__center {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.85em;
  opacity: 0.22;
  font-weight: 700;
}

.durak-card__suit--red {
  color: #b91c1c;
}

.durak-card__rank {
  font-size: 1em;
}

.durak-card__suit {
  font-size: 0.95em;
}
</style>
