<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Visually muted (e.g. disabled state). */
    muted?: boolean
    /** Interactive hover lift (for links wrapping the card). */
    interactive?: boolean
  }>(),
  { muted: false, interactive: false },
)
</script>

<template>
  <div
    class="app-card"
    :class="{ 'app-card--muted': muted, 'app-card--interactive': interactive }"
  >
    <slot />
  </div>
</template>

<style scoped>
.app-card {
  padding: var(--sa-space-5) calc(var(--sa-space-5) + 0.1rem);
  border-radius: var(--sa-radius-lg);
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-bg-card) 92%, transparent);
  color: var(--sa-color-text-main);
  box-shadow: var(--sa-shadow-card);
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  min-width: 0;
}

.app-card--muted {
  opacity: 0.52;
  pointer-events: none;
}

.app-card--interactive {
  cursor: default;
}

.app-card--interactive:hover {
  transform: translateY(-3px);
  border-color: var(--sa-color-primary-border);
  box-shadow:
    var(--sa-shadow-card),
    0 0 0 1px color-mix(in srgb, var(--sa-color-primary) 22%, transparent);
}
</style>
