<script setup lang="ts">
import type { CheckersPiece as CheckersPieceType, CheckersPosition } from '../core/types'
import CheckersPiece from './CheckersPiece.vue'

const props = defineProps<{
  row: number
  col: number
  piece: CheckersPieceType | null
  selected: boolean
  validMove: boolean
  captureMove: boolean
  winningMove: boolean
  hidePiece: boolean
  flipped?: boolean
}>()

const emit = defineEmits<{
  select: [pos: CheckersPosition]
}>()

function selectCell(): void {
  emit('select', { row: props.row, col: props.col })
}
</script>

<template>
  <button
    class="checkers-cell"
    :class="{
      'checkers-cell--dark': (props.row + props.col) % 2 === 1,
      'checkers-cell--light': (props.row + props.col) % 2 === 0,
      'checkers-cell--selected': props.selected,
      'checkers-cell--valid': props.validMove,
      'checkers-cell--capture': props.captureMove,
      'checkers-cell--winning': props.winningMove,
    }"
    type="button"
    role="gridcell"
    :aria-label="`Row ${props.row + 1}, column ${props.col + 1}`"
    :aria-selected="props.selected"
    @click="selectCell"
  >
    <span class="checkers-cell__grain" aria-hidden="true" />
    <span v-if="props.winningMove" class="checkers-cell__winning-overlay" aria-hidden="true" />
    <Transition
      enter-active-class="transition-all duration-150 ease-out"
      enter-from-class="opacity-0 scale-75"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-75"
    >
      <CheckersPiece v-if="props.piece && !props.hidePiece" :piece="props.piece" :selected="props.selected" :flipped="props.flipped" />
    </Transition>
    <span v-if="!props.piece && props.validMove" class="checkers-cell__move-dot" aria-hidden="true" />
  </button>
</template>

<style scoped>
.checkers-cell {
  --cell-line: rgba(5, 3, 12, 0.68);

  position: relative;
  display: grid;
  overflow: hidden;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  place-items: center;
  border: 1px solid var(--cell-line);
  padding: 0;
  cursor: pointer;
  transition:
    transform 165ms ease,
    filter 165ms ease,
    border-color 165ms ease;
}

.checkers-cell__grain {
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: 0.34;
  background-image:
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.014) 0 5px, transparent 6px),
    repeating-linear-gradient(-52deg, rgba(0, 0, 0, 0.07) 0 7px, transparent 8px);
  mix-blend-mode: soft-light;
  pointer-events: none;
}

.checkers-cell--light {
  box-shadow:
    inset 0 1px rgba(255, 255, 255, 0.08),
    inset -1px -1px rgba(12, 4, 24, 0.24);
  background:
    radial-gradient(circle at 28% 24%, rgba(255, 255, 255, 0.12) 0%, transparent 34%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.09) 0%, transparent 42%),
    linear-gradient(315deg, rgba(0, 0, 0, 0.18) 0%, transparent 55%),
    linear-gradient(165deg, #68457d 0%, #5a3a70 52%, #4b3262 100%);
}

.checkers-cell--dark {
  box-shadow:
    inset 0 1px rgba(255, 255, 255, 0.045),
    inset -1px -1px rgba(0, 0, 0, 0.4);
  background:
    radial-gradient(circle at 24% 20%, rgba(255, 255, 255, 0.05) 0%, transparent 32%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, transparent 46%),
    linear-gradient(315deg, rgba(0, 0, 0, 0.32) 0%, transparent 58%),
    linear-gradient(-18deg, #211631 0%, #191126 48%, #130d20 100%);
}

.checkers-cell--selected::after,
.checkers-cell--valid::after {
  position: absolute;
  inset: 0.2rem;
  z-index: 3;
  border-radius: 0.06rem;
  pointer-events: none;
  content: '';
}

.checkers-cell--selected::after {
  border: none;
  box-shadow:
    0 0 0 3px rgba(190, 110, 255, 0.65),
    0 0 18px rgba(175, 75, 255, 0.55),
    inset 0 0 24px rgba(160, 80, 255, 0.12);
}

.checkers-cell--valid:not(.checkers-cell--capture)::after {
  background: rgba(180, 130, 255, 0.08);
  box-shadow:
    inset 0 0 22px rgba(150, 90, 220, 0.1),
    0 0 0 1px rgba(210, 175, 255, 0.22);
}

.checkers-cell--capture::after {
  background:
    radial-gradient(circle at 50% 50%, rgba(200, 80, 200, 0.16) 0%, transparent 68%),
    rgba(140, 60, 180, 0.12);
  box-shadow:
    inset 0 0 34px rgba(160, 50, 200, 0.22),
    0 0 0 1px rgba(240, 120, 220, 0.38);
  animation: checkers-capture-pulse-premium 1.2s ease-in-out infinite;
}

.checkers-cell__winning-overlay {
  position: absolute;
  inset: 0.12rem;
  z-index: 1;
  pointer-events: none;
  border-radius: 1px;
  background: rgba(160, 100, 240, 0.09);
  box-shadow:
    inset 0 0 34px rgba(190, 130, 255, 0.14),
    0 0 0 0.055rem rgba(210, 160, 255, 0.32);
  animation: checkers-winning-cell-pulse 0.9s ease-in-out 2;
}

.checkers-cell:hover :deep(.checkers-piece:not(.checkers-piece--selected)) {
  transform: translateY(-1px) scale(1.02);
  filter: brightness(1.06);
  transition:
    transform 165ms ease,
    filter 165ms ease,
    box-shadow 165ms ease;
}

.checkers-cell:hover :deep(.checkers-piece--flipped-visual:not(.checkers-piece--selected)) {
  transform: rotate(180deg) translateY(1px) scale(1.02);
}

.checkers-cell--valid:hover:not(.checkers-cell--selected) {
  z-index: 1;
  filter: brightness(1.05);
}

.checkers-cell--capture:hover:not(.checkers-cell--selected) {
  z-index: 1;
  filter: brightness(1.05);
}

@keyframes checkers-capture-pulse-premium {
  0%,
  100% {
    opacity: 0.78;
  }

  50% {
    opacity: 1;
  }
}

@keyframes checkers-winning-cell-pulse {
  0%,
  100% {
    opacity: 0.68;
    transform: scale(1);
  }

  50% {
    opacity: 1;
    transform: scale(1.015);
  }
}

.checkers-cell:focus-visible {
  z-index: 1;
  outline: 2px solid rgba(200, 130, 255, 0.85);
  outline-offset: -2px;
}

.checkers-cell__move-dot {
  position: relative;
  z-index: 4;
  width: 20%;
  min-width: 8px;
  max-width: 24%;
  aspect-ratio: 1;
  border-radius: 999px;
  background: rgba(220, 190, 255, 0.65);
  box-shadow:
    0 0 0 1px rgba(210, 160, 255, 0.35),
    0 2px 8px rgba(40, 0, 70, 0.35);
}

@media (prefers-reduced-motion: reduce) {
  .checkers-cell--capture::after {
    animation: none;
  }

  .checkers-cell__winning-overlay {
    animation: none;
  }

  .checkers-cell:hover :deep(.checkers-piece) {
    transform: none !important;
    filter: none !important;
  }
}
</style>
