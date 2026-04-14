<script setup>
defineProps({
  visible: { type: Boolean, default: true },
  /** Короткий текст під спінером */
  label: { type: String, default: 'Завантаження…' },
})
</script>

<template>
  <Teleport to="body">
    <Transition name="page-loader-fade">
      <div
        v-if="visible"
        class="app-page-loader"
        role="status"
        :aria-label="label"
      >
        <div class="app-page-loader__glow" aria-hidden="true" />
        <div class="app-page-loader__rings" aria-hidden="true">
          <span class="app-page-loader__ring" />
          <span class="app-page-loader__ring app-page-loader__ring--delay" />
        </div>
        <p class="app-page-loader__label">{{ label }}</p>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.app-page-loader {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.35rem;
  padding: 2rem;
  box-sizing: border-box;
  background: color-mix(in srgb, var(--bg-body) 86%, #000 14%);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.app-page-loader__glow {
  position: absolute;
  width: min(72vmin, 420px);
  height: min(72vmin, 420px);
  border-radius: 50%;
  background: radial-gradient(
    circle at 50% 45%,
    color-mix(in srgb, var(--accent-fill) 35%, transparent) 0%,
    transparent 62%
  );
  pointer-events: none;
  animation: appPageLoaderGlow 3.2s ease-in-out infinite;
}

@keyframes appPageLoaderGlow {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(1);
  }
  50% {
    opacity: 0.85;
    transform: scale(1.06);
  }
}

.app-page-loader__rings {
  position: relative;
  width: 3.5rem;
  height: 3.5rem;
  z-index: 1;
}

.app-page-loader__ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 3px solid color-mix(in srgb, var(--border-strong) 45%, transparent);
  border-top-color: var(--accent-fill);
  animation: appPageLoaderSpin 0.85s linear infinite;
}

.app-page-loader__ring--delay {
  inset: 6px;
  border-width: 2px;
  border-top-color: color-mix(in srgb, var(--accent-fill) 70%, #fff);
  animation-duration: 1.15s;
  animation-direction: reverse;
}

@keyframes appPageLoaderSpin {
  to {
    transform: rotate(360deg);
  }
}

.app-page-loader__label {
  position: relative;
  z-index: 1;
  margin: 0;
  font-family: var(--font-display, 'Orbitron', sans-serif);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--text-muted);
  text-align: center;
  max-width: 18rem;
  line-height: 1.5;
}
</style>
