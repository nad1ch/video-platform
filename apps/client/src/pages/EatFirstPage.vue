<script setup lang="ts">
import EatFirstGame from '@/features/eat-first/EatFirstGame.vue'
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="eat-page">
    <nav class="eat-page__nav" aria-label="StreamAssist navigation">
      <RouterLink class="eat-page__link" to="/">← Home</RouterLink>
      <RouterLink class="eat-page__link" to="/wordle">Wordle</RouterLink>
      <RouterLink class="eat-page__link" to="/call">Call</RouterLink>
    </nav>
    <div class="eat-page__body">
      <EatFirstGame />
    </div>
  </div>
</template>

<style scoped>
.eat-page {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: var(--sa-color-bg-deep, var(--bg));
  display: flex;
  flex-direction: column;
  overflow: auto;
}

.eat-page__nav {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  align-items: center;
  padding: 0.65rem 0.75rem;
  background: color-mix(in srgb, var(--sa-color-bg-deep, var(--bg)) 92%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--sa-color-border, var(--border));
}

.eat-page__link {
  font-size: 0.88rem;
  color: var(--sa-color-text-strong, var(--text-h));
  text-decoration: none;
  padding: 0.25rem 0.5rem;
  border-radius: var(--sa-radius-sm, 8px);
  background: color-mix(in srgb, var(--sa-color-surface, var(--code-bg)) 85%, transparent);
  border: 1px solid var(--sa-color-border, var(--border));
}

.eat-page__link:hover {
  border-color: var(--sa-color-primary-border, var(--accent-border));
  color: var(--sa-color-primary, var(--accent));
}

.eat-page__body {
  flex: 1;
  min-height: 0;
}
</style>
