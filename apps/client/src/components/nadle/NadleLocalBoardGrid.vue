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
  filter: drop-shadow(0 10px 22px rgba(4, 1, 12, 0.18));
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
    clamp(1rem, 3.2vw, 1.9rem),
    calc(var(--nadle-cell) * 0.5)
  );
  font-weight: 700;
  border-radius: 2px;
  border: 2px solid color-mix(in srgb, var(--sa-color-border) 82%, rgba(255, 255, 255, 0.18));
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 42%),
    color-mix(in srgb, var(--sa-color-surface-raised) 24%, transparent);
  color: var(--sa-color-text-main);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.055),
    inset 0 -10px 18px rgba(0, 0, 0, 0.08);
}

.nadle-page__cell--empty {
  border-color: color-mix(in srgb, var(--sa-color-border) 76%, rgba(255, 255, 255, 0.22));
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.025), transparent 45%),
    color-mix(in srgb, var(--sa-color-surface-raised) 14%, transparent);
}

.nadle-page__cell--draft {
  border-color: color-mix(in srgb, var(--sa-color-primary-border) 54%, var(--sa-color-border));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--sa-color-primary) 16%, rgba(255, 255, 255, 0.035)), color-mix(in srgb, var(--sa-color-primary) 8%, var(--sa-color-surface-raised)));
  color: var(--sa-color-text-strong);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 -10px 18px rgba(0, 0, 0, 0.1);
}

.nadle-page__cell[data-f='correct'] {
  background: var(--sa-color-success);
  border-color: color-mix(in srgb, var(--sa-color-success) 76%, var(--sa-color-bg-deep));
  color: var(--sa-color-text-strong);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--sa-color-success) 26%, transparent);
}

.nadle-page__cell[data-f='present'] {
  background: var(--sa-color-warning);
  border-color: color-mix(in srgb, var(--sa-color-warning) 72%, var(--sa-color-bg-deep));
  color: var(--sa-color-bg-deep);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--sa-color-warning) 24%, transparent);
}

.nadle-page__cell[data-f='absent'] {
  background: color-mix(in srgb, var(--sa-color-border) 86%, var(--sa-color-surface-raised));
  border-color: color-mix(in srgb, var(--sa-color-border) 70%, var(--sa-color-text-muted));
  color: var(--sa-color-text-strong);
}
</style>
