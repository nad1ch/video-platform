<script setup lang="ts">
import { useEatFirstLocalDemo } from './useEatFirstLocalDemo'

const { options, vote, reset, totalVotes } = useEatFirstLocalDemo([
  { id: 'a', label: 'Pizza' },
  { id: 'b', label: 'Sushi' },
  { id: 'c', label: 'Tacos' },
])
</script>

<template>
  <div class="eat-game">
    <header class="eat-game__head">
      <h1 class="eat-game__title">Eat First</h1>
      <p class="eat-game__lead">
        In-app shell for the stream voting game. Replace this component with UI migrated from
        <strong>eat-first-overlay</strong> (keep everything under
        <code class="eat-game__code">src/features/eat-first/</code>).
      </p>
    </header>

    <section class="eat-game__panel" aria-label="Demo vote">
      <p class="eat-game__hint">Local demo only — no server / Firebase / shared WS.</p>
      <ul class="eat-game__list">
        <li v-for="o in options" :key="o.id" class="eat-game__row">
          <button type="button" class="eat-game__vote" @click="vote(o.id)">
            {{ o.label }}
          </button>
          <span class="eat-game__count">{{ o.votes }}</span>
        </li>
      </ul>
      <p class="eat-game__total">Total votes: {{ totalVotes }}</p>
      <button type="button" class="eat-game__reset" @click="reset">Reset demo</button>
    </section>
  </div>
</template>

<style scoped>
.eat-game {
  max-width: 36rem;
  margin: 0 auto;
  padding: 2rem 1rem 3rem;
  color: var(--sa-color-text-strong, var(--text-h));
}

.eat-game__head {
  margin-bottom: 1.5rem;
  text-align: center;
}

.eat-game__title {
  margin: 0 0 0.5rem;
  font-size: 1.75rem;
}

.eat-game__lead {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.45;
  color: var(--sa-color-text-muted, var(--text));
}

.eat-game__code {
  font-family: var(--sa-font-mono, var(--mono));
  font-size: 0.82rem;
}

.eat-game__panel {
  padding: 1.25rem;
  border-radius: var(--sa-radius-lg, 16px);
  border: 1px solid var(--sa-color-border, var(--border));
  background: var(--sa-color-surface, var(--code-bg));
  box-shadow: var(--shadow, var(--sa-shadow-elevated));
}

.eat-game__hint {
  margin: 0 0 1rem;
  font-size: 0.8rem;
  color: var(--sa-color-text-muted, var(--text));
}

.eat-game__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.eat-game__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.eat-game__vote {
  flex: 1;
  font: inherit;
  text-align: left;
  padding: 0.55rem 0.85rem;
  border-radius: var(--sa-radius-sm, 8px);
  border: 1px solid var(--sa-color-border, var(--border));
  background: var(--sa-color-surface-raised, var(--bg));
  color: var(--sa-color-text-strong, var(--text-h));
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.eat-game__vote:hover {
  border-color: var(--sa-color-primary-border, var(--accent-border));
  background: var(--sa-color-primary-soft, var(--accent-bg));
}

.eat-game__count {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  min-width: 2rem;
  text-align: right;
  color: var(--sa-color-primary, var(--accent));
}

.eat-game__total {
  margin: 1rem 0 0.75rem;
  font-size: 0.9rem;
  color: var(--sa-color-text-muted, var(--text));
}

.eat-game__reset {
  font: inherit;
  font-size: 0.85rem;
  padding: 0.35rem 0.75rem;
  border-radius: var(--sa-radius-sm, 8px);
  border: 1px solid var(--sa-color-border, var(--border));
  background: transparent;
  color: var(--sa-color-text-muted, var(--text));
  cursor: pointer;
}

.eat-game__reset:hover {
  color: var(--sa-color-text-strong, var(--text-h));
  border-color: var(--sa-color-text-muted, var(--text));
}
</style>
