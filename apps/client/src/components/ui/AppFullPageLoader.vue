<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * Full-screen loader (Teleport → body). Uses global `--sa-*` tokens so it works outside `.eat-first-root`.
 */
withDefaults(
  defineProps<{
    visible?: boolean
    /** Visible line under the spinner; empty = spinner only. */
    label?: string
    /** Screen-reader label when `label` is empty. */
    ariaLabel?: string
    /** When `false`, render inside the parent (e.g. route) so the page is already in the same subtree under the fixed overlay. */
    teleport?: boolean
  }>(),
  {
    visible: true,
    label: '',
    ariaLabel: '',
    teleport: true,
  },
)

const { t } = useI18n()
</script>

<template>
  <Teleport
    to="body"
    :disabled="!teleport"
  >
    <Transition name="page-loader-fade">
      <div
        v-if="visible"
        class="app-full-page-loader"
        :class="{
          'app-full-page-loader--no-label': !label,
          'app-full-page-loader--docked': !teleport,
        }"
        role="status"
        :aria-label="label || ariaLabel || t('loader.ariaLoading')"
      >
        <div class="app-full-page-loader__rings" aria-hidden="true">
          <span class="app-full-page-loader__ring" />
        </div>
        <p v-if="label" class="app-full-page-loader__label">{{ label }}</p>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.app-full-page-loader {
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
  /* Let the route paint underneath; scrim is light enough to read layout through the blur. */
  background: color-mix(in srgb, var(--sa-color-bg-hud-deep) 32%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.app-full-page-loader--docked {
  pointer-events: auto;
  /* Same viewport-fixed overlay; docked in route tree for clearer paint / stacking with page content. */
}

.app-full-page-loader--no-label {
  gap: 0;
}

.app-full-page-loader__rings {
  position: relative;
  z-index: 1;
  width: 3.5rem;
  height: 3.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.app-full-page-loader__ring {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 3px solid color-mix(in srgb, var(--sa-color-primary-border) 38%, transparent);
  border-top-color: var(--sa-color-primary);
  animation: appFullPageLoaderSpin 0.88s linear infinite;
  transform-origin: 50% 50%;
}

@keyframes appFullPageLoaderSpin {
  to {
    transform: rotate(360deg);
  }
}

.app-full-page-loader__label {
  position: relative;
  z-index: 1;
  margin: 0;
  font-family: var(--sa-font-display, system-ui, sans-serif);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--sa-color-primary) 45%, var(--sa-color-text-muted) 55%);
  text-align: center;
  max-width: 18rem;
  line-height: 1.5;
}
</style>
