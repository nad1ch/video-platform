<script setup lang="ts">
import { ref } from 'vue'
import { useLandingCosmicParallax } from '@/composables/useLandingCosmicParallax'
import { landingCosmicGlows, landingCosmicSparkleDots } from '@/utils/landingCosmicDecor'

const canvasEl = ref<HTMLElement | null>(null)
useLandingCosmicParallax(canvasEl)
</script>

<template>
  <div class="landing-cosmic-backdrop" aria-hidden="true">
    <div ref="canvasEl" class="lcb-canvas">
      <div v-once>
        <div class="lcb-bg" />

        <span
          v-for="(dot, index) in landingCosmicSparkleDots"
          :key="`lcb-dot-${index}`"
          class="lcb-dot"
          :class="`lcb-dot--ph${dot.phase}`"
          :style="dot.style"
        />

        <span
          v-for="(glow, index) in landingCosmicGlows"
          :key="`lcb-glow-${index}`"
          class="lcb-glow"
          :style="glow.style"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Same cosmic stack as landing canvas (no wordmarks / raster bolts) — `lcb-*` avoids keyframe clashes with the landing route. */
.landing-cosmic-backdrop {
  /* Match `PurpleLightningBackdrop`: viewport-sized layer, not full scroll height. */
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.lcb-canvas {
  --u: 1px;
  --landing-parallax-bg-x: 0px;
  --landing-parallax-bg-y: 0px;
  --landing-parallax-mid-x: 0px;
  --landing-parallax-mid-y: 0px;
  --landing-parallax-fg-x: 0px;
  --landing-parallax-fg-y: 0px;
  --landing-parallax-glow-x: 0px;
  --landing-parallax-glow-y: 0px;
  --landing-parallax-bolt-x: 0px;
  --landing-parallax-bolt-y: 0px;
  position: relative;
  left: 50%;
  flex-shrink: 0;
  width: 2560px;
  height: auto;
  aspect-ratio: 2560 / 2655;
  min-height: calc(var(--u) * 2655);
  overflow: hidden;
  transform: translateX(-50%);
  background: linear-gradient(119.10504159217813deg, #0b0317 0%, rgba(74, 50, 116, 0.69) 73.206%);
  text-rendering: optimizeLegibility;
}

.lcb-bg {
  position: absolute;
  inset: 0;
  transform: translate3d(var(--landing-parallax-bg-x, 0px), var(--landing-parallax-bg-y, 0px), 0);
  will-change: transform;
}

@keyframes lcbDotPh0 {
  0%,
  100% {
    opacity: 0.28;
  }

  22% {
    opacity: 0.36;
  }

  45% {
    opacity: 0.5;
  }

  72% {
    opacity: 0.34;
  }
}

@keyframes lcbDotPh1 {
  0%,
  100% {
    opacity: 0.38;
  }

  28% {
    opacity: 0.5;
  }

  55% {
    opacity: 0.72;
  }

  78% {
    opacity: 0.46;
  }
}

@keyframes lcbDotPh2 {
  0%,
  100% {
    opacity: 0.3;
  }

  18% {
    opacity: 0.38;
  }

  35% {
    opacity: 0.56;
  }

  62% {
    opacity: 0.4;
  }
}

@keyframes lcbDotPh3 {
  0%,
  100% {
    opacity: 0.48;
  }

  25% {
    opacity: 0.62;
  }

  50% {
    opacity: 0.8;
  }

  75% {
    opacity: 0.58;
  }
}

@keyframes lcbDotPh4 {
  0%,
  100% {
    opacity: 0.26;
  }

  32% {
    opacity: 0.34;
  }

  65% {
    opacity: 0.46;
  }

  88% {
    opacity: 0.3;
  }
}

@keyframes lcbDotPh5 {
  0%,
  100% {
    opacity: 0.34;
  }

  22% {
    opacity: 0.44;
  }

  42% {
    opacity: 0.6;
  }

  68% {
    opacity: 0.42;
  }
}

@keyframes lcbDotPh6 {
  0%,
  100% {
    opacity: 0.42;
  }

  30% {
    opacity: 0.52;
  }

  58% {
    opacity: 0.66;
  }

  82% {
    opacity: 0.48;
  }
}

.lcb-dot,
.lcb-glow {
  position: absolute;
  pointer-events: none;
}

.lcb-dot {
  --dot-dur: 3s;
  --dot-delay: 0s;
  animation-timing-function: cubic-bezier(0.45, 0.05, 0.55, 0.95);
  animation-iteration-count: infinite;
  animation-duration: var(--dot-dur);
  animation-delay: var(--dot-delay);
  animation-fill-mode: backwards;
  transform: translate3d(var(--landing-parallax-fg-x, 0px), var(--landing-parallax-fg-y, 0px), 0);
  will-change: transform;
}

.lcb-dot--ph0 {
  background: rgba(255, 255, 255, 0.33);
  animation-name: lcbDotPh0;
}

.lcb-dot--ph1 {
  background: rgba(255, 255, 255, 0.46);
  animation-name: lcbDotPh1;
}

.lcb-dot--ph2 {
  background: rgba(255, 255, 255, 0.38);
  animation-name: lcbDotPh2;
}

.lcb-dot--ph3 {
  background: rgba(255, 255, 255, 0.5);
  animation-name: lcbDotPh3;
}

.lcb-dot--ph4 {
  background: rgba(255, 255, 255, 0.28);
  animation-name: lcbDotPh4;
}

.lcb-dot--ph5 {
  background: rgba(255, 255, 255, 0.41);
  animation-name: lcbDotPh5;
}

.lcb-dot--ph6 {
  background: rgba(255, 255, 255, 0.36);
  animation-name: lcbDotPh6;
}

.lcb-glow {
  border-radius: 999px;
  mix-blend-mode: screen;
  transform-origin: center;
}

@media (prefers-reduced-motion: reduce) {
  .lcb-dot {
    animation: none;
    transform: none;
    will-change: auto;
  }

  .lcb-bg {
    transform: none;
    will-change: auto;
  }
}
</style>
