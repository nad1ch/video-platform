<script setup lang="ts">
import AppCard from '@/components/ui/AppCard.vue'

defineProps<{
  title: string
  description: string
}>()

const emit = defineEmits<{ click: [] }>()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    emit('click')
  }
}
</script>

<template>
  <AppCard
    class="durak-mode-card"
    interactive
    role="button"
    tabindex="0"
    @click="emit('click')"
    @keydown="onKeydown"
  >
    <h3 class="durak-mode-card__title">{{ title }}</h3>
    <p class="durak-mode-card__desc">{{ description }}</p>
  </AppCard>
</template>

<style scoped>
.durak-mode-card {
  cursor: pointer;
  text-align: left;
  min-width: 0;
  width: 100%;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

.durak-mode-card:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--sa-color-primary, #6366f1) 85%, transparent);
  outline-offset: 2px;
}

.durak-mode-card__title {
  margin: 0 0 0.4rem;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--sa-color-text-main, #f1f5f9);
}

.durak-mode-card__desc {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--sa-color-text-body, rgba(226, 232, 240, 0.78));
}
</style>
