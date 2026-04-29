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
      'checkers-cell--dark': (row + col) % 2 === 1,
      'checkers-cell--light': (row + col) % 2 === 0,
      'checkers-cell--selected': selected,
      'checkers-cell--valid': validMove,
      'checkers-cell--capture': captureMove,
      'checkers-cell--winning': winningMove,
    }"
    type="button"
    role="gridcell"
    :aria-label="`Row ${row + 1}, column ${col + 1}`"
    :aria-selected="selected"
    @click="selectCell"
  >
    <Transition
      enter-active-class="transition-all duration-150 ease-out"
      enter-from-class="opacity-0 scale-75"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-75"
    >
      <CheckersPiece v-if="piece && !hidePiece" :piece="piece" :selected="selected" :flipped="flipped" />
    </Transition>
    <span v-if="!piece && validMove" class="checkers-cell__move-dot" aria-hidden="true" />
  </button>
</template>

<style scoped>
.checkers-cell {
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 0;
  cursor: pointer;
  transition: all 0.15s ease;
}

.checkers-cell--dark {
  background: rgb(46, 34, 62);
}

.checkers-cell--light {
  background: rgb(229, 229, 229);
}

.checkers-cell--selected::after,
.checkers-cell--valid::after {
  position: absolute;
  inset: 0.22rem;
  pointer-events: none;
  border-radius: 0.35rem;
  content: '';
}

.checkers-cell--selected::after {
  outline: 0.18rem solid rgba(255, 255, 255, 0.9);
  outline-offset: -0.18rem;
}

.checkers-cell--valid::after {
  background: rgba(255, 255, 255, 0.12);
  outline: 0.12rem solid rgba(255, 255, 255, 0.55);
  outline-offset: -0.12rem;
}

.checkers-cell--capture::after {
  background: rgba(248, 113, 113, 0.18);
  outline: 0.14rem solid rgba(248, 113, 113, 0.88);
  animation: checkers-capture-pulse 1.2s ease-in-out infinite;
}

.checkers-cell--winning::before {
  position: absolute;
  inset: 0.18rem;
  z-index: 1;
  pointer-events: none;
  border-radius: 0.45rem;
  background: rgba(168, 85, 247, 0.18);
  box-shadow:
    inset 0 0 0 0.14rem rgba(216, 180, 254, 0.72),
    0 0 22px rgba(34, 197, 94, 0.42);
  content: '';
  animation: checkers-winning-cell-pulse 0.9s ease-in-out 2;
}

.checkers-cell--valid:hover {
  z-index: 1;
  transform: scale(1.05);
  filter: brightness(1.1);
  box-shadow: 0 0 18px rgba(255, 255, 255, 0.12);
}

@keyframes checkers-capture-pulse {
  0%,
  100% {
    opacity: 0.72;
  }
  50% {
    opacity: 1;
  }
}

@keyframes checkers-winning-cell-pulse {
  0%,
  100% {
    opacity: 0.72;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.045);
  }
}

.checkers-cell:focus-visible {
  z-index: 1;
  outline: 2px solid var(--sa-color-primary-border);
  outline-offset: -2px;
}

.checkers-cell__move-dot {
  width: 28%;
  aspect-ratio: 1;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 0.18rem rgba(255, 255, 255, 0.18);
}
</style>
