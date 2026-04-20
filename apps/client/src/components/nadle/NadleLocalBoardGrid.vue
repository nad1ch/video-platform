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
</script>

<template>
  <div
    class="nadle-page__guess-board"
    :style="{ '--nadle-len': String(wordLength) }"
    role="grid"
    :aria-rowcount="maxAttempts"
    :aria-colcount="wordLength"
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
  border: 2px solid var(--sa-color-border);
  background: transparent;
  color: var(--sa-color-text-main);
}

.nadle-page__cell--empty {
  border-color: var(--sa-color-border);
  background: transparent;
}

.nadle-page__cell--draft {
  border-color: color-mix(in srgb, var(--sa-color-border) 70%, var(--sa-color-text-muted));
  background: color-mix(in srgb, var(--sa-color-surface-raised) 40%, transparent);
}

.nadle-page__cell[data-f='correct'] {
  background: var(--sa-color-success);
  border-color: color-mix(in srgb, var(--sa-color-success) 65%, var(--sa-color-bg-deep));
  color: var(--sa-color-text-strong);
}

.nadle-page__cell[data-f='present'] {
  background: var(--sa-color-warning);
  border-color: color-mix(in srgb, var(--sa-color-warning) 55%, var(--sa-color-bg-deep));
  color: var(--sa-color-bg-deep);
}

.nadle-page__cell[data-f='absent'] {
  background: var(--sa-color-border);
  border-color: color-mix(in srgb, var(--sa-color-border) 85%, var(--sa-color-text-muted));
  color: var(--sa-color-text-strong);
}
</style>
