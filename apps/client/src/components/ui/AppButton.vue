<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    title?: string
  }>(),
  { variant: 'secondary', type: 'button', disabled: false, title: undefined },
)
</script>

<template>
  <button
    :type="type"
    class="app-btn"
    :class="`app-btn--${variant}`"
    :disabled="disabled"
    :title="title"
  >
    <slot />
  </button>
</template>

<style scoped>
.app-btn {
  font: inherit;
  font-family: var(--sa-font-main, var(--sans));
  font-size: 0.88rem;
  font-weight: 600;
  padding: 0.45rem 0.85rem;
  border-radius: var(--sa-radius-sm);
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-surface-raised) 90%, transparent);
  color: var(--sa-color-text-main);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}

.app-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.app-btn:focus-visible {
  outline: 2px solid var(--sa-color-primary-border);
  outline-offset: 2px;
}

.app-btn--secondary:hover:not(:disabled) {
  border-color: var(--sa-color-primary-border);
  color: var(--sa-color-primary);
}

.app-btn--primary {
  background: color-mix(in srgb, var(--sa-color-primary) 88%, var(--sa-color-bg-deep));
  border-color: var(--sa-color-primary-border);
  color: var(--sa-color-text-strong);
}

.app-btn--primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--sa-color-primary) 100%, var(--sa-color-bg-deep));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--sa-color-primary) 35%, transparent);
}

.app-btn--ghost {
  background: color-mix(in srgb, var(--sa-color-surface) 75%, transparent);
  border-color: color-mix(in srgb, var(--sa-color-border) 80%, transparent);
  color: var(--sa-color-text-main);
}

.app-btn--ghost:hover:not(:disabled) {
  border-color: var(--sa-color-primary-border);
  color: var(--sa-color-primary);
}
</style>
