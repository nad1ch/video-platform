<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="home">
    <h1 class="home__title">StreamAssist</h1>
    <p class="home__tag">Interactive tools for streams</p>
    <div class="home__cards">
      <div class="home__card home__card--disabled" aria-disabled="true">
        <h2 class="home__card-title">Video call</h2>
        <p class="home__card-text">Coming soon</p>
      </div>
      <RouterLink to="/wordle" class="home__card home__card--link">
        <h2 class="home__card-title">Stream Wordle</h2>
        <p class="home__card-text">Play with Twitch chat</p>
      </RouterLink>
      <RouterLink to="/eat" class="home__card home__card--link">
        <h2 class="home__card-title">Eat First</h2>
        <p class="home__card-text">Stream voting game (overlay)</p>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: clamp(4rem, 15vh, 7.5rem);
  padding: 0 1rem 3rem;
}

.home__title {
  margin: 0;
  font-size: clamp(1.75rem, 4vw, 2.25rem);
  color: var(--text-h);
}

.home__tag {
  margin: 0.5rem 0 0;
  font-size: 1rem;
  color: var(--text);
}

.home__cards {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1.25rem;
  margin-top: 2.5rem;
}

.home__card {
  width: min(100%, 260px);
  padding: 1.25rem 1.35rem;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--social-bg);
  color: var(--text-h);
  box-shadow: var(--shadow);
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.home__card--link {
  text-decoration: none;
  color: inherit;
  display: block;
}

.home__card--link:hover {
  transform: translateY(-4px);
  border-color: var(--accent-border);
}

.home__card--disabled {
  opacity: 0.5;
  pointer-events: none;
}

.home__card-title {
  margin: 0 0 0.35rem;
  font-size: 1.1rem;
}

.home__card-text {
  margin: 0;
  font-size: 0.95rem;
  color: var(--text);
}
</style>
