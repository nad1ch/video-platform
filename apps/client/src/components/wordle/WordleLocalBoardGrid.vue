<script lang="ts">
import type { Feedback } from '@/wordle/wordleLogic'

export type WordleLocalBoardCell = {
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
  rows: WordleLocalBoardCell[][]
}>()
</script>

<template>
  <div
    class="wordle-page__wordle-board"
    :style="{ '--wordle-len': String(wordLength) }"
    role="grid"
    :aria-rowcount="maxAttempts"
    :aria-colcount="wordLength"
  >
    <div
      v-for="(row, ri) in rows"
      :key="`local-${roundId}-r-${ri}`"
      class="wordle-page__row wordle-page__row--tile"
      role="row"
    >
      <span
        v-for="cell in row"
        :key="`tile-${roundId}-${cell.rowIndex}-${cell.colIndex}`"
        class="wordle-page__cell wordle-page__cell--tile"
        :class="{
          'wordle-page__cell--empty': !cell.locked && !cell.letter,
          'wordle-page__cell--draft': !cell.locked && Boolean(cell.letter),
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
/* Local Wordle board tiles; vars --wordle-gap / --wordle-cell come from ancestor .wordle-page. */
.wordle-page__wordle-board {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--wordle-gap);
  width: 100%;
  max-width: calc(
    var(--wordle-len, 5) * var(--wordle-cell) + (var(--wordle-len, 5) - 1) * var(--wordle-gap)
  );
  margin-inline: auto;
}

.wordle-page__row {
  display: flex;
  gap: var(--wordle-gap);
}

.wordle-page__row--tile {
  justify-content: center;
  width: 100%;
}

.wordle-page__cell--tile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--wordle-cell);
  height: var(--wordle-cell);
  box-sizing: border-box;
  overflow: hidden;
  padding: clamp(1px, 0.12em, 3px);
  line-height: 1;
  font-size: min(
    clamp(1rem, 3.2vw, 1.9rem),
    calc(var(--wordle-cell) * 0.5)
  );
  font-weight: 700;
  border-radius: 2px;
  border: 2px solid var(--sa-color-border);
  background: transparent;
  color: var(--sa-color-text-main);
}

.wordle-page__cell--empty {
  border-color: var(--sa-color-border);
  background: transparent;
}

.wordle-page__cell--draft {
  border-color: color-mix(in srgb, var(--sa-color-border) 70%, var(--sa-color-text-muted));
  background: color-mix(in srgb, var(--sa-color-surface-raised) 40%, transparent);
}

.wordle-page__cell[data-f='correct'] {
  background: var(--sa-color-success);
  border-color: color-mix(in srgb, var(--sa-color-success) 65%, var(--sa-color-bg-deep));
  color: var(--sa-color-text-strong);
}

.wordle-page__cell[data-f='present'] {
  background: var(--sa-color-warning);
  border-color: color-mix(in srgb, var(--sa-color-warning) 55%, var(--sa-color-bg-deep));
  color: var(--sa-color-bg-deep);
}

.wordle-page__cell[data-f='absent'] {
  background: var(--sa-color-border);
  border-color: color-mix(in srgb, var(--sa-color-border) 85%, var(--sa-color-text-muted));
  color: var(--sa-color-text-strong);
}
</style>
