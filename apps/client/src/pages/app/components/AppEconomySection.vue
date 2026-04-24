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
  max-width: 100%;
  min-height: clamp(7.6rem, 12.5vw, 9.55rem);
  padding: clamp(1.05rem, 1.8vw, 1.55rem);
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1.8rem;
  background:
    radial-gradient(circle at 22% 22%, rgba(255, 255, 255, 0.2) 0 1px, transparent 1.6px),
    radial-gradient(circle at 82% 58%, rgba(255, 255, 255, 0.16) 0 1px, transparent 1.6px),
    linear-gradient(120deg, rgba(124, 77, 219, 0.26), rgba(60, 36, 99, 0.22)),
    rgba(28, 12, 52, 0.36);
  color: #fff;
  text-decoration: none;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.13),
    inset 0 -1px 0 rgba(255, 255, 255, 0.05),
    0 24px 80px rgba(9, 2, 20, 0.24);
  -webkit-backdrop-filter: blur(22px) saturate(1.08);
  backdrop-filter: blur(22px) saturate(1.08);
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
  margin: 0 0 1.1rem;
  color: #fff;
  font-family: var(--app-home-display, var(--sa-font-display, system-ui, sans-serif));
  font-size: 1.28rem;
  line-height: 1;
  text-align: center;
  text-transform: uppercase;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.app-economy__machine {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.35fr) auto;
  align-items: center;
  gap: clamp(0.65rem, 1.5vw, 1.2rem);
  min-width: 0;
  max-width: 100%;
  min-height: 4.35rem;
  padding: 0.7rem 0.85rem;
  box-sizing: border-box;
  border: 4px solid rgba(255, 255, 255, 0.94);
  border-radius: 1.35rem;
  background:
    radial-gradient(circle at 14% 26%, rgba(255, 255, 255, 0.2) 0 1px, transparent 1.6px),
    linear-gradient(120deg, rgba(124, 77, 219, 0.14), rgba(60, 36, 99, 0.22));
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.1),
    0 18px 38px rgba(0, 0, 0, 0.16);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
}

.app-economy__copy {
  min-width: 0;
  color: #fff;
  font-family: var(--app-home-display, var(--sa-font-display, system-ui, sans-serif));
  font-size: 1.15rem;
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
  font-size: 0.66rem;
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
}

.app-economy__reel {
  display: grid;
  min-width: 0;
  max-width: 100%;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  overflow: hidden;
  border: 3px solid #66388f;
  border-radius: 0.85rem;
  background: #c9d6ff;
}

.app-economy__letter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.35rem;
  border-right: 1px solid #b3c2f5;
  background: #f7f8ff;
  color: rgba(87, 38, 130, 0.78);
  font-family: Georgia, serif;
  font-size: 1.45rem;
  font-weight: 900;
  line-height: 1;
}

.app-economy__letter:last-child {
  border-right: 0;
}

.app-economy__lever {
  position: relative;
  width: 1.15rem;
  height: 3.85rem;
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

@media (min-width: 621px) and (max-width: 1200px) {
  .app-economy__panel {
    min-height: clamp(7.2rem, 18vh, 8.8rem);
    padding: 0.9rem;
  }

  .app-economy__title {
    margin-bottom: 0.75rem;
    font-size: 1.05rem;
  }

  .app-economy__machine {
    min-height: 3.3rem;
    border-width: 3px;
  }

  .app-economy__copy {
    font-size: 0.95rem;
  }

  .app-economy__letter {
    min-height: 1.95rem;
    font-size: 1.2rem;
  }

  .app-economy__lever {
    height: 3.15rem;
  }
}

@media (min-width: 621px) and (max-width: 900px) {
  .app-economy__panel {
    min-height: auto;
    padding: 1.25rem;
  }

  .app-economy__title {
    font-size: 1.25rem;
  }

  .app-economy__machine {
    min-height: 4rem;
    border-width: 4px;
  }

  .app-economy__copy {
    font-size: 1.15rem;
  }

  .app-economy__letter {
    min-height: 2.25rem;
    font-size: 1.4rem;
  }
}
</style>
