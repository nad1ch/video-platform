<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'

defineProps<{
  to: RouteLocationRaw
}>()

const jackpotLetters = ['T', 'W', 'I', 'T', 'C', 'H'] as const
</script>

<template>
  <section class="app-economy" aria-labelledby="app-economy-title">
    <RouterLink class="app-economy__panel" :to="to" aria-label="Open Coin Hub">
      <h2 id="app-economy-title" class="app-economy__title">Economy</h2>

      <div class="app-economy__machine">
        <span class="app-economy__copy">Start earning</span>
        <span class="app-economy__jackpot" aria-hidden="true">Jackpot</span>
        <span class="app-economy__reel" aria-hidden="true">
          <span v-for="letter in jackpotLetters" :key="letter" class="app-economy__letter">
            {{ letter }}
          </span>
        </span>
        <span class="app-economy__lever" aria-hidden="true">
          <span class="app-economy__lever-stick" />
          <span class="app-economy__lever-knob" />
        </span>
      </div>
    </RouterLink>
  </section>
</template>

<style scoped>
.app-economy__panel {
  position: relative;
  display: block;
  min-height: clamp(8.6rem, 16vw, 11rem);
  padding: clamp(1.3rem, 2.4vw, 2rem);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1.8rem;
  background:
    radial-gradient(circle at 22% 22%, rgba(255, 255, 255, 0.2) 0 1px, transparent 1.6px),
    radial-gradient(circle at 82% 58%, rgba(255, 255, 255, 0.16) 0 1px, transparent 1.6px),
    linear-gradient(120deg, rgba(124, 77, 219, 0.24), rgba(60, 36, 99, 0.2));
  color: #fff;
  text-decoration: none;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.07),
    0 24px 80px rgba(9, 2, 20, 0.24);
  backdrop-filter: blur(18px);
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.app-economy__panel:hover {
  transform: translateY(-3px);
  border-color: rgba(255, 255, 255, 0.18);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 30px 90px rgba(9, 2, 20, 0.36);
}

.app-economy__panel:focus-visible {
  outline: 3px solid rgba(255, 218, 68, 0.86);
  outline-offset: 4px;
}

.app-economy__title {
  position: relative;
  z-index: 1;
  margin: 0 0 1rem;
  color: #fff;
  font-family: var(--sa-font-display, system-ui, sans-serif);
  font-size: 1.35rem;
  line-height: 1;
  text-align: center;
  text-transform: uppercase;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.app-economy__machine {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(8rem, 0.8fr) minmax(13rem, 1.3fr) auto;
  align-items: center;
  gap: clamp(0.8rem, 2vw, 1.5rem);
  min-height: 5.1rem;
  padding: 0.85rem 1rem;
  border: 5px solid rgba(255, 255, 255, 0.94);
  border-radius: 1.45rem;
  background:
    radial-gradient(circle at 14% 26%, rgba(255, 255, 255, 0.2) 0 1px, transparent 1.6px),
    linear-gradient(120deg, rgba(124, 77, 219, 0.14), rgba(60, 36, 99, 0.22));
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.1),
    0 18px 38px rgba(0, 0, 0, 0.16);
}

.app-economy__copy {
  min-width: 0;
  color: #fff;
  font-family: var(--sa-font-display, system-ui, sans-serif);
  font-size: 1.35rem;
  line-height: 1.08;
}

.app-economy__jackpot {
  position: absolute;
  left: min(73%, 27rem);
  top: 0.5rem;
  z-index: 2;
  padding: 0.12rem 0.7rem;
  border: 2px solid #7c4ddb;
  border-radius: 999px;
  background: rgba(255, 59, 48, 0.74);
  color: #fff;
  font-family: Georgia, serif;
  font-size: 0.8rem;
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
}

.app-economy__reel {
  display: grid;
  grid-template-columns: repeat(6, minmax(1.9rem, 1fr));
  overflow: hidden;
  border: 3px solid #66388f;
  border-radius: 0.85rem;
  background: #c9d6ff;
}

.app-economy__letter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.8rem;
  border-right: 1px solid #b3c2f5;
  background: #f7f8ff;
  color: rgba(87, 38, 130, 0.78);
  font-family: Georgia, serif;
  font-size: 1.75rem;
  font-weight: 900;
  line-height: 1;
}

.app-economy__letter:last-child {
  border-right: 0;
}

.app-economy__lever {
  position: relative;
  width: 1.35rem;
  height: 4.6rem;
  border-radius: 999px;
  background: rgba(150, 131, 180, 0.64);
}

.app-economy__lever-stick {
  position: absolute;
  left: 50%;
  top: -0.75rem;
  width: 0.34rem;
  height: 2.55rem;
  border-radius: 999px;
  background: #1a1133;
  transform: translateX(-50%);
}

.app-economy__lever-knob {
  position: absolute;
  left: 50%;
  top: -1.55rem;
  width: 1.2rem;
  height: 1.2rem;
  border-radius: 999px;
  background: rgba(255, 59, 48, 0.74);
  transform: translateX(-50%);
}

@media (max-width: 620px) {
  .app-economy__title {
    font-size: 1.1rem;
  }

  .app-economy__copy {
    font-size: 1.15rem;
  }

  .app-economy__machine {
    grid-template-columns: 1fr auto;
  }

  .app-economy__copy {
    grid-column: 1 / -1;
    max-width: 9.5rem;
  }

  .app-economy__reel {
    grid-template-columns: repeat(6, minmax(1.45rem, 1fr));
  }

  .app-economy__jackpot {
    right: 4.25rem;
    left: auto;
    font-size: 0.68rem;
  }
}
</style>
