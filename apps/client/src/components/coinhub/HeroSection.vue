<script setup lang="ts">
import { computed } from 'vue'
import '@/styles/coinhub-design-system.css'

/**
 * Full-viewport-width hero. Bitmap + lighting via CSS `background` (no <img>).
 * Subtle motion: slow bg drift, ::before gold pulse, lightweight particles (transform/opacity only).
 */
const PARTICLE_COUNT = 20

const props = withDefaults(
  defineProps<{
    /** File under `public/` (e.g. `assets/hero-3200x1000.png`) */
    backgroundPath?: string
  }>(),
  { backgroundPath: 'assets/hero-3200x1000.png' },
)

const sectionStyle = computed(() => {
  const base = import.meta.env.BASE_URL || '/'
  const root = base.endsWith('/') ? base : `${base}/`
  return {
    '--hero-poster': `url('${root}${props.backgroundPath}')`,
  } as const
})

/** Deterministic placement — stable across renders, no `random()` in CSS. */
function particleMotionStyle(i: number): Record<string, string> {
  const n = i + 1
  const left = 6 + ((n * 37) % 86)
  const top = 10 + ((n * 29) % 78)
  const durationS = 5 + (n % 4)
  const delayS = (n * 0.31) % 2.4
  return {
    left: `${left}%`,
    top: `${top}%`,
    animationDuration: `${durationS}s`,
    animationDelay: `${delayS.toFixed(2)}s`,
  }
}
</script>

<template>
  <div class="hero-wrapper">
    <section
      class="hero w-full min-w-0"
      :style="sectionStyle"
    >
      <div
        class="hero__particles"
        aria-hidden="true"
      >
        <span
          v-for="i in PARTICLE_COUNT"
          :key="i"
          class="hero__particle"
          :style="particleMotionStyle(i - 1)"
        />
      </div>
      <div class="hero__content">
        <slot />
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero-wrapper {
  max-width: 1320px;
  margin: 20px auto;
  padding: 0 16px;
  box-sizing: border-box;
}

/* Animate only art-layer X; gradients stay fixed. */
@property --hero-bg-x {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 65%;
}

.hero {
  position: relative;
  width: 100%;
  box-sizing: border-box;
  height: 300px;
  padding: 24px 0;
  overflow: hidden;
  border-radius: 20px;
  isolation: isolate;
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow:
    0 0 0 1px rgba(255, 180, 0, 0.1),
    0 12px 48px rgba(0, 0, 0, 0.65);
  background-color: #080614;
  /* Art: nudged so chest isn’t in the CTA gap; see --hero-bg-x */
  --hero-bg-x: 65%;
  /* Layers (top → bottom): right read overlay, gold wash, global dim, poster art */
  background-image: linear-gradient(
      90deg,
      rgba(5, 3, 18, 0) 0%,
      rgba(5, 3, 18, 0.12) 42%,
      rgba(2, 1, 10, 0.72) 72%,
      rgba(0, 0, 6, 0.9) 100%
    ),
    radial-gradient(
      ellipse 26% 36% at 53% 52%,
      rgba(255, 195, 80, 0.1),
      transparent 48%
    ),
    linear-gradient(
      90deg,
      rgba(8, 6, 20, 0.82) 0%,
      rgba(8, 6, 20, 0.28) 40%,
      rgba(5, 4, 14, 0.72) 100%
    ),
    var(--hero-poster);
  /* Poster: height-bound — full scene in band without vertical cover-crop */
  background-size: 100% 100%, 100% 100%, 100% 100%, auto 100%;
  background-position: 0 0, 0 0, 0 0, var(--hero-bg-x) center;
  background-repeat: no-repeat, no-repeat, no-repeat, no-repeat;
  animation:
    hero-bg-shift 20s ease-in-out infinite alternate,
    hero-glow 6s ease-in-out infinite alternate;
}

/* Chest interior glow: tight ellipse over coin pile / opening (left of 60% — CTA side stays clean) */
.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  background: radial-gradient(
    ellipse 22% 30% at 52% 50%,
    rgba(255, 200, 110, 0.28),
    rgba(255, 175, 60, 0.08) 42%,
    transparent 55%
  );
  opacity: 0.36;
  pointer-events: none;
  animation: hero-chest-pulse 4.5s ease-in-out infinite;
  will-change: opacity, transform;
}

/* Edge vignette: lighter on the right (read overlay already darkens CTA side) */
.hero::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(ellipse 95% 85% at 40% 50%, transparent 50%, rgba(0, 0, 0, 0.35));
}

.hero__particles {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  contain: layout style;
}

.hero__particle {
  position: absolute;
  width: 4px;
  height: 4px;
  margin-left: -2px;
  margin-top: -2px;
  background: radial-gradient(circle, #ffd700, rgba(255, 215, 0, 0));
  border-radius: 50%;
  opacity: 0.6;
  animation: hero-particle-float 6s linear infinite;
  will-change: transform, opacity;
}

@media (max-width: 768px) {
  .hero__particles {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero {
    animation: none;
    --hero-bg-x: 65%;
    filter: none;
  }

  .hero::before {
    animation: none;
    opacity: 0.4;
    transform: none;
  }

  .hero__particles {
    display: none;
  }
}

@keyframes hero-bg-shift {
  0% {
    --hero-bg-x: 64%;
  }
  100% {
    --hero-bg-x: 66%;
  }
}

@keyframes hero-glow {
  0% {
    filter: brightness(1);
  }
  100% {
    filter: brightness(1.05);
  }
}

@keyframes hero-chest-pulse {
  0%,
  100% {
    opacity: 0.32;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.02);
  }
}

@keyframes hero-particle-float {
  0% {
    transform: translateY(20px) scale(0.8);
    opacity: 0;
  }
  20% {
    opacity: 0.6;
  }
  100% {
    transform: translateY(-80px) scale(1);
    opacity: 0;
  }
}

.hero__content {
  position: relative;
  z-index: 2;
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 40px;
  min-width: 0;
  box-sizing: border-box;
}

@media (max-width: 640px) {
  .hero__content {
    padding: 0 20px;
  }
}
</style>
