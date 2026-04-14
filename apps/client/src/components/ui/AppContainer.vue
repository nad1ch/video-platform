<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Wider main column (e.g. Wordle board). */
    wide?: boolean
    /** No horizontal padding (full-bleed sections handle their own). */
    flush?: boolean
  }>(),
  { wide: false, flush: false },
)
</script>

<template>
  <div
    class="app-container"
    :class="{ 'app-container--wide': wide, 'app-container--flush': flush }"
  >
    <slot />
  </div>
</template>

<style scoped>
.app-container {
  width: 100%;
  max-width: min(72rem, 100%);
  margin-inline: auto;
  padding-inline: var(--sa-space-5);
  padding-block: var(--sa-space-4);
  box-sizing: border-box;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.app-container--wide {
  max-width: min(87.5rem, 100%);
}

.app-container--flush {
  padding-inline: 0;
}

@media (max-width: 600px) {
  .app-container {
    padding-inline: var(--sa-space-4);
  }

  .app-container--flush {
    padding-inline: 0;
  }
}
</style>
