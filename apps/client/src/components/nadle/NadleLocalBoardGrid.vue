<script lang="ts">
import type { Feedback } from '@/nadle/nadleLogic'

export type NadleLocalBoardCell = {
  letter: string
  feedback: Feedback | null
  locked: boolean
  rowIndex: number
  colIndex: number
}
</script>

<script setup lang="ts">
defineProps<{
  roundId: number
  wordLength: number
  maxAttempts: number
  rows: NadleLocalBoardCell[][]
}>()

const emit = defineEmits<{
  focusInput: []
}>()
</script>

<template>
  <div
    class="nadle-page__guess-board"
    :style="{ '--nadle-len': String(wordLength) }"
    role="grid"
    :aria-rowcount="maxAttempts"
    :aria-colcount="wordLength"
    @pointerdown="emit('focusInput')"
    @click="emit('focusInput')"
  >
    <div
      v-for="(row, ri) in rows"
      :key="`local-${roundId}-r-${ri}`"
      class="nadle-page__row nadle-page__row--tile"
      role="row"
    >
      <span
        v-for="cell in row"
        :key="`tile-${roundId}-${cell.rowIndex}-${cell.colIndex}`"
        class="nadle-page__cell nadle-page__cell--tile"
        :class="{
          'nadle-page__cell--empty': !cell.locked && !cell.letter,
          'nadle-page__cell--draft': !cell.locked && Boolean(cell.letter),
        }"
        :style="{ '--nadle-reveal-delay': `${cell.colIndex * 86}ms` }"
        :data-f="cell.feedback ?? undefined"
        role="gridcell"
      >
        {{ cell.letter }}
      </span>
    </div>
  </div>
</template>

<style scoped>
/* Local guess grid tiles; vars --nadle-gap / --nadle-cell come from ancestor .nadle-page. */
.nadle-page__guess-board {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--nadle-gap);
  width: 100%;
  max-width: calc(
    var(--nadle-len, 5) * var(--nadle-cell) + (var(--nadle-len, 5) - 1) * var(--nadle-gap)
  );
  margin-inline: auto;
  filter: drop-shadow(0 10px 22px rgba(4, 1, 12, 0.12));
  cursor: text;
  touch-action: manipulation;
}

.nadle-page__row {
  display: flex;
  gap: var(--nadle-gap);
}

.nadle-page__row--tile {
  justify-content: center;
  width: 100%;
}

.nadle-page__cell--tile {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--nadle-cell);
  height: var(--nadle-cell);
  box-sizing: border-box;
  overflow: hidden;
  padding: clamp(1px, 0.12em, 3px);
  line-height: 1;
  font-size: min(
    clamp(1rem, 3.2vw, 2rem),
    calc(var(--nadle-cell) * 0.54)
  );
  font-family: "Climate Crisis", var(--sa-font-display);
  font-weight: 400;
  letter-spacing: 0;
  border-radius: 15.535px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 48%),
    rgba(102, 56, 143, 0.33);
  color: #ffffff;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.055),
    inset 0 -10px 18px rgba(0, 0, 0, 0.08);
}

.nadle-page__cell--tile[data-f] {
  animation: nadle-cell-reveal 0.82s cubic-bezier(0.22, 0.78, 0.24, 1) both;
  animation-delay: var(--nadle-reveal-delay, 0ms);
  transform-origin: center;
  will-change: transform, filter;
}

.nadle-page__cell--tile[data-f]::before {
  position: absolute;
  inset: -45%;
  content: '';
  pointer-events: none;
  background: linear-gradient(
    115deg,
    transparent 28%,
    rgba(255, 255, 255, 0.26) 46%,
    rgba(255, 255, 255, 0.08) 54%,
    transparent 70%
  );
  opacity: 0;
  transform: translateX(-75%) rotate(18deg);
  animation: nadle-cell-reveal-shine 0.68s ease-out both;
  animation-delay: calc(var(--nadle-reveal-delay, 0ms) + 0.24s);
}

.nadle-page__cell--empty {
  border-color: rgba(255, 255, 255, 0.13);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.025), transparent 45%),
    rgba(102, 56, 143, 0.33);
}

.nadle-page__cell--draft {
  border-color: rgba(255, 255, 255, 0.22);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.055), transparent 46%),
    rgba(102, 56, 143, 0.42);
  color: #ffffff;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 -10px 18px rgba(0, 0, 0, 0.1);
}

.nadle-page__cell[data-f='correct'] {
  background: rgba(105, 143, 56, 0.49);
  border-color: rgba(169, 209, 111, 0.34);
  color: #ffffff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.nadle-page__cell[data-f='present'] {
  background: rgba(167, 156, 59, 0.63);
  border-color: rgba(255, 212, 85, 0.28);
  color: #ffffff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.nadle-page__cell[data-f='absent'] {
  background: rgba(102, 56, 143, 0.33);
  border-color: rgba(255, 255, 255, 0.14);
  color: #ffffff;
}

@keyframes nadle-cell-reveal {
  0% {
    opacity: 0.86;
    transform: perspective(720px) translateY(0) rotateX(0deg) scale(0.98);
    filter: brightness(1);
  }

  34% {
    color: transparent;
    transform: perspective(720px) translateY(-3px) rotateX(58deg) scale(0.975);
    filter: brightness(1.14) saturate(1.08);
  }

  66% {
    color: #ffffff;
    transform: perspective(720px) translateY(-1px) rotateX(-7deg) scale(1.025);
    filter: brightness(1.22) saturate(1.12);
  }

  84% {
    transform: perspective(720px) translateY(0) rotateX(3deg) scale(0.998);
  }

  100% {
    opacity: 1;
    transform: perspective(720px) translateY(0) rotateX(0deg) scale(1);
    filter: brightness(1) saturate(1);
  }
}

@keyframes nadle-cell-reveal-shine {
  0% {
    opacity: 0;
    transform: translateX(-75%) rotate(18deg);
  }

  42% {
    opacity: 0.8;
  }

  100% {
    opacity: 0;
    transform: translateX(75%) rotate(18deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .nadle-page__cell--tile[data-f],
  .nadle-page__cell--tile[data-f]::before {
    animation: none;
  }
}
</style>
